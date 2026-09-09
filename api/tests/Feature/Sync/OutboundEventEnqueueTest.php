<?php

use App\Enums\IntegrationEvent;
use App\Enums\UserRole;
use App\Models\CsatSurvey;
use App\Models\Customer;
use App\Models\Integration;
use App\Models\IntegrationOutboxMessage;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Integrations\IntegrationEvents;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\URL;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['integrations.sync.enabled' => true]);
    bindOutboundUrlGuard(true);
});

function outboundIntegration(array $events = []): Integration
{
    return Integration::factory()->outbound($events)->create();
}

function signedCsatShow(CsatSurvey $survey): string
{
    return URL::temporarySignedRoute('csat.show', $survey->expires_at, ['uuid' => $survey->uuid]);
}

it('enqueues exactly one ticket.created row with the frozen payload shape', function () {
    outboundIntegration();
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $customer = Customer::factory()->create(['email' => 'cust@example.com']);
    $ticket = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'open']);

    $message = IntegrationOutboxMessage::where('event', 'ticket.created')->where('event_id', 'ticket.created:'.$ticket->id)->first();

    expect($message)->not->toBeNull();
    expect($message->payload['event'])->toBe('ticket.created');
    expect($message->payload['event_id'])->toBe('ticket.created:'.$ticket->id);
    expect($message->payload['data']['id'])->toBe($ticket->id);
    expect($message->payload['data']['customer']['email'])->toBe('cust@example.com');
});

it('enqueues one ticket.resolved row with the cycle in its event_id', function () {
    outboundIntegration();
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create(['status' => 'open']);

    $this->asUser($agent)->patchJson('/api/tickets/'.$ticket->id, ['status' => 'resolved'])->assertOk();

    $message = IntegrationOutboxMessage::where('event', 'ticket.resolved')->first();
    expect($message)->not->toBeNull();
    expect($message->event_id)->toBe('ticket.resolved:'.$ticket->id.':1');
});

it('a rolled-back resolve enqueues nothing and sends nothing', function () {
    outboundIntegration(); // ticket.created also fires on the factory create() below
    Http::fake();

    $ticket = Ticket::factory()->create(['status' => 'open']);
    IntegrationOutboxMessage::query()->delete(); // isolate: only the resolve matters here

    try {
        DB::transaction(function () use ($ticket) {
            $ticket->update(['status' => 'resolved', 'resolved_at' => now()]);
            throw new RuntimeException('boom');
        });
    } catch (RuntimeException) {
        // expected
    }

    expect(IntegrationOutboxMessage::where('event', 'ticket.resolved')->count())->toBe(0);
    Http::assertNothingSent();
});

it('submitting a CSAT response enqueues one row; a second submission enqueues no more', function () {
    outboundIntegration();
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $survey = CsatSurvey::factory()->create();

    $this->postJson(signedCsatShow($survey), ['rating' => 5])->assertOk();
    $this->postJson(signedCsatShow($survey), ['rating' => 1])->assertOk();

    expect(IntegrationOutboxMessage::where('event', 'csat.submitted')->count())->toBe(1);
});

it('bulk-resolving 12 tickets enqueues 12 rows and attempts at most inline_max_per_request', function () {
    config(['integrations.sync.outbound.inline_max_per_request' => 5]);
    outboundIntegration();
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $lead = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $tickets = collect(range(1, 12))->map(fn () => Ticket::factory()->assignedTo($lead)->create(['status' => 'open']));

    $this->asUser($lead)->postJson('/api/tickets/bulk', [
        'ids' => $tickets->pluck('id')->all(),
        'action' => 'status',
        'status' => 'resolved',
    ])->assertOk();

    // 12 creates + 12 resolves = 24 outbox rows total (both events enabled).
    expect(IntegrationOutboxMessage::count())->toBe(24);
    Http::assertSentCount(5);
});

it('enqueues nothing when sync is disabled', function () {
    config(['integrations.sync.enabled' => false]);
    outboundIntegration();
    Http::fake();

    Ticket::factory()->create();

    expect(IntegrationOutboxMessage::count())->toBe(0);
    Http::assertNothingSent();
});

it('enqueues nothing when no ERP row exists', function () {
    Http::fake();

    Ticket::factory()->create();

    expect(IntegrationOutboxMessage::count())->toBe(0);
    Http::assertNothingSent();
});

it('enqueues nothing when outbound_enabled is false', function () {
    Integration::factory()->create(['outbound_enabled' => false]);
    Http::fake();

    Ticket::factory()->create();

    expect(IntegrationOutboxMessage::count())->toBe(0);
    Http::assertNothingSent();
});

it('enqueues nothing when the event is not in outbound_events', function () {
    outboundIntegration(['csat.submitted']); // ticket.created excluded
    Http::fake();

    Ticket::factory()->create();

    expect(IntegrationOutboxMessage::count())->toBe(0);
    Http::assertNothingSent();
});

it('enqueues nothing when outbound_url is blank', function () {
    Integration::factory()->outbound()->create(['outbound_url' => null]);
    Http::fake();

    Ticket::factory()->create();

    expect(IntegrationOutboxMessage::count())->toBe(0);
    Http::assertNothingSent();
});

it('the payload contains no internal note, message body, assignee, or secret', function () {
    outboundIntegration();
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $agent = User::factory()->create(['role' => UserRole::TeamLead, 'is_active' => true]);
    $ticket = Ticket::factory()->assignedTo($agent)->create(['description' => 'A description', 'status' => 'open']);

    $message = IntegrationOutboxMessage::where('event', 'ticket.created')->first();
    $json = json_encode($message->payload);

    expect($json)->not->toContain('sk_test_');
    expect($message->payload['data'])->not->toHaveKey('assignee');
    expect($message->payload['data'])->not->toHaveKey('assigned_to');
});

it('description and comment are truncated to payload_max_chars', function () {
    config(['integrations.sync.outbound.payload_max_chars' => 20]);
    outboundIntegration();
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $ticket = Ticket::factory()->create(['description' => str_repeat('x', 500), 'status' => 'open']);

    $message = IntegrationOutboxMessage::where('event', 'ticket.created')->first();
    expect(strlen($message->payload['data']['description']))->toBeLessThanOrEqual(23); // Str::limit appends "..."
});

it('enqueuing the same event_id twice inserts one row and surfaces no exception', function () {
    $integration = outboundIntegration();
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    app(IntegrationEvents::class)->record(
        IntegrationEvent::TicketCreated,
        'ticket.created:999',
        fn () => ['data' => ['id' => 999]],
    );
    app(IntegrationEvents::class)->record(
        IntegrationEvent::TicketCreated,
        'ticket.created:999',
        fn () => ['data' => ['id' => 999]],
    );

    expect(IntegrationOutboxMessage::where('event_id', 'ticket.created:999')->count())->toBe(1);
});
