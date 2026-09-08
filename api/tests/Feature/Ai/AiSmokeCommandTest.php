<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Story 22 (WIS-26), Test Plan C. `php artisan ai:smoke` must resolve the
 * bound generator, run a real prompt, and never let a provider failure escape.
 */
it('fails cleanly when AI assist is disabled', function () {
    config(['ai.enabled' => false]);

    $this->artisan('ai:smoke')->assertExitCode(1);
});

it('prints the generated content for the newest ticket with messages', function () {
    config(['ai.enabled' => true]);

    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    $customer = Customer::factory()->create();

    TicketMessage::factory()->for($ticket)->create([
        'author_type' => TicketMessage::AUTHOR_CUSTOMER,
        'customer_id' => $customer->id,
        'user_id' => null,
        'body' => 'My invoice is wrong.',
        'visibility' => 'public',
    ]);
    TicketMessage::factory()->for($ticket)->fromAgent($agent)->create([
        'body' => 'Looking into it now.',
        'visibility' => 'public',
    ]);

    bindAssistGenerator('Smoke output.');

    $this->artisan('ai:smoke')
        ->expectsOutputToContain('Smoke output.')
        ->assertExitCode(0);
});

it('reports a provider failure as a non-zero exit', function () {
    config(['ai.enabled' => true]);

    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create();
    $customer = Customer::factory()->create();

    TicketMessage::factory()->for($ticket)->create([
        'author_type' => TicketMessage::AUTHOR_CUSTOMER,
        'customer_id' => $customer->id,
        'user_id' => null,
        'body' => 'Help please.',
        'visibility' => 'public',
    ]);

    bindFailingAssistGenerator();

    $this->artisan('ai:smoke')->assertExitCode(1);
});
