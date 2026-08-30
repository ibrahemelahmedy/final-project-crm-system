<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $this->agentToken = $this->agent->createToken('spa')->plainTextToken;

    $this->lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $this->leadToken = $this->lead->createToken('spa')->plainTextToken;
});

it('lets an agent create and update a customer', function () {
    $create = $this->asToken($this->agentToken)
        ->postJson('/api/customers', ['name' => 'New Customer', 'email' => 'new@example.com']);
    $create->assertCreated();

    $id = $create->json('data.id');

    $update = $this->asToken($this->agentToken)
        ->patchJson("/api/customers/{$id}", ['name' => 'Updated Name']);
    $update->assertOk();
});

it('forbids an agent from deleting a customer', function () {
    $customer = Customer::factory()->create();

    $response = $this->asToken($this->agentToken)
        ->deleteJson("/api/customers/{$customer->id}");

    $response->assertStatus(403);
});

it('lets a team lead delete a customer', function () {
    $customer = Customer::factory()->create();

    $response = $this->asToken($this->leadToken)
        ->deleteJson("/api/customers/{$customer->id}");

    $response->assertStatus(204);
});

it('forbids an agent from running a bulk delete', function () {
    $customers = Customer::factory()->count(2)->create();

    $response = $this->asToken($this->agentToken)
        ->postJson('/api/customers/bulk', ['action' => 'delete', 'ids' => $customers->pluck('id')->all()]);

    $response->assertStatus(403);
});

it('lets a team lead bulk delete and reports the affected count', function () {
    $customers = Customer::factory()->count(3)->create();

    $response = $this->asToken($this->leadToken)
        ->postJson('/api/customers/bulk', ['action' => 'delete', 'ids' => $customers->pluck('id')->all()]);

    $response->assertOk()->assertJsonPath('affected', 3);
});

it('lets a team lead bulk set a tier', function () {
    $customers = Customer::factory()->count(2)->create(['tier' => 'standard']);

    $response = $this->asToken($this->leadToken)
        ->postJson('/api/customers/bulk', [
            'action' => 'set_tier',
            'ids' => $customers->pluck('id')->all(),
            'tier' => 'enterprise',
        ]);

    $response->assertOk();
    expect(Customer::whereIn('id', $customers->pluck('id'))->where('tier', 'enterprise')->count())->toBe(2);
});

it('rejects a bulk request with more than 200 ids', function () {
    $ids = range(1, 201);

    $response = $this->asToken($this->leadToken)
        ->postJson('/api/customers/bulk', ['action' => 'delete', 'ids' => $ids]);

    $response->assertStatus(422);
});

it('requires authentication for every customer route', function () {
    $customer = Customer::factory()->create();

    $this->getJson('/api/customers')->assertStatus(401);
    $this->getJson('/api/customers/facets')->assertStatus(401);
    $this->postJson('/api/customers', [])->assertStatus(401);
    $this->getJson("/api/customers/{$customer->id}")->assertStatus(401);
    $this->patchJson("/api/customers/{$customer->id}", [])->assertStatus(401);
    $this->deleteJson("/api/customers/{$customer->id}")->assertStatus(401);
    $this->postJson('/api/customers/bulk', [])->assertStatus(401);
    $this->getJson("/api/customers/{$customer->id}/tickets")->assertStatus(401);
    $this->getJson("/api/customers/{$customer->id}/notes")->assertStatus(401);
    $this->postJson("/api/customers/{$customer->id}/notes", [])->assertStatus(401);
    $this->getJson("/api/customers/{$customer->id}/attachments")->assertStatus(401);
});
