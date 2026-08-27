<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->agentToken = $this->agent->createToken('spa')->plainTextToken;
});

// The Ticket Management story (WIS-2) adds tickets.customer_id. This test is
// expected to be updated (or replaced) by that story once the column exists —
// it locks in the "pending" seam, not the eventual live-data behaviour.
it('returns an empty page flagged with the pending story while tickets has no customer_id', function () {
    $customer = Customer::factory()->create();

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->getJson("/api/customers/{$customer->id}/tickets");

    $response->assertOk()
        ->assertJsonPath('meta.pending_story', 'WIS-2')
        ->assertJsonCount(0, 'data');
});
