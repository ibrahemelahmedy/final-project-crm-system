<?php

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

function emailFixture(): array
{
    return json_decode(file_get_contents(base_path('tests/fixtures/channels/email-inbound.json')), true);
}

function postSignedEmail(ChannelConnection $connection, string $secret, array $payload): TestResponse
{
    $body = json_encode($payload);
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    return test()->call('POST', '/api/webhooks/channels/email_webhook', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WISAL_SIGNATURE' => $signature,
    ], $body);
}

it('a signed inbound-email fixture creates a ticket with the subject truncated at 255', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $payload = emailFixture();
    $payload['subject'] = str_repeat('X', 400);

    $response = postSignedEmail($connection, $secret, $payload);
    $response->assertStatus(202)->assertJson(['received' => 1]);

    $ticket = Ticket::firstOrFail();
    expect($ticket->channel)->toBe(Channel::Email);
    expect(strlen($ticket->subject))->toBeLessThanOrEqual(255);
});

it('the idempotency test: posting the identical payload twice is a zero-write no-op on the second call', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $payload = emailFixture();

    $response1 = postSignedEmail($connection, $secret, $payload);
    $response1->assertStatus(202)->assertJson(['received' => 1]);

    expect(ChannelInboundMessage::count())->toBe(1);
    expect(Ticket::count())->toBe(1);
    expect(TicketMessage::count())->toBe(1);

    $ticket = Ticket::first();
    $ticketUpdatedAt = $ticket->updated_at->toDateTimeString();
    $connection->refresh();
    $lastInboundAt = $connection->last_inbound_at?->toDateTimeString();

    $response2 = postSignedEmail($connection, $secret, $payload);
    $response2->assertStatus(202);

    expect(ChannelInboundMessage::count())->toBe(1);
    expect(Ticket::count())->toBe(1);
    expect(TicketMessage::count())->toBe(1);

    $ticket->refresh();
    expect($ticket->updated_at->toDateTimeString())->toBe($ticketUpdatedAt);

    $connection->refresh();
    expect($connection->last_inbound_at?->toDateTimeString())->toBe($lastInboundAt);
});

it('strips a quoted reply: "On ... wrote:" and > lines are dropped, keeping only the new text', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $payload = emailFixture();
    $payload['message_id'] = '<quoted-reply-test@mail.example.com>';
    $payload['text'] = "Thanks, that fixed it.\n\nOn Mon, Jan 1, 2024 at 10:00 AM Support <support@example.com> wrote:\n> Original message text here.\n> more quoted text";
    unset($payload['html']);

    postSignedEmail($connection, $secret, $payload);

    $message = TicketMessage::firstOrFail();
    expect($message->body)->toContain('Thanks, that fixed it.');
    expect($message->body)->not->toContain('Original message text here');
    expect($message->body)->not->toContain('wrote:');
});

it('truncates a body over max_message_chars instead of rejecting it', function () {
    config(['channels.inbound.max_message_chars' => 50]);
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $payload = emailFixture();
    $payload['message_id'] = '<long-body-test@mail.example.com>';
    $payload['text'] = str_repeat('a', 500);
    unset($payload['html']);

    $response = postSignedEmail($connection, $secret, $payload);
    $response->assertStatus(202)->assertJson(['received' => 1]);

    $message = TicketMessage::firstOrFail();
    expect(strlen($message->body))->toBeLessThanOrEqual(50);
});

it('falls back to strip_tags for an HTML-only body', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $payload = emailFixture();
    $payload['message_id'] = '<html-only-test@mail.example.com>';
    unset($payload['text']);
    $payload['html'] = '<p>Hello <b>there</b>, this is <i>HTML</i> only.</p>';

    $response = postSignedEmail($connection, $secret, $payload);
    $response->assertStatus(202);

    $message = TicketMessage::firstOrFail();
    expect($message->body)->toContain('Hello');
    expect($message->body)->toContain('there');
    expect($message->body)->not->toContain('<p>');
    expect($message->body)->not->toContain('<b>');
});

it('a payload with attachments[] sets the placeholder in the body and stores no attachment', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $payload = emailFixture();
    $payload['message_id'] = '<with-attachment-test@mail.example.com>';
    $payload['attachments'] = [['filename' => 'invoice.pdf', 'content_type' => 'application/pdf']];

    $response = postSignedEmail($connection, $secret, $payload);
    $response->assertStatus(202);

    $message = TicketMessage::firstOrFail();
    expect($message->body)->toContain(__('channels.inbound.attachment_placeholder'));
});
