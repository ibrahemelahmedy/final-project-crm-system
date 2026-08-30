<?php

use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $this->token = fn (User $u) => $u->createToken('spa')->plainTextToken;
});

it('gives an Administrator the admin summary', function () {
    SlaRule::factory()->count(3)->sequence(
        ['priority' => 'low'],
        ['priority' => 'normal'],
        ['priority' => 'high'],
    )->create();

    $this->asToken(($this->token)($this->admin))
        ->getJson('/api/dashboard/admin/summary')
        ->assertOk()
        ->assertJsonStructure(['user_count', 'active_sla_rule_count', 'audit_log_count'])
        ->assertJson(['active_sla_rule_count' => 3]);
});

it('forbids both an Agent and a Team Lead from the admin summary', function () {
    $this->asToken(($this->token)($this->agent))
        ->getJson('/api/dashboard/admin/summary')->assertForbidden();

    $this->asToken(($this->token)($this->lead))
        ->getJson('/api/dashboard/admin/summary')->assertForbidden();
});
