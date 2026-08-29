<?php

use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
});

it('reports source_available false and omits link_to when the source ticket was deleted', function () {
    $ticket = Ticket::factory()->create(['assigned_to' => $this->agent->id]);
    $notification = Notification::factory()->for($this->agent, 'user')->create([
        'source_type' => $ticket->getMorphClass(),
        'source_id' => $ticket->id,
        'link_to' => "/tickets/{$ticket->id}",
    ]);
    $ticket->delete();

    $response = $this->asUser($this->agent)->getJson('/api/notifications');

    $response->assertOk();
    $row = collect($response->json('data'))->firstWhere('id', $notification->id);
    expect($row['source_available'])->toBeFalse();
    expect($row['link_to'])->toBeNull();
});

it('reports source_available false when the source fails the recipients policy check', function () {
    // Assigned to a DIFFERENT agent and not a team lead/administrator, so
    // TicketPolicy::view denies this recipient.
    $otherAgent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->create(['assigned_to' => $otherAgent->id]);
    $notification = Notification::factory()->for($this->agent, 'user')->create([
        'source_type' => $ticket->getMorphClass(),
        'source_id' => $ticket->id,
        'link_to' => "/tickets/{$ticket->id}",
    ]);

    $response = $this->asUser($this->agent)->getJson('/api/notifications');

    $response->assertOk();
    $row = collect($response->json('data'))->firstWhere('id', $notification->id);
    expect($row['source_available'])->toBeFalse();
    expect($row['link_to'])->toBeNull();
});

it('reports source_available true and keeps link_to when the source is visible', function () {
    $ticket = Ticket::factory()->create(['assigned_to' => $this->agent->id]);
    $notification = Notification::factory()->for($this->agent, 'user')->create([
        'source_type' => $ticket->getMorphClass(),
        'source_id' => $ticket->id,
        'link_to' => "/tickets/{$ticket->id}",
    ]);

    $response = $this->asUser($this->agent)->getJson('/api/notifications');

    $response->assertOk();
    $row = collect($response->json('data'))->firstWhere('id', $notification->id);
    expect($row['source_available'])->toBeTrue();
    expect($row['link_to'])->toBe("/tickets/{$ticket->id}");
});
