<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

it('returns 200 for an agent', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $this->asUser($agent)->getJson('/api/organization/branding')->assertOk();
});

it('returns 200 for a team lead', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);

    $this->asUser($lead)->getJson('/api/organization/branding')->assertOk();
});

it('returns 401 unauthenticated', function () {
    $this->getJson('/api/organization/branding')->assertStatus(401);
});

it('returns 401 for a deactivated user', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $token = $agent->createToken('spa')->plainTextToken;
    $agent->forceFill(['is_active' => false])->save();

    $this->asToken($token)->getJson('/api/organization/branding')->assertStatus(401);
});

it('carries no administrator middleware', function () {
    $route = collect(Route::getRoutes())->first(
        fn ($route) => $route->uri() === 'api/organization/branding'
    );

    expect($route)->not->toBeNull();
    expect($route->gatherMiddleware())
        ->toContain('auth:sanctum')
        ->toContain('active')
        ->not->toContain('administrator');
});
