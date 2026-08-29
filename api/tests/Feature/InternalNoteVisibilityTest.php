<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The critical test (plan Test Plan item 6). Asserted against the QUERY
 * RESULT, not rendered HTML — the split is a `WHERE`, never a CSS class.
 */
it('excludes an internal note from the public-only scope and every customer-facing query, but includes it for an authenticated agent', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->create(['assigned_to' => $agent->id]);

    $publicMessage = TicketMessage::factory()->create([
        'ticket_id' => $ticket->id,
        'visibility' => 'public',
    ]);
    $internalNote = TicketMessage::factory()->create([
        'ticket_id' => $ticket->id,
        'visibility' => 'internal',
    ]);

    // THE enforcement point every customer-facing render path must use.
    $publicOnlyIds = TicketMessage::query()->publicOnly()->where('ticket_id', $ticket->id)->pluck('id');
    expect($publicOnlyIds)->toContain($publicMessage->id)
        ->and($publicOnlyIds)->not->toContain($internalNote->id);

    // The authenticated agent thread (this app's only message index) shows
    // BOTH — an internal note belongs in the one chronological thread,
    // visually distinct, never fragmented into a second feed.
    $response = $this->asUser($agent)
        ->getJson("/api/tickets/{$ticket->id}/messages")
        ->assertOk();

    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($publicMessage->id)->and($ids)->toContain($internalNote->id);
});

it('creates a message with visibility=internal via the store endpoint and it is absent from publicOnly()', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->create(['assigned_to' => $agent->id]);

    $response = $this->asUser($agent)
        ->postJson("/api/tickets/{$ticket->id}/messages", [
            'body' => 'Internal-only detail about the payment gateway.',
            'visibility' => 'internal',
        ])
        ->assertCreated();

    $id = $response->json('data.id');

    expect(TicketMessage::query()->publicOnly()->whereKey($id)->exists())->toBeFalse();
    expect(TicketMessage::find($id)->visibility->value)->toBe('internal');
});

it('defaults a message to public visibility when the field is omitted', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->create(['assigned_to' => $agent->id]);

    $response = $this->asUser($agent)
        ->postJson("/api/tickets/{$ticket->id}/messages", ['body' => 'Sure, happy to help!'])
        ->assertCreated();

    expect(TicketMessage::find($response->json('data.id'))->visibility->value)->toBe('public');
});
