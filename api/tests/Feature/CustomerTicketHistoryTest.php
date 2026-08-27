<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->agentToken = $this->agent->createToken('spa')->plainTextToken;
});

it('returns the tickets belonging to a customer, newest first', function () {
    $customer = Customer::factory()->create();
    $other = Customer::factory()->create();

    Ticket::factory()->create(['customer_id' => $other->id, 'subject' => 'Not this customer']);

    $older = Ticket::factory()->create(['customer_id' => $customer->id, 'subject' => 'Older ticket']);
    $older->forceFill(['created_at' => now()->subDay()])->saveQuietly();

    $newer = Ticket::factory()->create(['customer_id' => $customer->id, 'subject' => 'Newer ticket']);
    $newer->forceFill(['created_at' => now()])->saveQuietly();

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->getJson("/api/customers/{$customer->id}/tickets");

    $response->assertOk()->assertJsonCount(2, 'data');

    $subjects = $response->json('data.*.subject');
    expect($subjects)->toBe(['Newer ticket', 'Older ticket']);
});

it('returns an empty page for a customer with no tickets', function () {
    $customer = Customer::factory()->create();

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->getJson("/api/customers/{$customer->id}/tickets");

    $response->assertOk()->assertJsonCount(0, 'data');
});
