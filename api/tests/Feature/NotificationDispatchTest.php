<?php

use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\Ticket;
use App\Models\User;
use App\Services\NotificationDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->dispatcher = app(NotificationDispatcher::class);
});

it('persists a row for the recipient', function () {
    $recipient = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->create();

    $notification = $this->dispatcher->dispatch(
        $recipient,
        NotificationType::SlaAtRisk,
        'SLA at risk',
        'Ticket approaching its deadline.',
        $ticket,
        "/tickets/{$ticket->id}"
    );

    expect($notification)->not->toBeNull();

    $this->assertDatabaseHas('notifications', [
        'id' => $notification->id,
        'user_id' => $recipient->id,
        'type' => NotificationType::SlaAtRisk->value,
        'title' => 'SLA at risk',
        'source_type' => $ticket->getMorphClass(),
        'source_id' => $ticket->id,
        'link_to' => "/tickets/{$ticket->id}",
    ]);
});

it('writes nothing for a deactivated recipient', function () {
    $recipient = User::factory()->create(['role' => UserRole::Agent, 'is_active' => false]);

    $notification = $this->dispatcher->dispatch($recipient, NotificationType::Mention, 'You were mentioned');

    expect($notification)->toBeNull();
    expect(Notification::where('user_id', $recipient->id)->count())->toBe(0);
});

it('persists a row for a recipient who never opens a session (offline-user criterion)', function () {
    $recipient = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    // No token minted, no request made as this user — dispatch happens purely
    // server-side (e.g. from Story 06's SLA job) with no session ever opened.
    $notification = $this->dispatcher->dispatch($recipient, NotificationType::SlaBreached, 'SLA breached');

    expect($notification)->not->toBeNull();
    $this->assertDatabaseHas('notifications', [
        'user_id' => $recipient->id,
        'read_at' => null,
    ]);
});
