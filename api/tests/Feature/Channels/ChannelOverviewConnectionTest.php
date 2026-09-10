<?php

use App\Enums\UserRole;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

/** Story 26 (WIS-22), Test Plan §K — Done Criterion 4. */
uses(RefreshDatabase::class);

it('with no rows, all five channels are not_connected with connection null', function () {
    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $res = $this->asUser($user)->getJson('/api/channels/overview')->assertOk();

    expect($res->json('data'))->toHaveCount(5);
    foreach ($res->json('data') as $channel) {
        expect($channel['status'])->toBe('not_connected');
        expect($channel['connection'])->toBeNull();
    }
});

it('one connected whatsapp row reports connected with provider and last_inbound_at, others unchanged', function () {
    $connection = ChannelConnection::factory()->whatsapp()->create(['last_inbound_at' => now()]);

    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $res = $this->asUser($user)->getJson('/api/channels/overview')->assertOk();

    foreach ($res->json('data') as $channel) {
        if ($channel['value'] === 'whatsapp') {
            expect($channel['status'])->toBe('connected');
            expect($channel['connection']['provider'])->toBe('whatsapp_cloud');
            expect($channel['connection']['last_inbound_at'])->not->toBeNull();
        } else {
            expect($channel['status'])->toBe('not_connected');
            expect($channel['connection'])->toBeNull();
        }
    }
});

it('connection.inbound_24h counts channel_inbound_messages unscoped by visibleTo, while ticket_count stays scoped', function () {
    $connection = ChannelConnection::factory()->whatsapp()->create();

    ChannelInboundMessage::factory()->count(3)->create([
        'channel_connection_id' => $connection->id,
        'received_at' => now()->subHours(2),
    ]);
    // Outside the 24h window — must not be counted.
    ChannelInboundMessage::factory()->create([
        'channel_connection_id' => $connection->id,
        'received_at' => now()->subDays(2),
    ]);

    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $otherAgent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    // A ticket on this channel, assigned to someone ELSE — excluded from
    // $agent's visibleTo-scoped ticket_count, but the wire-level inbound_24h
    // count must still see it.
    $customer = Customer::factory()->create();
    Ticket::factory()->create([
        'customer_id' => $customer->id,
        'channel' => 'whatsapp',
        'assigned_to' => $otherAgent->id,
    ]);

    $res = $this->asUser($agent)->getJson('/api/channels/overview')->assertOk();
    $whatsapp = collect($res->json('data'))->firstWhere('value', 'whatsapp');

    expect($whatsapp['connection']['inbound_24h'])->toBe(3);
    expect($whatsapp['ticket_count'])->toBe(0);
});

it('a connection in error status reports status=error with connection.last_error_key', function () {
    ChannelConnection::factory()->whatsapp()->errored()->create();

    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $res = $this->asUser($user)->getJson('/api/channels/overview')->assertOk();

    $whatsapp = collect($res->json('data'))->firstWhere('value', 'whatsapp');
    expect($whatsapp['status'])->toBe('error');
    expect($whatsapp['connection']['last_error_key'])->toBe('channels.error.not_configured');
});

it('the ?period= contract is unchanged for ticket_count', function () {
    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $res = $this->asUser($user)->getJson('/api/channels/overview?period=7d')->assertOk();
    expect($res->json('meta.period'))->toBe('7d');

    $this->asUser($user)->getJson('/api/channels/overview?period=bogus')->assertStatus(422);
});
