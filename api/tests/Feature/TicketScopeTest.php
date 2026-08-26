<?php

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent1 = User::factory()->create([
        'name' => 'Agent One',
        'email' => 'agent1@wisal.test',
        'role' => UserRole::Agent,
        'is_active' => true,
    ]);

    $this->agent2 = User::factory()->create([
        'name' => 'Agent Two',
        'email' => 'agent2@wisal.test',
        'role' => UserRole::Agent,
        'is_active' => true,
    ]);

    $this->lead = User::factory()->create([
        'name' => 'Team Lead',
        'email' => 'lead@wisal.test',
        'role' => UserRole::TeamLead,
        'is_active' => true,
    ]);

    Ticket::create([
        'subject' => 'Ticket Agent One 1',
        'assigned_to' => $this->agent1->id,
    ]);
    Ticket::create([
        'subject' => 'Ticket Agent One 2',
        'assigned_to' => $this->agent1->id,
    ]);
    Ticket::create([
        'subject' => 'Ticket Agent Two 1',
        'assigned_to' => $this->agent2->id,
    ]);
});

it('scopes GET /api/tickets to assigned tickets for Agent and suppresses email', function () {
    $token = $this->agent1->createToken('spa')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/tickets');

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonFragment(['subject' => 'Ticket Agent One 1'])
        ->assertJsonFragment(['subject' => 'Ticket Agent One 2'])
        ->assertJsonMissing(['subject' => 'Ticket Agent Two 1']);

    // Ensure assignee email is not exposed in the payload
    $payload = $response->json();
    foreach ($payload['data'] as $item) {
        if (isset($item['assignee'])) {
            expect($item['assignee'])->not()->toHaveKey('email');
        }
    }
});

it('allows Team Lead to view tickets from all agents', function () {
    $token = $this->lead->createToken('spa')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/tickets');

    $response->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonFragment(['subject' => 'Ticket Agent One 1'])
        ->assertJsonFragment(['subject' => 'Ticket Agent Two 1']);
});
