<?php

use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

/**
 * The test that prevents a divergent second SLA implementation: the reports
 * compliance/breach figures must equal what Story 06's SlaClock returns for
 * the same range — asserted against the service, not a hand-computed constant.
 */
it('matches SlaClock::complianceBetween for the same window', function () {
    SlaRule::factory()->forPriority(Priority::High->value, 60, 80)->create();
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $clock = app(SlaClock::class);

    // One compliant (resolved fast) and one breached (resolved late). Targets
    // are stamped the way TicketController@store stamps them — after the row
    // exists, so created_at is a real anchor.
    $compliant = Ticket::factory()->create(['priority' => Priority::High->value, 'assigned_to' => $lead->id, 'status' => 'resolved']);
    $compliant->forceFill(['created_at' => now()->subDays(3), 'resolved_at' => now()->subDays(3)->addMinutes(30)]);
    $clock->applyTo($compliant);
    $compliant->save();

    $breached = Ticket::factory()->create(['priority' => Priority::High->value, 'assigned_to' => $lead->id, 'status' => 'resolved']);
    $breached->forceFill(['created_at' => now()->subDays(3), 'resolved_at' => now()->subDays(3)->addHours(5)]);
    $clock->applyTo($breached);
    $breached->save();

    [$from, $to] = [Carbon::now()->subDays(29)->startOfDay(), Carbon::now()->endOfDay()];
    $expected = $clock->complianceBetween($from, $to);

    $res = $this->asUser($lead)->getJson('/api/reports/summary')->assertOk();

    expect($res->json('sla.compliance_rate'))->toEqual($expected['compliance_rate']);
    expect($res->json('sla.breach_rate'))->toEqual($expected['breach_rate']);
    expect($res->json('sla.avg_resolution_minutes'))->toEqual($expected['avg_resolution_minutes']);
    expect((float) $res->json('sla.breach_rate'))->toBe(50.0);
});
