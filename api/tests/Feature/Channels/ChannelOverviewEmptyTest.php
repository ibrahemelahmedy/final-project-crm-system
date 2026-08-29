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

it('reports has_tickets false and every count zero when the window is empty', function () {
    $res = $this->asUser($this->admin)->getJson('/api/channels/overview?period=30d')->assertOk();

    expect($res->json('meta.has_tickets'))->toBeFalse();
    expect($res->json('meta.total_tickets'))->toBe(0);
    foreach ($res->json('data') as $channel) {
        expect($channel['ticket_count'])->toBe(0);
    }
});

it('treats tickets that fall outside the window as an empty window', function () {
    $old = Ticket::factory()->create(['channel' => Channel::Email->value]);
    $old->forceFill(['created_at' => now()->subDays(120)])->save();

    $res = $this->asUser($this->admin)->getJson('/api/channels/overview?period=30d')->assertOk();

    expect($res->json('meta.has_tickets'))->toBeFalse();
    expect(collect($res->json('data'))->firstWhere('value', 'email')['ticket_count'])->toBe(0);
});
