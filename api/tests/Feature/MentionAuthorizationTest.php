<?php

use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('rejects a mention of a user who cannot view the ticket with a 422 naming them, and creates no message', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $outsider = User::factory()->create(['name' => 'Outside Agent', 'role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->create(['assigned_to' => $agent->id]); // outsider fails TicketPolicy::view

    $before = TicketMessage::count();

    $response = $this->asUser($agent)
        ->postJson("/api/tickets/{$ticket->id}/messages", [
            'body' => 'Checked the logs @Outside Agent can you confirm?',
            'visibility' => 'internal',
            'mentions' => [$outsider->id],
        ])
        ->assertStatus(422);

    expect($response->json('errors.mentions.0'))->toContain('Outside Agent');
    expect(TicketMessage::count())->toBe($before); // no partial insert
});

it('creates the mention row, a ticket-history entry, and one mention notification for a valid mention', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $colleague = User::factory()->create(['name' => 'Colleague Lead', 'role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->create();

    $response = $this->asUser($lead)
        ->postJson("/api/tickets/{$ticket->id}/messages", [
            'body' => 'CVV mismatch confirmed @Colleague Lead can you verify?',
            'visibility' => 'internal',
            'mentions' => [$colleague->id],
        ])
        ->assertCreated();

    $messageId = $response->json('data.id');

    expect(\App\Models\TicketMessage::find($messageId)->mentions()->pluck('users.id'))->toContain($colleague->id);
    expect(TicketEvent::where('ticket_id', $ticket->id)->where('event', 'mentioned')->where('new_value', (string) $colleague->id)->exists())->toBeTrue();
    expect(Notification::where('user_id', $colleague->id)->where('type', 'mention')->count())->toBe(1);
});

it('excludes a deactivated user from mentionable-users and rejects mentioning them on submit', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $deactivated = User::factory()->create(['name' => 'Gone User', 'role' => UserRole::TeamLead, 'is_active' => false]);
    $ticket = Ticket::factory()->create(['assigned_to' => $agent->id]);

    $mentionable = $this->asUser($agent)
        ->getJson("/api/tickets/{$ticket->id}/mentionable-users")
        ->assertOk()
        ->json('data');

    expect(collect($mentionable)->pluck('id'))->not->toContain($deactivated->id);

    $this->asUser($agent)
        ->postJson("/api/tickets/{$ticket->id}/messages", [
            'body' => 'note @Gone User',
            'visibility' => 'internal',
            'mentions' => [$deactivated->id],
        ])
        ->assertStatus(422);
});
