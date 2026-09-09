<?php

use App\Models\Customer;
use App\Models\KbArticle;
use App\Models\PortalChatConversation;
use App\Models\PortalSession;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true, 'ai.chat.enabled' => true]);
});

function groundedCustomer(string $token = 'guard-token'): Customer
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

$ok = '{"answer":"Use the reset link.","citations":["password-reset-guide"],"refused":false}';

it('ends the conversation when the message ceiling is reached', function () use ($ok) {
    config(['ai.chat.max_messages' => 2]);
    groundedCustomer();
    $fake = bindAssistGenerator($ok);

    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])
        ->assertOk()->assertJsonPath('state', 'ok');

    $res = $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password again'])
        ->assertOk();

    expect($res->json('state'))->toBe('ended')
        ->and($res->json('message'))->toBeNull()
        ->and(PortalChatConversation::first()->state->value)->toBe('ended');
});

it('ends the conversation when the token ceiling is reached', function () use ($ok) {
    config(['ai.chat.max_tokens_per_conversation' => 5]);
    groundedCustomer();
    bindAssistGenerator($ok); // fake reports 10 in / 5 out

    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])
        ->assertOk()->assertJsonPath('state', 'ok');

    $res = $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password again'])
        ->assertOk();

    expect($res->json('state'))->toBe('ended');
});

it('answers 429 from the portal-chat limiter', function () use ($ok) {
    config(['ai.chat.rate_per_minute' => 2]);
    groundedCustomer();
    bindAssistGenerator($ok);

    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertOk();
    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertOk();

    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])
        ->assertStatus(429)
        ->assertHeader('Retry-After');
});

it('does not throttle other portal routes when portal-chat is tripped', function () use ($ok) {
    config(['ai.chat.rate_per_minute' => 1]);
    groundedCustomer();
    bindAssistGenerator($ok);

    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertOk();
    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertStatus(429);

    $this->asToken('guard-token')->getJson('/api/portal/requests')->assertOk();
});

it('caps the question at ai.chat.max_question_chars', function () {
    config(['ai.chat.max_question_chars' => 1000]);
    groundedCustomer();
    bindAssistGenerator('{"answer":"x","citations":[],"refused":false}');

    $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => str_repeat('a', 1001)])
        ->assertStatus(422);
});

it('returns state unavailable and HTTP 200 on a provider failure, storing the question only', function () {
    groundedCustomer();
    bindFailingAssistGenerator();

    $res = $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])
        ->assertOk();

    expect($res->json('state'))->toBe('unavailable')
        ->and($res->json('message'))->toBeNull();

    $conversation = PortalChatConversation::first();
    expect($conversation->messages)->toHaveCount(1)
        ->and($conversation->messages->first()->role)->toBe('customer')
        ->and($conversation->totalTokens())->toBe(0);
});

it('returns state unavailable on unparseable output and stores no assistant message', function () {
    groundedCustomer();
    bindAssistGenerator('I am not JSON at all.');

    $res = $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])
        ->assertOk();

    expect($res->json('state'))->toBe('unavailable');
    expect(PortalChatConversation::first()->messages)->toHaveCount(1);
});

it('reports enabled false and state unavailable when ai.chat.enabled is false', function () {
    config(['ai.chat.enabled' => false]);
    groundedCustomer();
    $fake = bindAssistGenerator('{"answer":"x","citations":[],"refused":false}');

    $this->asToken('guard-token')->getJson('/api/portal/chat')->assertOk()->assertJsonPath('enabled', false);

    $res = $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertOk();

    expect($res->json('state'))->toBe('unavailable')
        ->and($fake->timesCalled)->toBe(0);
});

it('computes messages_remaining and tokens_remaining server-side and shrinks them after a turn', function () use ($ok) {
    config(['ai.chat.max_messages' => 20, 'ai.chat.max_tokens_per_conversation' => 12000]);
    groundedCustomer();
    bindAssistGenerator($ok);

    $res = $this->asToken('guard-token')->postJson('/api/portal/chat/messages', ['body' => 'reset password'])->assertOk();

    expect($res->json('conversation.messages_remaining'))->toBe(18)
        ->and($res->json('conversation.tokens_remaining'))->toBe(12000 - 15);
});
