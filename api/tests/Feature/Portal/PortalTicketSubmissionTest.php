<?php

use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\PortalSession;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// A portal ticket is created at Priority::Normal (Story 06 owns SLA rules;
// seeded here so SlaClock::applyTo() has a rule to stamp from).
beforeEach(fn () => SlaRule::factory()->create([
    'priority' => Priority::Normal->value,
    'first_response_minutes' => 240,
    'resolution_minutes' => 1440,
]));

it('creates an open web_form ticket with no agent involvement and appears in the staff queue', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('submit-token')->create();

    $res = $this->asToken('submit-token')->postJson('/api/portal/requests', [
        'subject' => 'My internet is down',
        'description' => 'It has been down since this morning.',
        'category' => 'technical',
    ])->assertStatus(201);

    $ticketId = $res->json('id');
    $ticket = Ticket::findOrFail($ticketId);

    expect($ticket->channel->value)->toBe('web_form');
    expect($ticket->status->value)->toBe('open');
    expect($ticket->created_by)->toBeNull();
    expect($ticket->customer_id)->toBe($customer->id);

    $firstMessage = TicketMessage::where('ticket_id', $ticket->id)->orderBy('id')->first();
    expect($firstMessage->author_type)->toBe(TicketMessage::AUTHOR_CUSTOMER);
    expect($firstMessage->body)->toBe('It has been down since this morning.');

    expect(\App\Models\TicketEvent::where('ticket_id', $ticket->id)->where('event', 'created')->exists())->toBeTrue();

    // SLA columns stamped.
    expect($ticket->resolution_due_at)->not->toBeNull();

    // Visible to a staff caller — the internal-facing half of AC2.
    $staffView = $this->asUser($agent)->getJson('/api/tickets')->assertOk();
    expect(collect($staffView->json('data'))->pluck('id'))->toContain($ticket->id);
});

it('ignores priority, assigned_to, customer_id, and channel sent in the body', function () {
    $other = Customer::factory()->create();
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('ignore-token')->create();
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $res = $this->asToken('ignore-token')->postJson('/api/portal/requests', [
        'subject' => 'Test',
        'description' => 'Body',
        'category' => 'general',
        'priority' => 'urgent',
        'assigned_to' => $agent->id,
        'customer_id' => $other->id,
        'channel' => 'chat',
    ])->assertStatus(201);

    $ticket = Ticket::findOrFail($res->json('id'));

    expect($ticket->customer_id)->toBe($customer->id);
    expect($ticket->channel->value)->toBe('web_form');
    expect($ticket->priority->value)->not->toBe('urgent');
});
