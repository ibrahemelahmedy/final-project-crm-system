<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\CsatSurvey;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * AC7 / Decision 2: the portal coexists with, never supersedes, WIS-14's
 * signed-link CSAT flow.
 */
it('exposes feedback_url for an outstanding survey and null otherwise', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('csat-token')->create();

    $withSurvey = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'resolved']);
    CsatSurvey::factory()->for($withSurvey)->create();

    $answered = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'resolved']);
    CsatSurvey::factory()->for($answered)->answered()->create();

    $none = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'resolved']);

    $withSurveyRes = $this->asToken('csat-token')->getJson("/api/portal/requests/{$withSurvey->id}")->assertOk();
    $answeredRes = $this->asToken('csat-token')->getJson("/api/portal/requests/{$answered->id}")->assertOk();
    $noneRes = $this->asToken('csat-token')->getJson("/api/portal/requests/{$none->id}")->assertOk();

    expect($withSurveyRes->json('ticket.feedback_url'))->toBeString()->toContain('/feedback/');
    expect($answeredRes->json('ticket.feedback_url'))->toBeNull();
    expect($noneRes->json('ticket.feedback_url'))->toBeNull();
});

it('mints a byte-identical link to the agent-facing endpoint for the same survey', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('same-link-token')->create();

    $ticket = Ticket::factory()->create([
        'customer_id' => $customer->id, 'status' => 'resolved', 'assigned_to' => $agent->id,
    ]);
    $survey = CsatSurvey::factory()->for($ticket)->create();

    $portalUrl = $this->asToken('same-link-token')
        ->getJson("/api/portal/requests/{$ticket->id}")
        ->assertOk()
        ->json('ticket.feedback_url');

    $agentUrl = $this->asUser($agent)
        ->getJson("/api/tickets/{$ticket->id}/csat")
        ->assertOk()
        ->json('share_url');

    // Both mint a fresh signature at request time, so compare everything
    // BEFORE the signature/expires query params, which is what
    // CsatShareLink::for() controls deterministically.
    expect(strtok($portalUrl, '?'))->toBe(strtok($agentUrl, '?'));
});

it('creates no csat_surveys row from any portal action', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('no-write-token')->create();
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'resolved']);
    CsatSurvey::factory()->for($ticket)->create();

    $before = CsatSurvey::count();

    $this->asToken('no-write-token')->getJson("/api/portal/requests/{$ticket->id}")->assertOk();
    $this->asToken('no-write-token')->getJson('/api/portal/requests?scope=past')->assertOk();

    expect(CsatSurvey::count())->toBe($before);
});
