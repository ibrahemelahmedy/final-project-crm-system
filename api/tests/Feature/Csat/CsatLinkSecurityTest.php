<?php

use App\Models\CsatSurvey;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;

uses(RefreshDatabase::class);

it('renders the same invalid state for unsigned, tampered, unknown, and expired links — never a 500', function () {
    $survey = CsatSurvey::factory()->create();
    $expired = CsatSurvey::factory()->expired()->create();

    $signed = URL::temporarySignedRoute('csat.show', now()->addDays(30), ['uuid' => $survey->uuid]);

    // 1. unsigned
    $this->getJson('/api/csat/'.$survey->uuid)
        ->assertOk()->assertJsonPath('state', 'expired');

    // 2. tampered signature
    $this->getJson($signed.'x')
        ->assertOk()->assertJsonPath('state', 'expired');

    // 3. unknown uuid (validly signed)
    $unknown = URL::temporarySignedRoute('csat.show', now()->addDays(30), ['uuid' => 'ffffffff-ffff-ffff-ffff-ffffffffffff']);
    $this->getJson($unknown)
        ->assertOk()->assertJsonPath('state', 'expired');

    // 4. genuinely expired row
    $this->getJson(URL::temporarySignedRoute('csat.show', now()->addDay(), ['uuid' => $expired->uuid]))
        ->assertOk()->assertJsonPath('state', 'expired');
});

it('leaks none of internal notes, assignee, customer email, or ticket history in the public body', function () {
    $ticket = Ticket::factory()->create(['subject' => 'Login broken']);
    $survey = CsatSurvey::factory()->for($ticket)->answered(5, 'thanks')->create();

    $body = $this->getJson(URL::temporarySignedRoute('csat.show', $survey->expires_at, ['uuid' => $survey->uuid]))
        ->assertOk()->json();

    expect(array_keys($body))->toBe(['state', 'ticket', 'rating', 'comment', 'responded_at']);
    expect($body['ticket'])->toHaveKeys(['number', 'subject']);
    expect($body)->not->toHaveKey('assignee');
    expect(json_encode($body))->not->toContain('@');
});
