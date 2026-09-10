<?php

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

function twilioFixture(): array
{
    return json_decode(file_get_contents(base_path('tests/fixtures/channels/twilio-sms-form.json')), true);
}

function postSignedTwilio(ChannelConnection $connection, string $secret, array $params): TestResponse
{
    $url = rtrim((string) config('app.url'), '/').'/api/webhooks/channels/twilio_sms';

    $data = $url;
    $sorted = $params;
    ksort($sorted);
    foreach ($sorted as $k => $v) {
        $data .= $k.$v;
    }
    $signature = base64_encode(hash_hmac('sha1', $data, $secret, true));

    return test()->call('POST', '/api/webhooks/channels/twilio_sms', $params, [], [], [
        'HTTP_X_TWILIO_SIGNATURE' => $signature,
    ]);
}

it('a signed Twilio form post creates a ticket with channel = sms', function () {
    [$connection, $secret] = connectChannel(Channel::Sms, ChannelProvider::TwilioSms);

    $response = postSignedTwilio($connection, $secret, twilioFixture());
    $response->assertStatus(202)->assertJson(['received' => 1]);

    $ticket = Ticket::firstOrFail();
    expect($ticket->channel)->toBe(Channel::Sms);
});

it('a reply from the same number to a Resolved ticket reopens it and writes a reopened event', function () {
    [$connection, $secret] = connectChannel(Channel::Sms, ChannelProvider::TwilioSms);

    $customer = Customer::factory()->create(['phone' => '+15005550006']);
    $ticket = Ticket::factory()->create([
        'customer_id' => $customer->id,
        'channel' => Channel::Sms->value,
        'status' => 'resolved',
        'resolved_at' => now(),
    ]);

    $params = twilioFixture();
    $response = postSignedTwilio($connection, $secret, $params);
    $response->assertStatus(202);

    $ticket->refresh();
    expect($ticket->status->value)->toBe('open');
    expect($ticket->resolved_at)->toBeNull();

    expect(TicketEvent::where('ticket_id', $ticket->id)->where('event', 'reopened')->exists())->toBeTrue();
});

it('a reply after thread_window_hours opens a new ticket', function () {
    [$connection, $secret] = connectChannel(Channel::Sms, ChannelProvider::TwilioSms);

    $customer = Customer::factory()->create(['phone' => '+15005550006']);
    Ticket::factory()->create([
        'customer_id' => $customer->id,
        'channel' => Channel::Sms->value,
        'status' => 'open',
        'updated_at' => now()->subHours(73),
    ]);

    $response = postSignedTwilio($connection, $secret, twilioFixture());
    $response->assertStatus(202);

    expect(Ticket::where('customer_id', $customer->id)->count())->toBe(2);
});

it('GET on the SMS webhook is 405', function () {
    connectChannel(Channel::Sms, ChannelProvider::TwilioSms);

    $this->get('/api/webhooks/channels/twilio_sms')->assertStatus(405);
});
