<?php

use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('exposes only NotificationType cases in the type field, never a framework class name', function () {
    $user = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    Notification::factory()->for($user, 'user')->count(8)->create();

    $response = $this->asUser($user)->getJson('/api/notifications');

    $response->assertOk();

    foreach ($response->json('data') as $row) {
        expect($row['type'])->toBeIn(NotificationType::values());
        expect($row['type'])->not->toContain('\\');
        expect($row['type'])->not->toContain('App\\Notifications');

        $json = json_encode($row);
        expect($json)->not->toContain('Illuminate\\Notifications');
        expect($json)->not->toContain('App\\Notifications\\');
    }
});
