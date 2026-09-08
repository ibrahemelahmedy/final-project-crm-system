<?php

use App\Enums\UserRole;
use App\Mail\CsatInvitationMail;
use App\Models\CsatSurvey;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\User;
use App\Services\CsatShareLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

function invitationResolve(User $actor, Ticket $ticket): void
{
    test()->asUser($actor)
        ->patchJson('/api/tickets/'.$ticket->id, ['status' => 'resolved'])
        ->assertOk();
}

function invitationOpenTicket(User $agent, ?Customer $customer = null): Ticket
{
    return Ticket::factory()
        ->assignedTo($agent)
        ->create(['status' => 'open', 'customer_id' => ($customer ?? Customer::factory()->create())->id]);
}

it('sends exactly one invitation to the customer when a ticket is resolved', function () {
    Mail::fake();
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $customer = Customer::factory()->create(['email' => 'cust@example.com']);
    $ticket = invitationOpenTicket($agent, $customer);

    invitationResolve($agent, $ticket);

    Mail::assertSent(CsatInvitationMail::class, 1);
    Mail::assertSent(CsatInvitationMail::class, fn ($m) => $m->hasTo('cust@example.com'));
});

it('sends nothing when the ticket customer has no email', function () {
    Mail::fake();
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $customer = Customer::factory()->withoutEmail()->create();
    $ticket = invitationOpenTicket($agent, $customer);

    invitationResolve($agent, $ticket);

    expect(CsatSurvey::where('ticket_id', $ticket->id)->count())->toBe(1);
    Mail::assertNothingSent();
});

it('sends nothing on a re-resolve while the survey is outstanding', function () {
    Mail::fake();
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = invitationOpenTicket($agent);

    invitationResolve($agent, $ticket);
    test()->asUser($agent)->patchJson('/api/tickets/'.$ticket->id, ['status' => 'open'])->assertOk();
    invitationResolve($agent, $ticket->fresh());

    Mail::assertSent(CsatInvitationMail::class, 1);
});

it('stops sending past the per-request cap but still creates every survey', function () {
    Mail::fake();
    config(['mail.csat.max_per_request' => 2]);
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);

    $tickets = collect(range(1, 5))->map(fn () => invitationOpenTicket($lead));

    test()->asUser($lead)
        ->postJson('/api/tickets/bulk', [
            'ids' => $tickets->pluck('id')->all(),
            'action' => 'status',
            'status' => 'resolved',
        ])
        ->assertOk();

    expect(CsatSurvey::whereIn('ticket_id', $tickets->pluck('id'))->count())->toBe(5);
    Mail::assertSent(CsatInvitationMail::class, 2);
});

it('carries the same signed link path the agent-facing endpoint mints', function () {
    Mail::fake();
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = invitationOpenTicket($agent);

    invitationResolve($agent, $ticket);

    $survey = CsatSurvey::where('ticket_id', $ticket->id)->firstOrFail();
    $expectedPath = parse_url(app(CsatShareLink::class)->for($survey), PHP_URL_PATH);

    Mail::assertSent(CsatInvitationMail::class, function ($m) use ($expectedPath) {
        return parse_url($m->url, PHP_URL_PATH) === $expectedPath
            && str_contains($m->url, $expectedPath);
    });
});

it('does not fail the resolve when the invitation cannot be built or sent', function () {
    Mail::fake();
    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = invitationOpenTicket($agent);

    app()->bind(CsatShareLink::class, function () {
        throw new RuntimeException('link service down');
    });

    invitationResolve($agent, $ticket);

    expect(CsatSurvey::where('ticket_id', $ticket->id)->count())->toBe(1);
});
