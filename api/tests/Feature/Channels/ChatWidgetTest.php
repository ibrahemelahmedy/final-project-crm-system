<?php

use App\Enums\Channel;
use App\Models\ChannelConnection;
use App\Models\ChatSession;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

/** Story 26 (WIS-22), Test Plan §J — Done Criterion 3's backend half. */
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

function chatConnection(array $config = []): ChannelConnection
{
    return ChannelConnection::factory()->chat()->create([
        'config' => array_merge(['site_key' => 'a-site-key', 'allowed_origins' => ['https://example.com']], $config),
    ]);
}

function startWidget(string $siteKey = 'a-site-key', string $origin = 'https://example.com'): TestResponse
{
    return test()->withHeaders(['Origin' => $origin])
        ->postJson('/api/widget/chat/sessions', ['site_key' => $siteKey]);
}

function widgetAuth(string $token): array
{
    return ['Authorization' => 'Bearer '.$token];
}

it('starting a session with a valid site key and allowed origin returns a token and creates a session with no ticket', function () {
    chatConnection();

    $response = startWidget();
    $response->assertOk()->assertJsonStructure(['token', 'expires_at', 'poll_seconds', 'state']);
    expect($response->json('state'))->toBe('awaiting_identity');

    expect(ChatSession::count())->toBe(1);
    expect(ChatSession::first()->ticket_id)->toBeNull();
});

it('a disallowed Origin returns 403, and a forged Referer with a bad Origin is still 403', function () {
    chatConnection();

    startWidget('a-site-key', 'https://evil.example')->assertStatus(403);

    // A forged Referer header must never substitute for the Origin check.
    test()->withHeaders(['Origin' => 'https://evil.example', 'Referer' => 'https://example.com/'])
        ->postJson('/api/widget/chat/sessions', ['site_key' => 'a-site-key'])
        ->assertStatus(403);
});

it('POST /chat/messages before identify holds the message; GET returns awaiting_identity with no ticket', function () {
    chatConnection();
    $token = startWidget()->json('token');

    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/messages', ['body' => 'Hello there'])
        ->assertOk()->assertJson(['state' => 'awaiting_identity']);

    $res = test()->withHeaders(widgetAuth($token))->getJson('/api/widget/chat/messages');
    $res->assertOk()->assertJson(['messages' => [], 'state' => 'awaiting_identity']);

    expect(Ticket::count())->toBe(0);
});

it('identify creates the customer and the ticket with channel=chat, replaying held messages in order', function () {
    chatConnection();
    $token = startWidget()->json('token');

    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/messages', ['body' => 'First message']);
    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/messages', ['body' => 'Second message']);

    $res = test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/identify', [
        'name' => 'Jamie Visitor', 'email' => 'jamie@example.com',
    ]);
    $res->assertOk()->assertJson(['state' => 'open']);

    $ticket = Ticket::firstOrFail();
    expect($ticket->channel)->toBe(Channel::Chat);

    $bodies = TicketMessage::where('ticket_id', $ticket->id)->orderBy('id')->pluck('body')->all();
    expect($bodies)->toBe(['First message', 'Second message']);
});

it('GET messages?after=<id> returns only newer messages and never an internal note', function () {
    chatConnection();
    $token = startWidget()->json('token');
    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/messages', ['body' => 'first']);
    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/identify', ['name' => 'A', 'email' => 'a@example.com']);

    $session = ChatSession::firstOrFail();
    $ticket = Ticket::findOrFail($session->ticket_id);

    $firstId = TicketMessage::where('ticket_id', $ticket->id)->value('id');

    TicketMessage::factory()->create([
        'ticket_id' => $ticket->id, 'customer_id' => $ticket->customer_id,
        'author_type' => TicketMessage::AUTHOR_AGENT, 'user_id' => User::factory(),
        'body' => 'public agent reply', 'visibility' => 'public',
    ]);
    TicketMessage::factory()->create([
        'ticket_id' => $ticket->id, 'customer_id' => null,
        'author_type' => TicketMessage::AUTHOR_AGENT, 'user_id' => User::factory(),
        'body' => 'a secret internal note', 'visibility' => 'internal',
    ]);

    $res = test()->withHeaders(widgetAuth($token))->getJson("/api/widget/chat/messages?after={$firstId}");
    $res->assertOk();

    $bodies = collect($res->json('messages'))->pluck('body')->all();
    expect($bodies)->toBe(['public agent reply']);
});

it('an expired/revoked session gets the one 401, byte-identical to the missing-token 401', function () {
    $connection = chatConnection();

    $missing = test()->getJson('/api/widget/chat/messages');
    $missing->assertStatus(401);

    $expiredToken = 'expired-plain-token';
    ChatSession::factory()->for($connection, 'connection')->expired()->withToken($expiredToken)->create();
    $expired = test()->withHeaders(widgetAuth($expiredToken))->getJson('/api/widget/chat/messages');
    $expired->assertStatus(401);

    $revokedToken = 'revoked-plain-token';
    ChatSession::factory()->for($connection, 'connection')->revoked()->withToken($revokedToken)->create();
    $revoked = test()->withHeaders(widgetAuth($revokedToken))->getJson('/api/widget/chat/messages');
    $revoked->assertStatus(401);

    expect($missing->json())->toBe($expired->json())->toBe($revoked->json());
});

it('the message cap returns 422', function () {
    config(['channels.chat.max_messages_per_session' => 2]);
    chatConnection();
    $token = startWidget()->json('token');

    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/messages', ['body' => 'one'])->assertOk();
    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/messages', ['body' => 'two'])->assertOk();
    test()->withHeaders(widgetAuth($token))->postJson('/api/widget/chat/messages', ['body' => 'three'])->assertStatus(422);
});

it('a widget token is rejected by /api/portal/me and /api/user, and a portal token is rejected by /api/widget/chat/messages', function () {
    chatConnection();
    $widgetToken = startWidget()->json('token');

    test()->withHeaders(widgetAuth($widgetToken))->getJson('/api/portal/me')->assertStatus(401);
    test()->withHeaders(widgetAuth($widgetToken))->getJson('/api/user')->assertStatus(401);

    $portalToken = 'a-portal-session-token';
    PortalSession::factory()->withToken($portalToken)->create();
    test()->withHeaders(widgetAuth($portalToken))->getJson('/api/widget/chat/messages')->assertStatus(401);
});
