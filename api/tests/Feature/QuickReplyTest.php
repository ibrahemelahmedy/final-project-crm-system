<?php

use App\Enums\QuickReplyStatus;
use App\Enums\UserRole;
use App\Models\QuickReply;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('lets any authenticated user list quick replies', function () {
    QuickReply::factory()->create();

    $this->asUser($this->agent)->getJson('/api/quick-replies')->assertOk();
});

it('forbids an agent from creating, editing, or archiving a quick reply', function () {
    $quickReply = QuickReply::factory()->create();

    $this->asUser($this->agent)
        ->postJson('/api/quick-replies', ['title' => 'X', 'body' => 'Y', 'category' => 'general'])
        ->assertForbidden();

    $this->asUser($this->agent)
        ->patchJson("/api/quick-replies/{$quickReply->id}", ['title' => 'Z'])
        ->assertForbidden();

    $this->asUser($this->agent)
        ->postJson("/api/quick-replies/{$quickReply->id}/archive")
        ->assertForbidden();
});

it('lets a team lead and an administrator create, edit, archive, and list', function () {
    foreach ([$this->lead, $this->admin] as $writer) {
        $created = $this->asUser($writer)
            ->postJson('/api/quick-replies', [
                'title' => 'Refund policy',
                'body' => 'Hi {{customer.first_name}}',
                'category' => 'billing',
            ])
            ->assertCreated()
            ->json('data');

        $this->asUser($writer)
            ->patchJson("/api/quick-replies/{$created['id']}", ['title' => 'Refund policy v2'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Refund policy v2');

        $this->asUser($writer)
            ->postJson("/api/quick-replies/{$created['id']}/archive")
            ->assertOk()
            ->assertJsonPath('data.status', 'archived');

        $this->asUser($writer)->getJson('/api/quick-replies')->assertOk();
    }
});

it('excludes an archived template from the ticket picker but keeps it in the admin list under status=archived', function () {
    $ticket = Ticket::factory()->create(['assigned_to' => $this->agent->id]);
    $active = QuickReply::factory()->create(['title' => 'Active one']);
    $archived = QuickReply::factory()->archived()->create(['title' => 'Archived one']);

    $picker = $this->asUser($this->agent)
        ->getJson("/api/tickets/{$ticket->id}/quick-replies")
        ->assertOk()
        ->json('data');

    expect(collect($picker)->pluck('id'))->toContain($active->id)
        ->and(collect($picker)->pluck('id'))->not->toContain($archived->id);

    $this->asUser($this->admin)
        ->getJson('/api/quick-replies?status=archived')
        ->assertOk()
        ->assertJsonPath('data.0.id', $archived->id);
});
