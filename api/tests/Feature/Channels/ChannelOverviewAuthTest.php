<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

it('rejects an unauthenticated request with 401', function () {
    $this->getJson('/api/channels/overview')->assertUnauthorized();
});

it('grants every role 200 with the same not_connected status for all channels', function () {
    foreach ([UserRole::Agent, UserRole::TeamLead, UserRole::Administrator] as $role) {
        $user = User::factory()->create(['role' => $role, 'is_active' => true]);

        $res = $this->asUser($user)->getJson('/api/channels/overview')->assertOk();

        expect($res->json('data'))->toHaveCount(5);
        foreach ($res->json('data') as $channel) {
            expect($channel['status'])->toBe('not_connected');
        }
    }
});

it('exposes no route that writes channel configuration', function () {
    $channelRoutes = collect(Route::getRoutes())->filter(
        fn ($r) => str_contains($r->uri(), 'channels')
    );

    expect($channelRoutes)->toHaveCount(1);
    expect($channelRoutes->first()->methods())->toContain('GET');
    foreach ($channelRoutes as $route) {
        expect(array_intersect($route->methods(), ['POST', 'PUT', 'PATCH', 'DELETE']))->toBeEmpty();
    }
});
