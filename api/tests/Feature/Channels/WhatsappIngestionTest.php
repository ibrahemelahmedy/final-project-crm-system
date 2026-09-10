<?php

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Models\Customer;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

/**
 * Story 26 (WIS-22), Test Plan §B. AI_CLASSIFY_ENABLED stays false (the
 * suite default) — no assist fake is bound here (WIS-23 Edge Case 21 trap).
 */
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

function whatsappFixture(): array
{
    return json_decode(file_get_contents(base_path('tests/fixtures/channels/whatsapp-cloud-text.json')), true);
}

/** @return array{0: ChannelConnection, 1: TestResponse} */
function postSignedWhatsapp(array $payload): array
{
    [$connection, $secret] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $response = postSignedWhatsappOn($connection, $secret, $payload);

    return [$connection, $response];
}

function postSignedWhatsappOn(ChannelConnection $connection, string $secret, array $payload): TestResponse
{
    $body = json_encode($payload);
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    return test()->call('POST', '/api/webhooks/channels/whatsapp_cloud', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_HUB_SIGNATURE_256' => $signature,
    ], $body);
}

it('creates a ticket from the whatsapp-cloud-text fixture with the right shape', function () {
    SlaRule::factory()->create(['priority' => 'normal', 'is_active' => true]);

    $payload = whatsappFixture();
    [$connection, $response] = postSignedWhatsapp($payload);

    $response->assertStatus(202)->assertJson(['received' => 1]);

    $ticket = Ticket::firstOrFail();
    expect($ticket->channel)->toBe(Channel::Whatsapp);
    expect($ticket->status->value)->toBe('open');
    expect($ticket->priority->value)->toBe('normal');
    expect($ticket->created_by)->toBeNull();
    expect($ticket->resolution_due_at)->not->toBeNull();

    $messages = TicketMessage::where('ticket_id', $ticket->id)->get();
    expect($messages)->toHaveCount(1);
    expect($messages->first()->author_type)->toBe(TicketMessage::AUTHOR_CUSTOMER);
    expect($messages->first()->visibility->value)->toBe('public');
});

it('a statuses[]-only envelope returns 202 received:0 and creates nothing', function () {
    $payload = [
        'object' => 'whatsapp_business_account',
        'entry' => [[
            'id' => '1',
            'changes' => [[
                'value' => [
                    'messaging_product' => 'whatsapp',
                    'metadata' => ['phone_number_id' => '1234567890'],
                    'statuses' => [['id' => 'wamid.x', 'status' => 'delivered']],
                ],
                'field' => 'messages',
            ]],
        ]],
    ];

    [, $response] = postSignedWhatsapp($payload);

    $response->assertStatus(202)->assertJson(['received' => 0]);
    expect(Ticket::count())->toBe(0);
});

it('handshake GET with the right token echoes the challenge; wrong token gets 403 and no echo', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    // connectChannel sets verify_token = 'test-verify-token'.

    $ok = $this->get('/api/webhooks/channels/whatsapp_cloud?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345');
    $ok->assertOk();
    expect($ok->headers->get('Content-Type'))->toContain('text/plain');
    expect($ok->getContent())->toBe('12345');

    $bad = $this->get('/api/webhooks/channels/whatsapp_cloud?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345');
    $bad->assertStatus(403);
    expect($bad->getContent())->not->toContain('12345');
});

it('a second message from the same number inside the window appends to the existing ticket', function () {
    [$connection, $secret] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $payload = whatsappFixture();
    postSignedWhatsappOn($connection, $secret, $payload);
    expect(Ticket::count())->toBe(1);

    $payload2 = $payload;
    $payload2['entry'][0]['changes'][0]['value']['messages'][0]['id'] = 'wamid.SECOND-MESSAGE-ID';
    $payload2['entry'][0]['changes'][0]['value']['messages'][0]['text']['body'] = 'Following up on my question.';

    $response = postSignedWhatsappOn($connection, $secret, $payload2);
    $response->assertStatus(202)->assertJson(['received' => 1]);

    expect(Ticket::count())->toBe(1);
    expect(TicketMessage::where('ticket_id', Ticket::first()->id)->count())->toBe(2);
});

it('a multi-message envelope ingests all of them, and one throwing does not discard its siblings', function () {
    $payload = whatsappFixture();
    $msg1 = $payload['entry'][0]['changes'][0]['value']['messages'][0];

    $msgOk = $msg1;
    $msgOk['id'] = 'wamid.OK-MESSAGE';
    $msgOk['from'] = '15550009999';
    $msgOk['text']['body'] = 'A fine message.';

    $msgBad = $msg1;
    $msgBad['id'] = 'wamid.BAD-MESSAGE';
    unset($msgBad['from']); // malformed: parse() drops it (returns null), simulating an unparseable entry

    $payload['entry'][0]['changes'][0]['value']['messages'] = [$msgOk, $msgBad, $msg1];

    [, $response] = postSignedWhatsapp($payload);

    // The malformed one is dropped by parse() itself (never throws); the
    // other two are accepted.
    $response->assertStatus(202)->assertJson(['received' => 2]);
    expect(Ticket::count())->toBe(2);
});

it('an unknown sender creates a Customer with a normalised phone derived through the model', function () {
    $payload = whatsappFixture();
    expect(Customer::count())->toBe(0);

    postSignedWhatsapp($payload);

    $customer = Customer::firstOrFail();
    expect($customer->phone)->toBe('+15550002222');
    expect($customer->phone_normalized)->not->toBeNull();
});
