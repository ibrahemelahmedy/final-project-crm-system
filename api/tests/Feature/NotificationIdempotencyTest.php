<?php

use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

it('running read-all twice produces identical state and does not rewrite read_at', function () {
    Notification::factory()->for($this->user, 'user')->count(3)->create();

    $this->asUser($this->user)->postJson('/api/notifications/read-all')->assertOk();
    $firstTimestamps = Notification::where('user_id', $this->user->id)->pluck('read_at', 'id');

    $this->travel(1)->hours();
    $this->asUser($this->user)->postJson('/api/notifications/read-all')->assertOk();
    $secondTimestamps = Notification::where('user_id', $this->user->id)->pluck('read_at', 'id');

    expect($secondTimestamps->toArray())->toEqual($firstTimestamps->toArray());
});

it('marking an already-read row read again is a no-op 200', function () {
    $notification = Notification::factory()->read()->for($this->user, 'user')->create();
    $originalReadAt = $notification->read_at;

    $this->travel(1)->hours();
    $response = $this->asUser($this->user)->postJson("/api/notifications/{$notification->id}/read");

    $response->assertOk();
    expect($notification->fresh()->read_at->equalTo($originalReadAt))->toBeTrue();
});
