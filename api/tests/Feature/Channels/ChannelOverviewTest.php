<?php

use App\Enums\Channel;
use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

function seedTicket(string $channel, int $daysAgo): Ticket
{
    $t = Ticket::factory()->create(['channel' => $channel]);
    $t->forceFill(['created_at' => now()->subDays($daysAgo)])->save();

    return $t;
}

it('returns all five channels even when only one has tickets', function () {
    seedTicket(Channel::Email->value, 1);

    $res = $this->asUser($this->admin)->getJson('/api/channels/overview')->assertOk();

    expect($res->json('data'))->toHaveCount(5);

    $byValue = collect($res->json('data'))->keyBy('value');
    expect($byValue['email']['ticket_count'])->toBe(1);
    expect($byValue['whatsapp']['ticket_count'])->toBe(0);
    expect($byValue['chat']['ticket_count'])->toBe(0);
});

it('counts match seeded rows via a single aggregate', function () {
    seedTicket(Channel::Email->value, 2);
    seedTicket(Channel::Email->value, 3);
    seedTicket(Channel::Sms->value, 4);

    $res = $this->asUser($this->admin)->getJson('/api/channels/overview?period=30d')->assertOk();

    $byValue = collect($res->json('data'))->keyBy('value');
    expect($byValue['email']['ticket_count'])->toBe(2);
    expect($byValue['sms']['ticket_count'])->toBe(1);
    expect($res->json('meta.total_tickets'))->toBe(3);
    expect($res->json('meta.has_tickets'))->toBeTrue();
});

it('7d and 90d return different windows', function () {
    seedTicket(Channel::Email->value, 3);   // in both
    seedTicket(Channel::Email->value, 45);  // only in 90d

    $sevenDay = $this->asUser($this->admin)->getJson('/api/channels/overview?period=7d')->assertOk();
    $ninetyDay = $this->asUser($this->admin)->getJson('/api/channels/overview?period=90d')->assertOk();

    expect(collect($sevenDay->json('data'))->firstWhere('value', 'email')['ticket_count'])->toBe(1);
    expect(collect($ninetyDay->json('data'))->firstWhere('value', 'email')['ticket_count'])->toBe(2);
    expect($sevenDay->json('meta.period'))->toBe('7d');
    expect($ninetyDay->json('meta.period'))->toBe('90d');
});

it('defaults to 30d when period is absent', function () {
    $this->asUser($this->admin)->getJson('/api/channels/overview')
        ->assertOk()
        ->assertJsonPath('meta.period', '30d');
});

it('rejects an unrecognised period with 422', function () {
    $this->asUser($this->admin)->getJson('/api/channels/overview?period=365d')->assertStatus(422);
});

it('reports every channel as not_connected with no connected variant', function () {
    seedTicket(Channel::Email->value, 1);

    $res = $this->asUser($this->admin)->getJson('/api/channels/overview')->assertOk();

    foreach ($res->json('data') as $channel) {
        expect($channel['status'])->toBe('not_connected');
    }
});

it('is an enum-drift guard: data equals Channel::cases() in order', function () {
    $res = $this->asUser($this->admin)->getJson('/api/channels/overview')->assertOk();

    expect(collect($res->json('data'))->pluck('value')->all())
        ->toBe(array_map(fn (Channel $c) => $c->value, Channel::cases()));
});
