<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 429 on the seventh generate request inside a minute, but DELETE stays outside the limiter', function () {
    config(['ai.enabled' => true]);
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    bindAssistGenerator();

    for ($i = 0; $i < 6; $i++) {
        $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")->assertOk();
    }

    $this->asUser($agent)->postJson("/api/tickets/{$ticket->id}/ai-assist/summary")->assertStatus(429);

    // DELETE is deliberately outside the `ai-assist` throttle group.
    $this->asUser($agent)->deleteJson("/api/tickets/{$ticket->id}/ai-assist/reply")->assertStatus(204);
});
