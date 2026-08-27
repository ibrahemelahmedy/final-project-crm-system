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

it('blocks a duplicate email and returns the existing customer id', function () {
    $existing = Customer::factory()->create(['email' => 'amelia@x.io']);

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->postJson('/api/customers', ['name' => 'Someone Else', 'email' => 'amelia@x.io']);

    $response->assertStatus(422)
        ->assertJsonPath('duplicate_customer_id', $existing->id);
});

it('blocks a duplicate email differing only in case', function () {
    Customer::factory()->create(['email' => 'amelia@x.io']);

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->postJson('/api/customers', ['name' => 'Someone Else', 'email' => 'Amelia@X.IO']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors('email');
});

it('blocks a duplicate phone written in a different format', function () {
    Customer::factory()->create(['name' => 'Original', 'email' => null, 'phone' => '+1 (415) 555-0148']);

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->postJson('/api/customers', ['name' => 'Someone Else', 'phone' => '14155550148']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors('phone');
});

it('allows two customers with no email', function () {
    Customer::factory()->create(['email' => null, 'phone' => '+1 (415) 555-0148']);

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->postJson('/api/customers', ['name' => 'Second Customer', 'phone' => '+1 (415) 555-0199']);

    $response->assertCreated();
});

it('allows two customers with no phone', function () {
    Customer::factory()->create(['email' => 'first@example.com', 'phone' => null]);

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->postJson('/api/customers', ['name' => 'Second Customer', 'email' => 'second@example.com']);

    $response->assertCreated();
});

it('allows reusing the email of a soft-deleted customer', function () {
    $existing = Customer::factory()->create(['email' => 'amelia@x.io']);
    $existing->delete();

    $response = $this->withHeader('Authorization', "Bearer {$this->agentToken}")
        ->postJson('/api/customers', ['name' => 'New Amelia', 'email' => 'amelia@x.io']);

    $response->assertCreated();
});
