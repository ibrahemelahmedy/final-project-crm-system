<?php

use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\SlaRule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

function validRulePayload(array $overrides = []): array
{
    return array_merge([
        'priority' => Priority::Urgent->value,
        'first_response_minutes' => 15,
        'resolution_minutes' => 240,
        'at_risk_threshold_pct' => 80,
        'notify_on_breach' => true,
        'escalation_enabled' => true,
        'escalate_after_minutes' => 30,
        'escalate_to_role' => UserRole::Administrator->value,
        'auto_close_after_days' => 5,
    ], $overrides);
}

it('lets an administrator list, create, update and delete rules', function () {
    $create = $this->asUser($this->admin)
        ->postJson('/api/sla-rules', validRulePayload())
        ->assertCreated()
        ->assertJsonPath('data.priority', 'urgent')
        ->assertJsonPath('data.breach_action_label', 'Notify Team Lead + escalate to Administrator');

    $id = $create->json('data.id');

    $this->asUser($this->admin)->getJson('/api/sla-rules')->assertOk()->assertJsonCount(1, 'data');

    $this->asUser($this->admin)
        ->patchJson("/api/sla-rules/{$id}", ['resolution_minutes' => 300])
        ->assertOk()
        ->assertJsonPath('data.resolution_minutes', 300);

    $this->asUser($this->admin)->deleteJson("/api/sla-rules/{$id}")->assertStatus(204);
    expect(SlaRule::count())->toBe(0);
});

it('gives an agent 403 on every sla-rules route', function () {
    $rule = SlaRule::factory()->create();

    $this->asUser($this->agent)->getJson('/api/sla-rules')->assertForbidden();
    $this->asUser($this->agent)->postJson('/api/sla-rules', validRulePayload())->assertForbidden();
    $this->asUser($this->agent)->patchJson("/api/sla-rules/{$rule->id}", ['resolution_minutes' => 99])->assertForbidden();
    $this->asUser($this->agent)->deleteJson("/api/sla-rules/{$rule->id}")->assertForbidden();
});

it('gives a team lead 403 on every sla-rules route', function () {
    $rule = SlaRule::factory()->create();

    $this->asUser($this->lead)->getJson('/api/sla-rules')->assertForbidden();
    $this->asUser($this->lead)->postJson('/api/sla-rules', validRulePayload())->assertForbidden();
    $this->asUser($this->lead)->patchJson("/api/sla-rules/{$rule->id}", ['resolution_minutes' => 99])->assertForbidden();
    $this->asUser($this->lead)->deleteJson("/api/sla-rules/{$rule->id}")->assertForbidden();
});

it('rejects a second rule for the same priority with 422', function () {
    SlaRule::factory()->create(['priority' => Priority::Urgent->value]);

    $this->asUser($this->admin)
        ->postJson('/api/sla-rules', validRulePayload())
        ->assertStatus(422)
        ->assertJsonValidationErrors('priority');
});

it('rejects a resolution target shorter than the response target with 422', function () {
    $this->asUser($this->admin)
        ->postJson('/api/sla-rules', validRulePayload([
            'first_response_minutes' => 240,
            'resolution_minutes' => 60,
        ]))
        ->assertStatus(422)
        // Byte-identical to the client's Zod copy.
        ->assertJsonPath(
            'errors.resolution_minutes.0',
            'The resolution target must be longer than the response target.'
        );
});

it('rejects escalation enabled without a target role', function () {
    $this->asUser($this->admin)
        ->postJson('/api/sla-rules', validRulePayload([
            'escalation_enabled' => true,
            'escalate_to_role' => null,
        ]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('escalate_to_role');
});

it('rejects agent as an escalation target', function () {
    // Escalating to an agent is a lateral move, not an escalation.
    $this->asUser($this->admin)
        ->postJson('/api/sla-rules', validRulePayload(['escalate_to_role' => UserRole::Agent->value]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('escalate_to_role');
});

it('rejects an at-risk threshold of 0 or 100', function () {
    // 0 makes every ticket instantly at risk; 100 puts the boundary at the
    // breach, so at_risk would never be reachable.
    $this->asUser($this->admin)
        ->postJson('/api/sla-rules', validRulePayload(['at_risk_threshold_pct' => 0]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('at_risk_threshold_pct');

    $this->asUser($this->admin)
        ->postJson('/api/sla-rules', validRulePayload(['at_risk_threshold_pct' => 100]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('at_risk_threshold_pct');
});

it('returns rules urgent first', function () {
    foreach ([Priority::Low, Priority::Normal, Priority::Urgent, Priority::High] as $p) {
        SlaRule::factory()->create(['priority' => $p->value]);
    }

    $order = $this->asUser($this->admin)->getJson('/api/sla-rules')->assertOk()->json('data.*.priority');

    expect($order)->toBe(['urgent', 'high', 'normal', 'low']);
});

it('shows deactivated rules so an administrator can reactivate one', function () {
    SlaRule::factory()->create(['priority' => Priority::High->value, 'is_active' => false]);

    $this->asUser($this->admin)->getJson('/api/sla-rules')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.is_active', false);
});

it('requires authentication', function () {
    $this->getJson('/api/sla-rules')->assertStatus(401);
});
