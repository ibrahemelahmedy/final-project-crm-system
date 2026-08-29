<?php

use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent1 = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->agent2 = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

it('returns only the callers rows from the index', function () {
    Notification::factory()->for($this->agent1, 'user')->count(2)->create();
    Notification::factory()->for($this->agent2, 'user')->count(3)->create();

    $response = $this->asUser($this->agent1)->getJson('/api/notifications');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

it('returns 404 marking read on another users row', function () {
    $other = Notification::factory()->for($this->agent2, 'user')->create();

    $response = $this->asUser($this->agent1)->postJson("/api/notifications/{$other->id}/read");

    $response->assertNotFound();
    $this->assertDatabaseHas('notifications', ['id' => $other->id, 'read_at' => null]);
});

it('leaves other users rows untouched on read-all', function () {
    Notification::factory()->for($this->agent1, 'user')->count(2)->create();
    $othersRow = Notification::factory()->for($this->agent2, 'user')->create();

    $this->asUser($this->agent1)->postJson('/api/notifications/read-all')->assertOk();

    $this->assertDatabaseHas('notifications', ['id' => $othersRow->id, 'read_at' => null]);
    expect(Notification::where('user_id', $this->agent1->id)->whereNull('read_at')->count())->toBe(0);
});
