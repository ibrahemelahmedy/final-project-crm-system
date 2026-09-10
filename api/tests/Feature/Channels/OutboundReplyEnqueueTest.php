<?php

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Enums\UserRole;
use App\Models\ChannelInboundMessage;
use App\Models\ChannelOutboundMessage;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use App\Services\Channels\ChannelOutbox;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

/** Story 26 (WIS-22), Test Plan §G — the enqueue seam, ChannelOutbox::enqueue(). */
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
    $this->agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    Http::fake(); // no sender fake bound — this section only asserts the enqueue write, not delivery
});

function agentAuth(User $user): array
{
    return ['Authorization' => 'Bearer '.$user->createToken('spa')->plainTextToken];
}

function replyTo(Ticket $ticket, User $agent, string $body = 'A reply', string $visibility = 'public'): TestResponse
{
    return test()->withHeaders(agentAuth($agent))
        ->postJson("/api/tickets/{$ticket->id}/messages", ['body' => $body, 'visibility' => $visibility]);
}

it('an agent public reply on a connected email ticket writes exactly one outbound row addressed correctly', function () {
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value, 'assigned_to' => $this->agent->id]);

    ChannelInboundMessage::factory()->create([
        'ticket_id' => $ticket->id,
        'provider_message_id' => 'the-inbound-id@x',
        'received_at' => now(),
    ]);

    replyTo($ticket, $this->agent, 'Thanks for reaching out')->assertCreated();

    expect(ChannelOutboundMessage::count())->toBe(1);
    $row = ChannelOutboundMessage::first();
    expect($row->recipient)->toBe('customer@example.com');
    expect($row->in_reply_to)->toBe('the-inbound-id@x');
});

it('an internal note writes zero rows and sends nothing', function () {
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value, 'assigned_to' => $this->agent->id]);

    replyTo($ticket, $this->agent, 'internal note text', 'internal')->assertCreated();

    expect(ChannelOutboundMessage::count())->toBe(0);
    Http::assertNothingSent();
});

it('a reply on a chat ticket writes zero rows; on web_form, zero rows', function () {
    $chatCustomer = Customer::factory()->create();
    $chatTicket = Ticket::factory()->create(['customer_id' => $chatCustomer->id, 'channel' => Channel::Chat->value, 'assigned_to' => $this->agent->id]);
    replyTo($chatTicket, $this->agent)->assertCreated();
    expect(ChannelOutboundMessage::count())->toBe(0);

    $webFormCustomer = Customer::factory()->create();
    $webFormTicket = Ticket::factory()->create(['customer_id' => $webFormCustomer->id, 'channel' => Channel::WebForm->value, 'assigned_to' => $this->agent->id]);
    replyTo($webFormTicket, $this->agent)->assertCreated();
    expect(ChannelOutboundMessage::count())->toBe(0);
});

it('a reply on a channel with no connection writes zero rows', function () {
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value, 'assigned_to' => $this->agent->id]);

    replyTo($ticket, $this->agent)->assertCreated();

    expect(ChannelOutboundMessage::count())->toBe(0);
});

it('with channels.enabled = false, zero rows and the payload closure is never invoked', function () {
    config(['channels.enabled' => false]);
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value, 'assigned_to' => $this->agent->id]);

    $calls = 0;
    $message = $ticket->messages()->create([
        'author_type' => TicketMessage::AUTHOR_AGENT,
        'user_id' => $this->agent->id,
        'customer_id' => null,
        'channel' => $ticket->channel,
        'body' => 'x',
        'visibility' => 'public',
    ]);

    app(ChannelOutbox::class)->enqueue($message, function () use (&$calls) {
        $calls++;

        return ['recipient' => 'x@example.com', 'body' => 'x', 'in_reply_to' => null];
    });

    expect($calls)->toBe(0);
    expect(ChannelOutboundMessage::count())->toBe(0);
});

it('the reply\'s own transaction rolling back takes the outbox row with it', function () {
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value, 'assigned_to' => $this->agent->id]);

    try {
        DB::transaction(function () use ($ticket) {
            $message = $ticket->messages()->create([
                'author_type' => TicketMessage::AUTHOR_AGENT,
                'user_id' => $this->agent->id,
                'customer_id' => null,
                'channel' => $ticket->channel,
                'body' => 'x',
                'visibility' => 'public',
            ]);

            app(ChannelOutbox::class)->enqueue($message, fn () => ChannelOutbox::replyPayload($message, $ticket));

            throw new RuntimeException('force rollback');
        });
    } catch (RuntimeException) {
        // expected
    }

    expect(ChannelOutboundMessage::count())->toBe(0);
});

it('enqueuing the same ticket_message_id twice yields one row, not a QueryException', function () {
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value, 'assigned_to' => $this->agent->id]);

    $message = $ticket->messages()->create([
        'author_type' => TicketMessage::AUTHOR_AGENT,
        'user_id' => $this->agent->id,
        'customer_id' => null,
        'channel' => $ticket->channel,
        'body' => 'x',
        'visibility' => 'public',
    ]);

    $outbox = app(ChannelOutbox::class);
    $payload = fn () => ChannelOutbox::replyPayload($message, $ticket);

    $outbox->enqueue($message, $payload);
    $outbox->enqueue($message, $payload);

    expect(ChannelOutboundMessage::count())->toBe(1);
});

it('beyond inline_max_per_request, rows are still created and merely not attempted inline', function () {
    config(['channels.outbound.inline_max_per_request' => 1]);
    connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $customer = Customer::factory()->create(['email' => 'customer@example.com']);

    for ($i = 0; $i < 3; $i++) {
        $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'channel' => Channel::Email->value, 'assigned_to' => $this->agent->id]);
        replyTo($ticket, $this->agent, "reply number {$i}")->assertCreated();
    }

    expect(ChannelOutboundMessage::count())->toBe(3);
});
