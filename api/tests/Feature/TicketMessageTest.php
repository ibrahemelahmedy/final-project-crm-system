<?php

use App\Enums\Channel;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->agent = User::factory()->create([
        'role' => UserRole::Agent,
        'is_active' => true,
        'email' => 'agent1@wisal.test',
    ]);

    $this->otherAgent = User::factory()->create([
        'role' => UserRole::Agent,
        'is_active' => true,
        'email' => 'agent2@wisal.test',
    ]);

    $this->lead = User::factory()->create([
        'role' => UserRole::TeamLead,
        'is_active' => true,
        'email' => 'lead@wisal.test',
    ]);

    $this->customer = Customer::factory()->create();

    $this->ticket = Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'customer_id' => $this->customer->id,
        'channel' => Channel::Whatsapp->value,
    ]);
});

function msgAuth(User $user): array
{
    return ['Authorization' => 'Bearer '.$user->createToken('spa')->plainTextToken];
}

it('returns a ticket\'s messages oldest-page-last in one chronological set', function () {
    foreach ([Channel::Email, Channel::Whatsapp, Channel::Sms, Channel::Email, Channel::Sms] as $c) {
        TicketMessage::factory()->overChannel($c)->create([
            'ticket_id' => $this->ticket->id,
            'customer_id' => $this->customer->id,
        ]);
    }

    $response = $this->withHeaders(msgAuth($this->agent))
        ->getJson("/api/tickets/{$this->ticket->id}/messages");

    $response->assertOk()->assertJsonCount(5, 'data');

    $ids = collect($response->json('data'))->pluck('id')->all();
    expect($ids)->toEqual(collect($ids)->sortDesc()->values()->all());
});

it('paginates messages by cursor', function () {
    TicketMessage::factory()->count(45)->create([
        'ticket_id' => $this->ticket->id,
        'customer_id' => $this->customer->id,
    ]);

    $first = $this->withHeaders(msgAuth($this->agent))
        ->getJson("/api/tickets/{$this->ticket->id}/messages");

    $first->assertOk()->assertJsonCount(30, 'data');
    expect($first->json('meta.next_cursor'))->not->toBeNull();

    $second = $this->withHeaders(msgAuth($this->agent))
        ->getJson("/api/tickets/{$this->ticket->id}/messages?cursor=".$first->json('meta.next_cursor'));

    $second->assertOk()->assertJsonCount(15, 'data');
    expect($second->json('meta.next_cursor'))->toBeNull();

    $a = collect($first->json('data'))->pluck('id');
    $b = collect($second->json('data'))->pluck('id');
    expect($a->intersect($b))->toBeEmpty();
});

it('locks the message resource shape', function () {
    TicketMessage::factory()->create([
        'ticket_id' => $this->ticket->id,
        'customer_id' => $this->customer->id,
    ]);

    $this->withHeaders(msgAuth($this->agent))
        ->getJson("/api/tickets/{$this->ticket->id}/messages")
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                ['id', 'ticket_id', 'author_type', 'author', 'is_mine', 'channel', 'channel_label', 'body', 'created_at'],
            ],
        ]);
});

it('never exposes an author email', function () {
    TicketMessage::factory()->fromAgent($this->agent)->create(['ticket_id' => $this->ticket->id]);
    TicketMessage::factory()->create([
        'ticket_id' => $this->ticket->id,
        'customer_id' => $this->customer->id,
    ]);

    $response = $this->withHeaders(msgAuth($this->agent))
        ->getJson("/api/tickets/{$this->ticket->id}/messages");

    $response->assertJsonMissing(['email' => $this->agent->email]);
    if ($this->customer->email) {
        $response->assertJsonMissing(['email' => $this->customer->email]);
    }
});

it('forbids reading a thread on someone else\'s ticket', function () {
    $this->withHeaders(msgAuth($this->otherAgent))
        ->getJson("/api/tickets/{$this->ticket->id}/messages")
        ->assertForbidden();
});

it('lets a team lead read any thread', function () {
    $this->withHeaders(msgAuth($this->lead))
        ->getJson("/api/tickets/{$this->ticket->id}/messages")
        ->assertOk();
});

it('appends a reply with the ticket\'s channel and the acting agent', function () {
    $response = $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => 'On it now.']);

    $response->assertCreated()
        ->assertJsonPath('data.author_type', 'agent')
        ->assertJsonPath('data.channel', 'whatsapp')
        ->assertJsonPath('data.is_mine', true);
});

it('rejects an empty reply', function () {
    $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => ''])
        ->assertStatus(422)
        ->assertJsonValidationErrors('body');

    $this->assertDatabaseCount('ticket_messages', 0);
});

it('rejects a whitespace-only reply', function () {
    $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => "   \n  "])
        ->assertStatus(422)
        ->assertJsonValidationErrors('body');

    $this->assertDatabaseCount('ticket_messages', 0);
});

it('rejects a reply longer than 10000 characters', function () {
    $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => str_repeat('a', 10001)])
        ->assertStatus(422)
        ->assertJsonValidationErrors('body');
});

it('ignores a client-supplied channel', function () {
    $emailTicket = Ticket::factory()->create([
        'assigned_to' => $this->agent->id,
        'customer_id' => $this->customer->id,
        'channel' => Channel::Email->value,
    ]);

    $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$emailTicket->id}/messages", ['body' => 'hi', 'channel' => 'sms'])
        ->assertCreated();

    $this->assertDatabaseHas('ticket_messages', [
        'ticket_id' => $emailTicket->id,
        'channel' => 'email',
    ]);
});

it('bumps the ticket\'s updated_at', function () {
    $before = $this->ticket->fresh()->updated_at;
    Carbon::setTestNow(now()->addMinute());

    $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => 'ping'])
        ->assertCreated();

    expect($this->ticket->fresh()->updated_at->gt($before))->toBeTrue();
    Carbon::setTestNow();
});

it('sets the customer\'s last_contact_at', function () {
    $this->customer->update(['last_contact_at' => null]);

    $response = $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => 'ping']);

    $created = $response->json('data.created_at');
    expect($this->customer->fresh()->last_contact_at->toIso8601String())
        ->toEqual(Carbon::parse($created)->toIso8601String());
});

it('never moves last_contact_at backwards', function () {
    $future = now()->addYear();
    $this->customer->update(['last_contact_at' => $future]);

    $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => 'ping'])
        ->assertCreated();

    expect($this->customer->fresh()->last_contact_at->toDateString())->toEqual($future->toDateString());
});

it('writes exactly one replied event and nothing to audit_logs', function () {
    $this->withHeaders(msgAuth($this->agent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => 'ping'])
        ->assertCreated();

    $this->assertDatabaseHas('ticket_events', ['event' => 'replied', 'user_id' => $this->agent->id]);
    expect(TicketMessage::count())->toBe(1);
    $this->assertDatabaseCount('audit_logs', 0);
});

it('forbids replying to someone else\'s ticket', function () {
    $this->withHeaders(msgAuth($this->otherAgent))
        ->postJson("/api/tickets/{$this->ticket->id}/messages", ['body' => 'ping'])
        ->assertForbidden();

    $this->assertDatabaseCount('ticket_messages', 0);
});

it('creates the opening message from a ticket description', function () {
    $response = $this->withHeaders(msgAuth($this->lead))
        ->postJson('/api/tickets', [
            'subject' => 'New issue',
            'description' => 'My widget is broken.',
            'customer_id' => $this->customer->id,
            'category' => 'technical',
            'priority' => 'normal',
            'channel' => 'email',
        ]);

    $response->assertCreated();
    $this->assertDatabaseHas('ticket_messages', [
        'ticket_id' => $response->json('data.id'),
        'author_type' => 'customer',
        'body' => 'My widget is broken.',
    ]);
});

it('creates no message when a ticket has no description', function () {
    $this->withHeaders(msgAuth($this->lead))
        ->postJson('/api/tickets', [
            'subject' => 'New issue',
            'customer_id' => $this->customer->id,
            'category' => 'technical',
            'priority' => 'normal',
            'channel' => 'email',
        ])
        ->assertCreated();

    $this->assertDatabaseCount('ticket_messages', 0);
});
