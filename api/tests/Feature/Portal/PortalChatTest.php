<?php

use App\Models\Customer;
use App\Models\KbArticle;
use App\Models\PortalSession;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true, 'ai.chat.enabled' => true]);
});

function chatCustomer(string $token = 'chat-token'): Customer
{
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken($token)->create();

    return $customer;
}

it('rejects an unauthenticated call on all three chat routes', function () {
    $this->getJson('/api/portal/chat')->assertStatus(401);
    $this->postJson('/api/portal/chat/messages', ['body' => 'hi'])->assertStatus(401);
    $this->postJson('/api/portal/chat/escalate')->assertStatus(401);
});

it('returns the empty shell from GET /api/portal/chat', function () {
    chatCustomer();

    $this->asToken('chat-token')->getJson('/api/portal/chat')
        ->assertOk()
        ->assertJson(['enabled' => true, 'conversation' => null, 'messages' => []]);
});

it('answers a grounded question with a citation', function () {
    chatCustomer();
    KbArticle::factory()->create([
        'title' => 'Reset your password',
        'slug' => 'reset-your-password',
        'body' => 'Use the reset link on the sign-in page to reset your password.',
    ]);
    bindAssistGenerator('{"answer":"Use the reset link.","citations":["reset-your-password"],"refused":false}');

    $res = $this->asToken('chat-token')->postJson('/api/portal/chat/messages', [
        'body' => 'How do I reset my password?',
    ])->assertOk();

    expect($res->json('state'))->toBe('ok')
        ->and($res->json('message.body'))->toBe('Use the reset link.')
        ->and($res->json('message.citations.0.slug'))->toBe('reset-your-password');
});

it('feeds the published article and its slug into the prompt', function () {
    chatCustomer();
    KbArticle::factory()->create([
        'title' => 'Billing cycle explained',
        'slug' => 'billing-cycle',
        'body' => 'Your billing cycle starts on the day you subscribed.',
    ]);
    $fake = bindAssistGenerator('{"answer":"It starts on your subscribe date.","citations":["billing-cycle"],"refused":false}');

    $this->asToken('chat-token')->postJson('/api/portal/chat/messages', [
        'body' => 'When does my billing cycle start?',
    ])->assertOk();

    expect($fake->calls[0][1])->toContain('billing-cycle')
        ->and($fake->calls[0][1])->toContain('Billing cycle explained');
});

it('never puts a draft article in the prompt', function () {
    chatCustomer();
    KbArticle::factory()->create([
        'title' => 'Published refund policy',
        'slug' => 'refund-policy',
        'body' => 'Refunds are processed within 5 days.',
    ]);
    KbArticle::factory()->draft()->create([
        'title' => 'Draft refund secrets',
        'slug' => 'draft-refund-secrets',
        'body' => 'Secret draft refund details.',
    ]);
    $fake = bindAssistGenerator('{"answer":"Within 5 days.","citations":["refund-policy"],"refused":false}');

    $this->asToken('chat-token')->postJson('/api/portal/chat/messages', [
        'body' => 'refund policy',
    ])->assertOk();

    expect($fake->calls[0][1])->not->toContain('Draft refund secrets');
});

it('drops a hallucinated citation slug', function () {
    chatCustomer();
    KbArticle::factory()->create([
        'title' => 'Account settings guide',
        'slug' => 'account-settings',
        'body' => 'Change your account settings from the profile page.',
    ]);
    bindAssistGenerator('{"answer":"From the profile page.","citations":["not-a-real-slug"],"refused":false}');

    $res = $this->asToken('chat-token')->postJson('/api/portal/chat/messages', [
        'body' => 'How do I change my account settings?',
    ])->assertOk();

    expect($res->json('state'))->toBe('ok')
        ->and($res->json('message.citations'))->toBe([]);
});

it('returns state refused with no citations when the model refuses', function () {
    chatCustomer();
    KbArticle::factory()->create([
        'title' => 'Shipping information',
        'slug' => 'shipping-info',
        'body' => 'We ship within the country only.',
    ]);
    bindAssistGenerator('{"answer":"I could not find that.","citations":["shipping-info"],"refused":true}');

    $res = $this->asToken('chat-token')->postJson('/api/portal/chat/messages', [
        'body' => 'shipping information',
    ])->assertOk();

    expect($res->json('state'))->toBe('refused')
        ->and($res->json('message.citations'))->toBe([]);
});

it('short-circuits the provider when zero articles match', function () {
    chatCustomer();
    $fake = bindAssistGenerator('{"answer":"x","citations":[],"refused":false}');

    $res = $this->asToken('chat-token')->postJson('/api/portal/chat/messages', [
        'body' => 'zzzzq completely unrelated nonsense topic',
    ])->assertOk();

    expect($res->json('state'))->toBe('refused')
        ->and($fake->timesCalled)->toBe(0)
        ->and($res->json('message.body'))->toBe(__('ai.chat_no_answer'));
});

it('carries multi-turn history into the prompt', function () {
    chatCustomer();
    KbArticle::factory()->create([
        'title' => 'Password reset help',
        'slug' => 'password-reset-help',
        'body' => 'Use the reset link to reset your password quickly.',
    ]);
    $fake = bindAssistGenerator('fallback');
    $fake->respondWith('{"answer":"First answer about reset.","citations":[],"refused":false}');
    $fake->respondWith('{"answer":"Second answer.","citations":[],"refused":false}');

    $this->asToken('chat-token')->postJson('/api/portal/chat/messages', ['body' => 'How do I reset my password?'])->assertOk();
    $this->asToken('chat-token')->postJson('/api/portal/chat/messages', ['body' => 'And the password reset link again?'])->assertOk();

    expect($fake->calls[1][1])->toContain('How do I reset my password?')
        ->and($fake->calls[1][1])->toContain('First answer about reset.');
});

it('replays a stored conversation from GET /api/portal/chat', function () {
    chatCustomer();
    KbArticle::factory()->create([
        'title' => 'Login troubleshooting',
        'slug' => 'login-help',
        'body' => 'Clear your cookies to fix login trouble.',
    ]);
    bindAssistGenerator('{"answer":"Clear your cookies.","citations":["login-help"],"refused":false}');

    $this->asToken('chat-token')->postJson('/api/portal/chat/messages', ['body' => 'I have login trouble'])->assertOk();

    $res = $this->asToken('chat-token')->getJson('/api/portal/chat')->assertOk();

    expect($res->json('messages'))->toHaveCount(2)
        ->and($res->json('messages.0.role'))->toBe('customer')
        ->and($res->json('messages.1.role'))->toBe('assistant');
});
