<?php

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $this->customer = Customer::factory()->create();
});

function newTicket(array $overrides = []): array
{
    return array_merge([
        'subject' => 'Printer down',
        'description' => 'It will not print.',
        'customer_id' => null,
        'priority' => Priority::Normal->value,
        'category' => 'general',
        'channel' => 'email',
    ], $overrides);
}

it('sends a ticket created without an assignee to the least-loaded active agent', function () {
    $busy = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $idle = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    Ticket::factory()->count(3)->create([
        'assigned_to' => $busy->id,
        'status' => TicketStatus::Open->value,
    ]);

    $this->asUser($this->admin)
        ->postJson('/api/tickets', newTicket(['customer_id' => $this->customer->id]))
        ->assertCreated()
        ->assertJsonPath('data.assignee.id', $idle->id);
});

it('lets an explicit assignee win over the rule', function () {
    $idle = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $chosen = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    Ticket::factory()->count(5)->create(['assigned_to' => $chosen->id, 'status' => TicketStatus::Open->value]);

    $this->asUser($this->admin)
        ->postJson('/api/tickets', newTicket([
            'customer_id' => $this->customer->id,
            'assigned_to' => $chosen->id,
        ]))
        ->assertCreated()
        ->assertJsonPath('data.assignee.id', $chosen->id);

    expect($idle->assignedTickets()->count())->toBe(0);
});

it('never chooses an inactive agent', function () {
    User::factory()->create(['role' => UserRole::Agent, 'is_active' => false]);

    $this->asUser($this->admin)
        ->postJson('/api/tickets', newTicket(['customer_id' => $this->customer->id]))
        ->assertCreated()
        ->assertJsonPath('data.assignee', null);
});

it('never auto-assigns a team lead', function () {
    // A Team Lead is the escalation TARGET; auto-assigning new work to them
    // would defeat the escalation path.
    User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);

    $this->asUser($this->admin)
        ->postJson('/api/tickets', newTicket(['customer_id' => $this->customer->id]))
        ->assertCreated()
        ->assertJsonPath('data.assignee', null);
});

it('leaves the ticket unassigned with a 201 when no active agent exists', function () {
    $id = $this->asUser($this->admin)
        ->postJson('/api/tickets', newTicket(['customer_id' => $this->customer->id]))
        ->assertCreated()
        ->json('data.id');

    expect(Ticket::find($id)->assigned_to)->toBeNull();
});

it('writes an auto_assigned event to ticket_events and never to audit_logs', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $id = $this->asUser($this->admin)
        ->postJson('/api/tickets', newTicket(['customer_id' => $this->customer->id]))
        ->assertCreated()
        ->json('data.id');

    $event = TicketEvent::where('ticket_id', $id)->where('event', 'auto_assigned')->first();

    expect($event)->not->toBeNull();
    expect($event->new_value)->toBe((string) $agent->id);
    expect($event->field)->toBe('assigned_to');

    // The ticket lifecycle lives in ticket_events only — never audit_logs.
    expect(DB::table('audit_logs')->where('action', 'like', '%auto_assign%')->count())->toBe(0);
});

it('spreads four tickets across four idle agents', function () {
    // Without the least-recently-assigned tiebreak, four agents at zero load
    // always return the lowest id and all four tickets land on one person.
    $agents = User::factory()->count(4)->create(['role' => UserRole::Agent, 'is_active' => true]);

    for ($i = 0; $i < 4; $i++) {
        $this->asUser($this->admin)
            ->postJson('/api/tickets', newTicket([
                'customer_id' => $this->customer->id,
                'subject' => "Ticket {$i}",
            ]))
            ->assertCreated();
    }

    $loads = $agents->map(fn (User $a) => $a->assignedTickets()->count())->sort()->values()->all();

    expect($loads)->toBe([1, 1, 1, 1]);
});
