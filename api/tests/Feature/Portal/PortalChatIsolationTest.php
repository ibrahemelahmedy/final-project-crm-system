<?php

use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\KbArticle;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true, 'ai.chat.enabled' => true, 'ai.classify.enabled' => false]);
    KbArticle::factory()->create([
        'title' => 'Password reset guide',
        'slug' => 'password-reset-guide',
        'body' => 'Use the reset link to reset your password.',
    ]);
});

it('never shows another customer a conversation', function () {
    $a = Customer::factory()->create();
    PortalSession::factory()->for($a)->withToken('cust-a')->create();
    $b = Customer::factory()->create();
    PortalSession::factory()->for($b)->withToken('cust-b')->create();

    bindAssistGenerator('{"answer":"Use the reset link.","citations":[],"refused":false}');

    $this->asToken('cust-a')->postJson('/api/portal/chat/messages', ['body' => 'reset password for A'])->assertOk();

    $this->asToken('cust-b')->getJson('/api/portal/chat')
        ->assertOk()
        ->assertJsonPath('conversation', null)
        ->assertJsonPath('messages', []);
});

it('rejects a staff Sanctum token on every chat route', function () {
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);

    $this->asUser($agent)->getJson('/api/portal/chat')->assertStatus(401);
    $this->asUser($agent)->postJson('/api/portal/chat/messages', ['body' => 'hi'])->assertStatus(401);
    $this->asUser($agent)->postJson('/api/portal/chat/escalate')->assertStatus(401);
});

it('rejects a revoked session on every chat route', function () {
    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('revoked-token')
        ->create(['revoked_at' => now()]);

    $this->asToken('revoked-token')->getJson('/api/portal/chat')->assertStatus(401);
    $this->asToken('revoked-token')->postJson('/api/portal/chat/messages', ['body' => 'hi'])->assertStatus(401);
    $this->asToken('revoked-token')->postJson('/api/portal/chat/escalate')->assertStatus(401);
});

it('hides an escalated ticket from another customer', function () {
    $a = Customer::factory()->create();
    PortalSession::factory()->for($a)->withToken('cust-a')->create();
    $b = Customer::factory()->create();
    PortalSession::factory()->for($b)->withToken('cust-b')->create();

    $fake = bindAssistGenerator('fallback');
    $fake->respondWith('{"answer":"A1.","citations":[],"refused":false}');

    $this->asToken('cust-a')->postJson('/api/portal/chat/messages', ['body' => 'reset password A'])->assertOk();
    $this->asToken('cust-a')->postJson('/api/portal/chat/escalate')->assertStatus(201);

    $ticket = Ticket::latest('id')->first();
    $this->asToken('cust-b')->getJson("/api/portal/requests/{$ticket->id}")->assertStatus(404);
});
