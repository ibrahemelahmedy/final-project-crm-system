<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    Carbon::setTestNow('2026-08-01 09:00:00');
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

afterEach(function () {
    Carbon::setTestNow();
});

function stamped(array $overrides = []): Ticket
{
    $ticket = Ticket::factory()->create(array_merge([
        'status' => TicketStatus::Open->value,
        'priority' => Priority::Urgent->value,
    ], $overrides));

    app(SlaClock::class)->applyTo($ticket);
    $ticket->save();

    return $ticket->fresh();
}

/**
 * The Story 04 contract guard. TicketSla in TypeScript and SlaCell.tsx are
 * written against exactly these three keys in exactly this order; a fourth key
 * here is forbidden.
 */
it('returns an sla block with exactly three keys named due_at, minutes_left and risk', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);
    $ticket = stamped();

    $sla = $this->asUser($this->admin)
        ->getJson("/api/tickets/{$ticket->id}")
        ->assertOk()
        ->json('data.sla');

    expect(array_keys($sla))->toBe(['due_at', 'minutes_left', 'risk']);
});

it('keeps the three keys even when the tier has no rule', function () {
    $ticket = stamped(['priority' => Priority::Low->value]);

    $sla = $this->asUser($this->admin)
        ->getJson("/api/tickets/{$ticket->id}")
        ->assertOk()
        ->json('data.sla');

    expect(array_keys($sla))->toBe(['due_at', 'minutes_left', 'risk']);
    expect($sla['risk'])->toBeNull();
});

it('emits only breached, at_risk, ok or null for every ticket on a mixed page', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);
    SlaRule::factory()->create(['priority' => Priority::High->value, 'resolution_minutes' => 480]);

    stamped();
    stamped(['priority' => Priority::High->value]);
    stamped(['priority' => Priority::Low->value]);          // no rule
    stamped(['status' => TicketStatus::Resolved->value]);

    $risks = $this->asUser($this->admin)->getJson('/api/tickets')->assertOk()->json('data.*.sla.risk');

    foreach ($risks as $risk) {
        expect($risk)->toBeIn(['breached', 'at_risk', 'ok', null]);
    }
});

it('reports a negative minutes_left on a breached ticket', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);
    $ticket = stamped();

    Carbon::setTestNow($ticket->created_at->copy()->addMinutes(300));

    $sla = $this->asUser($this->admin)
        ->getJson("/api/tickets/{$ticket->id}")
        ->assertOk()
        ->json('data.sla');

    expect($sla['risk'])->toBe('breached');
    expect($sla['minutes_left'])->toBeLessThan(0);
});

it('issues no additional query for the sla block on a page of 25 tickets', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value, 'resolution_minutes' => 240]);

    for ($i = 0; $i < 25; $i++) {
        stamped();
    }

    $count = 0;
    DB::listen(function () use (&$count) {
        $count++;
    });

    $this->asUser($this->admin)->getJson('/api/tickets')->assertOk()->assertJsonCount(25, 'data');
    $withRules = $count;

    // The same page with every rule deleted: snapshot() reads only ticket
    // columns, so removing the rules cannot change the query count.
    SlaRule::query()->delete();
    $count = 0;
    $this->asUser($this->admin)->getJson('/api/tickets')->assertOk();

    expect($withRules)->toBe($count);
});
