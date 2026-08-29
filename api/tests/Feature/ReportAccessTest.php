<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('denies an Agent with 403', function () {
    $this->asUser($this->agent)
        ->getJson('/api/reports/summary')
        ->assertForbidden();
});

it('allows a Team Lead and an Administrator with 200', function () {
    $this->asUser($this->lead)->getJson('/api/reports/summary')->assertOk();
    $this->asUser($this->admin)->getJson('/api/reports/summary')->assertOk();
});

it('rejects an unauthenticated request with 401', function () {
    $this->getJson('/api/reports/summary')->assertUnauthorized();
});
