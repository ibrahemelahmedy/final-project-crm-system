<?php

use App\Enums\UserRole;
use App\Models\AiAssistArtifact;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true]);
});

it('reuses the cached row across GETs and only regenerates on a new POST', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    $fake = bindAssistGenerator('First summary.');

    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")
        ->assertOk()
        ->assertJsonPath('content', 'First summary.');

    expect($fake->timesCalled)->toBe(1);

    // Two consecutive GETs after the POST invoke the generator ZERO more times.
    $this->asUser($agent)->getJson("/api/tickets/{$ticket->id}/ai-assist")
        ->assertOk()
        ->assertJsonPath('summary.content', 'First summary.');
    $this->asUser($agent)->getJson("/api/tickets/{$ticket->id}/ai-assist")->assertOk();

    expect($fake->timesCalled)->toBe(1);
    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'summary')->count())->toBe(1);

    // A second POST invokes the generator again and REPLACES the row. Queue
    // the next response on the SAME fake — see bindAssistGenerator()'s
    // docblock on why a second app()->instance() mid-test would not stick.
    $fake->respondWith('Second summary.');
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")
        ->assertOk()
        ->assertJsonPath('content', 'Second summary.');

    expect($fake->timesCalled)->toBe(2);
    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'summary')->count())->toBe(1);
    expect(AiAssistArtifact::where('ticket_id', $ticket->id)->where('kind', 'summary')->first()->content)
        ->toBe('Second summary.');
});
