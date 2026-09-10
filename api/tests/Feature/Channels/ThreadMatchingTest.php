<?php

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use App\Models\ChannelOutboundMessage;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

/** Story 26 (WIS-22), Test Plan §E — Done Criterion 6's thread matching. */
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

function postSignedEmailWith(ChannelConnection $connection, string $secret, array $payload): TestResponse
{
    $body = json_encode($payload);
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    return test()->call('POST', '/api/webhooks/channels/email_webhook', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WISAL_SIGNATURE' => $signature,
    ], $body);
}

function baseEmailPayload(): array
{
    return json_decode(file_get_contents(base_path('tests/fixtures/channels/email-inbound.json')), true);
}

/** A ChannelOutboundMessage row that answers $ticket, without dragging in a second Ticket via the factory's default relations. */
function outboundFor(ChannelConnection $connection, Ticket $ticket, string $providerMessageId): ChannelOutboundMessage
{
    $ticketMessage = TicketMessage::factory()->for($ticket)->create(['customer_id' => $ticket->customer_id]);

    return ChannelOutboundMessage::factory()->create([
        'channel_connection_id' => $connection->id,
        'ticket_id' => $ticket->id,
        'ticket_message_id' => $ticketMessage->id,
        'provider_message_id' => $providerMessageId,
    ]);
}

it('In-Reply-To pointing at a provider_message_id we emitted appends to that ticket', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value]);
    outboundFor($connection, $ticket, 'our-outbound-id@wisal.example.com');

    $payload = baseEmailPayload();
    $payload['in_reply_to'] = 'our-outbound-id@wisal.example.com';

    postSignedEmailWith($connection, $secret, $payload);

    expect(Ticket::count())->toBe(1);
    // outboundFor() seeded one TicketMessage already (the reply it answers);
    // the inbound ingestion appends a second.
    expect($ticket->fresh()->messages()->count())->toBe(2);
});

it('References with several ids matches the right-most (most recent ancestor)', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $rightTicket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value]);
    $wrongTicket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value]);

    outboundFor($connection, $wrongTicket, 'old-ancestor@x');
    outboundFor($connection, $rightTicket, 'recent-ancestor@x');

    $payload = baseEmailPayload();
    $payload['in_reply_to'] = null;
    $payload['references'] = ['old-ancestor@x', 'recent-ancestor@x'];

    postSignedEmailWith($connection, $secret, $payload);

    expect($rightTicket->fresh()->messages()->count())->toBe(2);
    expect($wrongTicket->fresh()->messages()->count())->toBe(1);
});

it('In-Reply-To pointing at a channel_inbound_messages id also matches', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value]);

    ChannelInboundMessage::factory()->create([
        'channel_connection_id' => $connection->id,
        'ticket_id' => $ticket->id,
        'provider_message_id' => 'prior-inbound-id@x',
    ]);

    $payload = baseEmailPayload();
    $payload['in_reply_to'] = 'prior-inbound-id@x';

    postSignedEmailWith($connection, $secret, $payload);

    expect($ticket->fresh()->messages()->count())->toBe(1);
});

it('a [#<id>] subject token matches when no headers are present', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value]);

    $payload = baseEmailPayload();
    $payload['in_reply_to'] = null;
    $payload['references'] = [];
    $payload['subject'] = "Re: your issue [#{$ticket->id}]";

    postSignedEmailWith($connection, $secret, $payload);

    expect($ticket->fresh()->messages()->count())->toBe(1);
    expect(Ticket::count())->toBe(1);
});

it('customer B forging In-Reply-To to customer A\'s ticket opens a new ticket for B and leaves A untouched', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customerA = Customer::factory()->create(['email' => 'a@example.com']);
    $ticketA = Ticket::factory()->create(['customer_id' => $customerA->id, 'channel' => Channel::Email->value]);
    outboundFor($connection, $ticketA, 'a-outbound@x');

    $customerB = Customer::factory()->create(['email' => 'b@example.com']);
    $aUpdatedAt = $ticketA->fresh()->updated_at->toDateTimeString();

    $payload = baseEmailPayload();
    $payload['from'] = ['email' => 'b@example.com', 'name' => 'Customer B'];
    $payload['message_id'] = '<forged-in-reply-to@x>';
    $payload['in_reply_to'] = 'a-outbound@x';

    postSignedEmailWith($connection, $secret, $payload);

    expect(Ticket::count())->toBe(2);
    $newTicket = Ticket::where('customer_id', $customerB->id)->firstOrFail();
    expect($newTicket->id)->not->toBe($ticketA->id);

    $ticketA->refresh();
    // Only outboundFor()'s seeded message — nothing from the forged reply.
    expect($ticketA->messages()->count())->toBe(1);
    expect($ticketA->updated_at->toDateTimeString())->toBe($aUpdatedAt);
});

it('a guessed [#<A\'s id>] subject token also fails the identity check and opens a new ticket', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customerA = Customer::factory()->create(['email' => 'a@example.com']);
    $ticketA = Ticket::factory()->create(['customer_id' => $customerA->id, 'channel' => Channel::Email->value]);

    $customerB = Customer::factory()->create(['email' => 'b@example.com']);

    $payload = baseEmailPayload();
    $payload['from'] = ['email' => 'b@example.com', 'name' => 'Customer B'];
    $payload['message_id'] = '<guessed-subject-token@x>';
    $payload['in_reply_to'] = null;
    $payload['references'] = [];
    $payload['subject'] = "Re: [#{$ticketA->id}]";

    postSignedEmailWith($connection, $secret, $payload);

    expect(Ticket::count())->toBe(2);
    expect($ticketA->fresh()->messages()->count())->toBe(0);
});

it('an unrecognised sender with a valid-looking In-Reply-To opens a new ticket and a new customer', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $existingCustomer = Customer::factory()->create(['email' => 'existing@example.com']);
    $existingTicket = Ticket::factory()->create(['customer_id' => $existingCustomer->id, 'channel' => Channel::Email->value]);
    outboundFor($connection, $existingTicket, 'existing-outbound@x');

    expect(Customer::count())->toBe(1);

    $payload = baseEmailPayload();
    $payload['from'] = ['email' => 'brand-new@example.com', 'name' => 'Brand New'];
    $payload['message_id'] = '<new-sender@x>';
    $payload['in_reply_to'] = 'existing-outbound@x';

    postSignedEmailWith($connection, $secret, $payload);

    expect(Customer::count())->toBe(2);
    expect(Ticket::count())->toBe(2);
    // Only outboundFor()'s seeded message — the new sender's ticket is separate.
    expect($existingTicket->fresh()->messages()->count())->toBe(1);
});

it('phone matching finds a customer stored as +1... when the provider sends 1...', function () {
    [$connection, $secret] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $customer = Customer::factory()->create(['phone' => '+15550002222', 'email' => null]);
    $ticket = Ticket::factory()->create([
        'customer_id' => $customer->id,
        'channel' => Channel::Whatsapp->value,
        'status' => 'open',
    ]);

    $payload = json_decode(file_get_contents(base_path('tests/fixtures/channels/whatsapp-cloud-text.json')), true);
    $body = json_encode($payload);
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    test()->call('POST', '/api/webhooks/channels/whatsapp_cloud', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_HUB_SIGNATURE_256' => $signature,
    ], $body);

    expect(Ticket::count())->toBe(1);
    expect($ticket->fresh()->messages()->count())->toBe(1);
});
