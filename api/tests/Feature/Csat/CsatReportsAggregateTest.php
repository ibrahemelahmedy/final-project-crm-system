<?php

use App\Enums\UserRole;
use App\Models\CsatSurvey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('renders a real CSAT average from csat_surveys, keeping Story 12 keys', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    CsatSurvey::factory()->create(['resolved_by' => $agent->id, 'resolved_at' => now()->subDays(2), 'rating' => 5, 'responded_at' => now()->subDay()]);
    CsatSurvey::factory()->create(['resolved_by' => $agent->id, 'resolved_at' => now()->subDays(3), 'rating' => 3, 'responded_at' => now()->subDay()]);
    // unrated survey is ignored by the aggregate
    CsatSurvey::factory()->create(['resolved_by' => $agent->id, 'resolved_at' => now()->subDays(1)]);

    $this->asUser($lead)->getJson('/api/reports/summary?from='.now()->subDays(7)->toDateString().'&to='.now()->toDateString())
        ->assertOk()
        ->assertJsonPath('csat.available', true)
        ->assertJsonPath('csat.average', 4)
        ->assertJsonPath('csat.response_count', 2);
});

it('renders the Empty marker for a period with zero responses — never a score of 0', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);

    CsatSurvey::factory()->create(['resolved_at' => now()->subYear(), 'rating' => 1, 'responded_at' => now()->subYear()]);

    $this->asUser($lead)->getJson('/api/reports/summary?from='.now()->subDays(7)->toDateString().'&to='.now()->toDateString())
        ->assertOk()
        ->assertJsonPath('csat.available', false)
        ->assertJsonPath('csat.reason', 'not_collected');
});
