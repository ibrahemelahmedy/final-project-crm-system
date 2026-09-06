<?php

use App\Models\Customer;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The highest-consequence test in this story (plan Test Plan item 8).
 */
it('never leaks an internal note through the portal thread', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('leak-token')->create();
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id]);

    $public = TicketMessage::factory()->create([
        'ticket_id' => $ticket->id,
        'customer_id' => $customer->id,
        'visibility' => 'public',
        'body' => 'Public message body',
    ]);
    $internal = TicketMessage::factory()->create([
        'ticket_id' => $ticket->id,
        'visibility' => 'internal',
        'body' => 'SECRET internal-only detail',
    ]);

    $res = $this->asToken('leak-token')->getJson("/api/portal/requests/{$ticket->id}")->assertOk();

    $messageIds = collect($res->json('messages'))->pluck('id');
    expect($messageIds)->toContain($public->id)->and($messageIds)->not->toContain($internal->id);
    expect($res->json('ticket.message_count'))->toBe(1);

    $raw = $res->getContent();
    expect($raw)->not->toContain('SECRET internal-only detail');
    expect($raw)->not->toContain('"visibility"');
});

it('carries no sla, priority, assigned_to, or created_by key on PortalTicketResource', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('shape-token')->create();
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id]);

    $res = $this->asToken('shape-token')->getJson("/api/portal/requests/{$ticket->id}")->assertOk();

    $keys = array_keys($res->json('ticket'));
    expect($keys)->not->toContain('sla')
        ->and($keys)->not->toContain('priority')
        ->and($keys)->not->toContain('assigned_to')
        ->and($keys)->not->toContain('created_by');
});
