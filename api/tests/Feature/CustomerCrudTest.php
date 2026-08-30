<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create([
        'name' => 'Agent One',
        'email' => 'agent@wisal.test',
        'role' => UserRole::Agent,
        'is_active' => true,
    ]);
    $this->agentToken = $this->agent->createToken('spa')->plainTextToken;
});

it('creates a customer with a name and an email', function () {
    $response = $this->asToken($this->agentToken)
        ->postJson('/api/customers', [
            'name' => 'Amelia Chen',
            'email' => 'amelia.chen@northwind.io',
        ]);

    $response->assertCreated()
        ->assertJsonStructure(['data' => [
            'id', 'name', 'email', 'phone', 'company', 'tier', 'tier_label',
            'initials', 'open_tickets_count', 'last_contact_at', 'created_at', 'updated_at',
        ]]);
});

it('creates a customer with a name and only a phone', function () {
    $response = $this->asToken($this->agentToken)
        ->postJson('/api/customers', [
            'name' => 'Marcus Webb',
            'phone' => '+1 (415) 555-0148',
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.name', 'Marcus Webb');
});

it('rejects a customer with neither an email nor a phone', function () {
    $response = $this->asToken($this->agentToken)
        ->postJson('/api/customers', ['name' => 'No Contact']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors('email');
});

it('rejects a customer with no name', function () {
    $response = $this->asToken($this->agentToken)
        ->postJson('/api/customers', ['email' => 'noname@example.com']);

    $response->assertStatus(422)
        ->assertJsonValidationErrors('name');
});

it('never exposes phone_normalized, created_by, or deleted_at', function () {
    $response = $this->asToken($this->agentToken)
        ->postJson('/api/customers', [
            'name' => 'Amelia Chen',
            'email' => 'amelia.chen@northwind.io',
            'phone' => '+1 (415) 555-0148',
        ]);

    $payload = $response->json('data');

    expect($payload)->not()->toHaveKey('phone_normalized');
    expect($payload)->not()->toHaveKey('created_by');
    expect($payload)->not()->toHaveKey('deleted_at');
});

it('stores email lower-cased and derives a normalized phone', function () {
    $response = $this->asToken($this->agentToken)
        ->postJson('/api/customers', [
            'name' => 'Amelia Chen',
            'email' => 'Amelia@X.IO',
            'phone' => '+1 (415) 555-0148',
        ]);

    $response->assertCreated();

    $customer = Customer::first();

    expect($customer->email)->toBe('amelia@x.io');
    expect($customer->phone_normalized)->toBe('+14155550148');
    expect($response->json('data.phone'))->toBe('+1 (415) 555-0148');
});

it('updates a customer without tripping its own unique rule', function () {
    $customer = Customer::factory()->create(['email' => 'amelia@x.io']);

    $response = $this->asToken($this->agentToken)
        ->patchJson("/api/customers/{$customer->id}", [
            'email' => 'amelia@x.io',
        ]);

    $response->assertOk();
});

it('soft-deletes a customer', function () {
    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $leadToken = $lead->createToken('spa')->plainTextToken;
    $customer = Customer::factory()->create();

    $response = $this->asToken($leadToken)
        ->deleteJson("/api/customers/{$customer->id}");

    $response->assertStatus(204);
    $this->assertSoftDeleted('customers', ['id' => $customer->id]);

    $list = $this->asToken($leadToken)->getJson('/api/customers');
    $list->assertJsonMissing(['id' => $customer->id]);
});
