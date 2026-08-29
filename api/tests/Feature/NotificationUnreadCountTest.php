<?php

use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

it('matches the row count after dispatch, after one markRead, and after read-all', function () {
    Notification::factory()->for($this->user, 'user')->count(2)->create();
    app(NotificationDispatcher::class)->dispatch($this->user, NotificationType::Mention, 'You were mentioned');

    $response = $this->asUser($this->user)->getJson('/api/notifications/unread-count');
    $response->assertOk()->assertJson(['count' => 3]);

    $target = Notification::where('user_id', $this->user->id)->first();
    $this->asUser($this->user)->postJson("/api/notifications/{$target->id}/read")->assertOk();

    $response = $this->asUser($this->user)->getJson('/api/notifications/unread-count');
    $response->assertOk()->assertJson(['count' => 2]);

    $this->asUser($this->user)->postJson('/api/notifications/read-all')->assertOk();

    $response = $this->asUser($this->user)->getJson('/api/notifications/unread-count');
    $response->assertOk()->assertJson(['count' => 0]);
});

it('is computed server-side on every call, not cached client-side', function () {
    $response = $this->asUser($this->user)->getJson('/api/notifications/unread-count');
    $response->assertOk()->assertJson(['count' => 0]);

    Notification::factory()->for($this->user, 'user')->create();

    $response = $this->asUser($this->user)->getJson('/api/notifications/unread-count');
    $response->assertOk()->assertJson(['count' => 1]);
});
