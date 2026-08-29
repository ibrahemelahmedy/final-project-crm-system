<?php

use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

it('paginates the index server-side and never returns a large seed in full', function () {
    Notification::factory()->for($this->user, 'user')->count(45)->create();

    $response = $this->asUser($this->user)->getJson('/api/notifications?per_page=20');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(20);
    expect($response->json('meta.total'))->toBe(45);
    expect($response->json('meta.last_page'))->toBe(3);
});

it('filters to unread only with ?filter=unread', function () {
    Notification::factory()->for($this->user, 'user')->count(4)->create();
    Notification::factory()->read()->for($this->user, 'user')->count(6)->create();

    $response = $this->asUser($this->user)->getJson('/api/notifications?filter=unread');

    $response->assertOk();
    expect($response->json('meta.total'))->toBe(4);
    foreach ($response->json('data') as $row) {
        expect($row['read_at'])->toBeNull();
    }
});

it('returns every row (read and unread) with ?filter=all', function () {
    Notification::factory()->for($this->user, 'user')->count(2)->create();
    Notification::factory()->read()->for($this->user, 'user')->count(3)->create();

    $response = $this->asUser($this->user)->getJson('/api/notifications?filter=all');

    $response->assertOk();
    expect($response->json('meta.total'))->toBe(5);
});
