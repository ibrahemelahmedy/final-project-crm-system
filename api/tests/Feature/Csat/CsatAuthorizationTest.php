<?php

use App\Enums\UserRole;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

it('denies an agent who cannot view the ticket its survey', function () {
    $owner = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $other = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($owner)->create();
    CsatSurvey::factory()->for($ticket)->create();

    $this->asUser($other)->getJson('/api/tickets/'.$ticket->id.'/csat')->assertForbidden();
});

it('returns the survey plus a share_url to an agent who can view the ticket', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->create();
    CsatSurvey::factory()->for($ticket)->create();

    $this->asUser($lead)->getJson('/api/tickets/'.$ticket->id.'/csat')
        ->assertOk()
        ->assertJsonPath('state', 'outstanding')
        ->assertJsonStructure(['state', 'share_url', 'resolution_cycle']);
});

it('exposes no route that edits or deletes a submitted response', function () {
    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($r) => str_contains($r->uri(), 'csat'))
        ->map(fn ($r) => $r->methods())
        ->flatten()
        ->unique()
        ->values();

    expect($routes->contains('PUT'))->toBeFalse();
    expect($routes->contains('PATCH'))->toBeFalse();
    expect($routes->contains('DELETE'))->toBeFalse();
});
