<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

/**
 * The intake's fifth acceptance criterion, and the highest-value test in this
 * story: a rule edit applies GOING FORWARD ONLY.
 *
 * This holds structurally, not by convention — every due date is an absolute
 * timestamp written once at ticket creation, and nothing in SlaClock's read
 * path (riskFor / minutesLeft / snapshot) ever reads a SlaRule.
 */
it('leaves every existing ticket untouched when a rule is edited', function () {
    Carbon::setTestNow('2026-08-01 09:00:00');

    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $rule = SlaRule::factory()->create([
        'priority' => Priority::Urgent->value,
        'first_response_minutes' => 15,
        'resolution_minutes' => 240,
        'at_risk_threshold_pct' => 80,
    ]);

    $ticket = Ticket::factory()->create([
        'priority' => Priority::Urgent->value,
        'status' => TicketStatus::Open->value,
    ]);
    app(SlaClock::class)->applyTo($ticket);
    $ticket->save();

    $before = [
        'resolution_due_at' => $ticket->resolution_due_at->copy(),
        'sla_at_risk_at' => $ticket->sla_at_risk_at->copy(),
        'first_response_due_at' => $ticket->first_response_due_at->copy(),
    ];
    $riskBefore = app(SlaClock::class)->riskFor($ticket);

    // Slash the target from four hours to thirty minutes.
    $this->asUser($admin)
        ->patchJson("/api/sla-rules/{$rule->id}", ['resolution_minutes' => 30])
        ->assertOk();

    $reloaded = $ticket->fresh();

    foreach ($before as $field => $original) {
        expect($reloaded->{$field}->equalTo($original))
            ->toBeTrue("{$field} must not move when the rule is edited");
    }

    // A fresh clock instance, so the per-request rule memo cannot mask a re-read.
    expect((new SlaClock)->riskFor($reloaded))->toBe($riskBefore);

    Carbon::setTestNow();
});

it('gives a newly created ticket the edited target', function () {
    Carbon::setTestNow('2026-08-01 09:00:00');

    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $customer = Customer::factory()->create();
    $rule = SlaRule::factory()->create([
        'priority' => Priority::Urgent->value,
        'first_response_minutes' => 15,
        'resolution_minutes' => 240,
    ]);

    $this->asUser($admin)->patchJson("/api/sla-rules/{$rule->id}", ['resolution_minutes' => 30])->assertOk();

    $id = $this->asUser($admin)->postJson('/api/tickets', [
        'subject' => 'After the edit',
        'description' => 'x',
        'customer_id' => $customer->id,
        'priority' => Priority::Urgent->value,
        'category' => 'general',
        'channel' => 'email',
    ])->assertCreated()->json('data.id');

    $fresh = Ticket::find($id);

    expect($fresh->resolution_due_at->equalTo($fresh->created_at->copy()->addMinutes(30)))->toBeTrue();

    Carbon::setTestNow();
});
