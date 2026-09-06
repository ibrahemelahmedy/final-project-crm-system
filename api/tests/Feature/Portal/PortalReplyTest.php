<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Notification;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('bumps updated_at, writes a replied event, and updates last_contact_at on an open ticket', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $customer = Customer::factory()->create(['last_contact_at' => now()->subDays(3)]);
    PortalSession::factory()->for($customer)->withToken('reply-token')->create();
    $ticket = Ticket::factory()->create([
        'customer_id' => $customer->id, 'status' => 'open', 'assigned_to' => $agent->id,
    ]);
    $originalUpdatedAt = $ticket->updated_at;

    $this->travel(1)->minutes();

    $this->asToken('reply-token')
        ->postJson("/api/portal/requests/{$ticket->id}/messages", ['body' => 'Any update on this?'])
        ->assertOk();

    $ticket->refresh();
    expect($ticket->updated_at->gt($originalUpdatedAt))->toBeTrue();
    expect(\App\Models\TicketEvent::where('ticket_id', $ticket->id)->where('event', 'replied')->exists())->toBeTrue();
    expect($customer->fresh()->last_contact_at->gt(now()->subDays(3)))->toBeTrue();

    expect(Notification::where('user_id', $agent->id)->where('type', 'customer_replied')->exists())->toBeTrue();
});

it('reopens a resolved ticket, clears resolved_at, and writes a status_changed event', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('reopen-token')->create();
    $ticket = Ticket::factory()->create([
        'customer_id' => $customer->id, 'status' => 'resolved', 'resolved_at' => now()->subDay(),
    ]);

    $this->asToken('reopen-token')
        ->postJson("/api/portal/requests/{$ticket->id}/messages", ['body' => 'Still broken'])
        ->assertOk()
        ->assertJsonPath('status', 'open');

    $ticket->refresh();
    expect($ticket->status->value)->toBe('open');
    expect($ticket->resolved_at)->toBeNull();
    expect(\App\Models\TicketEvent::where('ticket_id', $ticket->id)->where('event', 'status_changed')->exists())->toBeTrue();
    expect(\App\Models\TicketEvent::where('ticket_id', $ticket->id)->where('event', 'reopened')->exists())->toBeTrue();
});

it('rejects a reply on a closed ticket with 422 and writes nothing', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('closed-token')->create();
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'closed']);
    $messageCountBefore = $ticket->messages()->count();

    $this->asToken('closed-token')
        ->postJson("/api/portal/requests/{$ticket->id}/messages", ['body' => 'hello'])
        ->assertStatus(422);

    expect($ticket->messages()->count())->toBe($messageCountBefore);
});
