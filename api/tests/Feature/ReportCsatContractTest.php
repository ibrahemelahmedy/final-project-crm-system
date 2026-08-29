<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('ships the csat block present and unavailable so Story 13 flips a value, not the shape', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);

    $this->asUser($lead)
        ->getJson('/api/reports/summary')
        ->assertOk()
        ->assertJsonStructure(['csat' => ['available', 'reason']])
        ->assertJsonPath('csat.available', false)
        ->assertJsonPath('csat.reason', 'not_collected');
});
