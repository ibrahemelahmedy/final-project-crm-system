<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Story 19 (WIS-18), Decision 2 — the highest-consequence test in the story.
 * The suggested-reply prompt must be built from `publicOnly()` messages ONLY;
 * the summary prompt sees the whole thread, internal notes included.
 */
it('includes an internal note in the summary prompt but excludes it from the reply prompt', function () {
    config(['ai.enabled' => true]);

    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    $customer = Customer::factory()->create();

    TicketMessage::factory()->for($ticket)->create([
        'author_type' => TicketMessage::AUTHOR_CUSTOMER,
        'customer_id' => $customer->id,
        'user_id' => null,
        'body' => 'My password reset link expired.',
        'visibility' => 'public',
    ]);
    TicketMessage::factory()->for($ticket)->fromAgent($agent)->create([
        'body' => 'INTERNAL-ONLY-SENTINEL: three failed attempts, likely delivery delay.',
        'visibility' => 'internal',
    ]);
    TicketMessage::factory()->for($ticket)->fromAgent($agent)->create([
        'body' => 'A fresh reset link is on its way.',
        'visibility' => 'public',
    ]);

    $fake = bindAssistGenerator();

    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")->assertOk();
    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertOk();

    expect($fake->calls)->toHaveCount(2);
    [$summaryCall, $replyCall] = $fake->calls;

    expect($summaryCall[1])->toContain('INTERNAL-ONLY-SENTINEL');
    expect($replyCall[1])->not->toContain('INTERNAL-ONLY-SENTINEL');

    // And the public content the reply prompt SHOULD see is still there.
    expect($replyCall[1])->toContain('A fresh reset link is on its way.');
});
