<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent1 = User::factory()->create(['name' => 'Agent One', 'role' => UserRole::Agent, 'is_active' => true]);
    $this->agent1Token = $this->agent1->createToken('spa')->plainTextToken;

    $this->agent2 = User::factory()->create(['name' => 'Agent Two', 'role' => UserRole::Agent, 'is_active' => true]);
    $this->agent2Token = $this->agent2->createToken('spa')->plainTextToken;

    $this->customer = Customer::factory()->create();
});

it('records a note with a timestamp and the author', function () {
    $response = $this->withHeader('Authorization', "Bearer {$this->agent1Token}")
        ->postJson("/api/customers/{$this->customer->id}/notes", ['body' => 'Called about renewal.']);

    $response->assertCreated()
        ->assertJsonPath('data.author.name', 'Agent One')
        ->assertJsonStructure(['data' => ['id', 'body', 'author' => ['id', 'name'], 'created_at']]);
});

it('shows one agent\'s note to another agent', function () {
    $this->withHeader('Authorization', "Bearer {$this->agent1Token}")
        ->postJson("/api/customers/{$this->customer->id}/notes", ['body' => 'Visible to everyone.']);

    $response = $this->withHeader('Authorization', "Bearer {$this->agent2Token}")
        ->getJson("/api/customers/{$this->customer->id}/notes");

    $response->assertOk()->assertJsonFragment(['body' => 'Visible to everyone.']);
});

it('keeps a note attributed after its author is deleted', function () {
    $this->withHeader('Authorization', "Bearer {$this->agent1Token}")
        ->postJson("/api/customers/{$this->customer->id}/notes", ['body' => 'Note before deletion.']);

    $this->agent1->delete();

    $response = $this->withHeader('Authorization', "Bearer {$this->agent2Token}")
        ->getJson("/api/customers/{$this->customer->id}/notes");

    $response->assertOk()->assertJsonPath('data.0.author.name', 'Agent One');
});

it('rejects an empty note body', function () {
    $response = $this->withHeader('Authorization', "Bearer {$this->agent1Token}")
        ->postJson("/api/customers/{$this->customer->id}/notes", ['body' => '']);

    $response->assertStatus(422);
});
