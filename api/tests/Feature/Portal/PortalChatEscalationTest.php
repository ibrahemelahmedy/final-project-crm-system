<?php

use App\Models\Customer;
use App\Models\KbArticle;
use App\Models\PortalChatConversation;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true, 'ai.chat.enabled' => true, 'ai.classify.enabled' => false]);
});

function escalationCustomer(string $token = 'esc-token'): Customer
{
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken($token)->create();
    KbArticle::factory()->create([
        'title' => 'Password reset guide',
        'slug' => 'password-reset-guide',
        'body' => 'Use the reset link to reset your password.',
    ]);

    return $customer;
}

function twoTurns(string $token = 'esc-token'): void
{
    $fake = bindAssistGenerator('fallback');
    $fake->respondWith('{"answer":"Answer one about reset.","citations":[],"refused":false}');
    $fake->respondWith('{"answer":"Answer two about reset.","citations":[],"refused":false}');

    test()->asToken($token)->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertOk();
    test()->asToken($token)->postJson('/api/portal/chat/messages', ['body' => 'reset link'])->assertOk();
}

it('creates a ticket carrying the full transcript', function () {
    $customer = escalationCustomer();
    twoTurns();

    $res = $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(201);

    $ticket = Ticket::latest('id')->first();
    expect($ticket->customer_id)->toBe($customer->id)
        ->and($ticket->channel->value)->toBe('chat')
        ->and($ticket->status->value)->toBe('open')
        ->and($ticket->created_by)->toBeNull()
        ->and($ticket->description)->toContain('Customer: reset password')
        ->and($ticket->description)->toContain('Customer: reset link')
        ->and($ticket->description)->toContain('Answer one about reset.')
        ->and($ticket->description)->toContain('Answer two about reset.');
});

it('stores the transcript as the first public customer message', function () {
    escalationCustomer();
    twoTurns();

    $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(201);

    $message = TicketMessage::latest('id')->first();
    expect($message->author_type)->toBe('customer')
        ->and($message->visibility->value)->toBe('public')
        ->and($message->body)->toContain('Customer: reset password');
});

it('marks the conversation escalated with the ticket id', function () {
    escalationCustomer();
    twoTurns();

    $res = $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(201);
    $ticket = Ticket::latest('id')->first();

    $conversation = PortalChatConversation::first();
    expect($conversation->state->value)->toBe('escalated')
        ->and($conversation->escalated_ticket_id)->toBe($ticket->id);
});

it('shows the escalated ticket in the portal requests list', function () {
    escalationCustomer();
    twoTurns();
    $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(201);

    $ticket = Ticket::latest('id')->first();
    $this->asToken('esc-token')->getJson('/api/portal/requests')
        ->assertOk()
        ->assertJsonFragment(['id' => $ticket->id]);
});

it('rejects escalating an empty conversation with 422 and creates no ticket', function () {
    escalationCustomer();
    bindAssistGenerator('{"answer":"x","citations":[],"refused":false}');

    $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(422);

    expect(Ticket::count())->toBe(0);
});

it('rejects a second escalation with 422', function () {
    escalationCustomer();
    twoTurns();

    $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(201);
    $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(422);

    expect(Ticket::count())->toBe(1);
});

it('classifies the escalated ticket itself', function () {
    config(['ai.classify.enabled' => true]);
    escalationCustomer();

    // Edge Case 21: the escalation ticket fires the classifier, which consumes
    // one more response on the SAME fake — queue it AFTER the two chat answers.
    $fake = bindAssistGenerator('fallback');
    $fake->respondWith('{"answer":"Answer one.","citations":[],"refused":false}');
    $fake->respondWith('{"answer":"Answer two.","citations":[],"refused":false}');
    $fake->respondWith('{"category":"account","priority":"normal","confidence":0.85}');

    $this->asToken('esc-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertOk();
    $this->asToken('esc-token')->postJson('/api/portal/chat/messages', ['body' => 'reset link'])->assertOk();
    $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(201);

    expect(Ticket::latest('id')->first()->fresh()->ai_suggested_category)->toBe('account');
});

it('caps the transcript at 5000 characters', function () {
    config(['ai.chat.max_question_chars' => 100000, 'ai.chat.rate_per_minute' => 1000]);
    escalationCustomer();

    $fake = bindAssistGenerator('fallback');
    $long = str_repeat('word ', 400);
    foreach (range(1, 10) as $n) {
        $fake->respondWith('{"answer":"'.$long.'","citations":[],"refused":false}');
    }

    foreach (range(1, 10) as $n) {
        $this->asToken('esc-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password '.$long])->assertOk();
    }

    $this->asToken('esc-token')->postJson('/api/portal/chat/escalate')->assertStatus(201);

    expect(strlen(Ticket::latest('id')->first()->description))->toBeLessThanOrEqual(5000);
});
