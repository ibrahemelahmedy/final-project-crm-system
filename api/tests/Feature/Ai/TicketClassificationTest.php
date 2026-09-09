<?php

use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\PortalSession;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\User;
use App\Services\Ai\AssistGenerator;
use App\Services\Ai\AssistResult;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['ai.enabled' => true, 'ai.classify.enabled' => true]);
});

function createTicketViaApi(array $overrides = []): array
{
    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $customer = Customer::factory()->create();

    $res = test()->asUser($agent)->postJson('/api/tickets', array_merge([
        'subject' => 'VPN keeps dropping',
        'description' => 'The office VPN disconnects every few minutes and nobody can work.',
        'customer_id' => $customer->id,
        'category' => 'billing',
        'priority' => 'low',
        'channel' => 'email',
    ], $overrides));

    return [$res, $agent, $customer];
}

it('stores a confident suggestion without touching category or priority', function () {
    bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.92,"reason":"x"}');

    [$res] = createTicketViaApi();
    $res->assertCreated();

    $ticket = Ticket::latest('id')->first()->fresh();

    expect($ticket->ai_suggested_category)->toBe('technical')
        ->and($ticket->ai_suggested_priority)->toBe('urgent')
        ->and($ticket->ai_confidence)->toBe(0.92)
        ->and($ticket->needs_triage)->toBeFalse()
        ->and($ticket->category)->toBe('billing')
        ->and($ticket->priority)->toBe(Priority::Low);
});

it('writes no category_changed or priority_changed event from classification', function () {
    bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.92}');

    [$res] = createTicketViaApi();
    $ticket = Ticket::latest('id')->first();

    expect(TicketEvent::where('ticket_id', $ticket->id)
        ->whereIn('event', ['category_changed', 'priority_changed'])->count())->toBe(0);
});

it('audits an agent override and clears needs_triage', function () {
    bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.2}');

    [, $agent] = createTicketViaApi();
    $ticket = Ticket::latest('id')->first();
    expect($ticket->fresh()->needs_triage)->toBeTrue();

    test()->asUser($agent)->patchJson("/api/tickets/{$ticket->id}", ['category' => 'technical'])
        ->assertOk();

    expect($ticket->fresh()->needs_triage)->toBeFalse()
        ->and(TicketEvent::where('ticket_id', $ticket->id)
            ->where('event', 'category_changed')->where('user_id', $agent->id)->exists())->toBeTrue();
});

it('stores no suggestion and flags triage on low confidence', function () {
    bindAssistGenerator('{"category":"billing","priority":"high","confidence":0.2}');

    createTicketViaApi();
    $ticket = Ticket::latest('id')->first()->fresh();

    expect($ticket->ai_suggested_category)->toBeNull()
        ->and($ticket->ai_suggested_priority)->toBeNull()
        ->and($ticket->ai_confidence)->toBe(0.2)
        ->and($ticket->ai_classified_at)->not->toBeNull()
        ->and($ticket->needs_triage)->toBeTrue();
});

it('treats an invalid enum value as low confidence', function () {
    bindAssistGenerator('{"category":"Refunds","priority":"urgent","confidence":0.99}');

    createTicketViaApi();
    $ticket = Ticket::latest('id')->first()->fresh();

    expect($ticket->needs_triage)->toBeTrue()
        ->and($ticket->ai_suggested_category)->toBeNull()
        ->and($ticket->ai_suggested_priority)->toBeNull();
});

it('treats unparseable output as low confidence', function () {
    bindAssistGenerator('I think this is billing.');

    createTicketViaApi();
    $ticket = Ticket::latest('id')->first()->fresh();

    expect($ticket->ai_confidence)->toBe(0.0)
        ->and($ticket->needs_triage)->toBeTrue();
});

it('leaves the ticket untouched on a provider failure', function () {
    bindFailingAssistGenerator();

    [$res] = createTicketViaApi();
    $res->assertCreated();

    $ticket = Ticket::latest('id')->first()->fresh();

    expect($ticket->ai_classified_at)->toBeNull()
        ->and($ticket->needs_triage)->toBeFalse()
        ->and($ticket->ai_confidence)->toBeNull()
        ->and($ticket->category)->toBe('billing')
        ->and($ticket->priority)->toBe(Priority::Low);
});

it('skips classification when ai.enabled is false', function () {
    config(['ai.enabled' => false]);
    $fake = bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.9}');

    createTicketViaApi();

    expect($fake->timesCalled)->toBe(0)
        ->and(Ticket::latest('id')->first()->ai_classified_at)->toBeNull();
});

it('skips classification when ai.classify.enabled is false', function () {
    config(['ai.classify.enabled' => false]);
    $fake = bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.9}');

    createTicketViaApi();

    expect($fake->timesCalled)->toBe(0)
        ->and(Ticket::latest('id')->first()->ai_classified_at)->toBeNull();
});

it('classifies a ticket created through the portal path', function () {
    bindAssistGenerator('{"category":"technical","priority":"normal","confidence":0.88}');

    $customer = Customer::factory()->create();
    PortalSession::factory()->for($customer)->withToken('portal-classify-token')->create();

    test()->asToken('portal-classify-token')->postJson('/api/portal/requests', [
        'subject' => 'App will not load',
        'description' => 'The dashboard is stuck on a spinner.',
        'category' => 'general',
    ])->assertCreated();

    expect(Ticket::latest('id')->first()->fresh()->ai_suggested_category)->toBe('technical');
});

it('holds the per-request classification cap', function () {
    config(['ai.classify.max_per_request' => 1]);
    $fake = bindAssistGenerator('{"category":"technical","priority":"normal","confidence":0.9}');

    $agent = User::factory()->create(['role' => UserRole::Agent, 'is_active' => true]);
    $customer = Customer::factory()->create();

    foreach ([1, 2] as $n) {
        test()->asUser($agent)->postJson('/api/tickets', [
            'subject' => "Ticket {$n}",
            'description' => 'Something is wrong.',
            'customer_id' => $customer->id,
            'category' => 'general',
            'priority' => 'normal',
            'channel' => 'email',
        ])->assertCreated();
    }

    expect($fake->timesCalled)->toBe(1);
});

it('does not move updated_at when classifying', function () {
    bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.92}');

    createTicketViaApi();
    $ticket = Ticket::latest('id')->first();
    $before = $ticket->updated_at;

    expect($ticket->fresh()->ai_classified_at)->not->toBeNull()
        ->and($ticket->fresh()->updated_at->equalTo($before))->toBeTrue();
});

it('clamps the classification model id to 64 characters', function () {
    $fake = bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.92}');
    // The Pest fake hard-codes model 'claude-opus-5'; override by binding a
    // generator that returns a long model id.
    app()->instance(AssistGenerator::class, new class implements AssistGenerator
    {
        public function generate(string $system, string $transcript): AssistResult
        {
            return new AssistResult(
                '{"category":"technical","priority":"urgent","confidence":0.92}',
                str_repeat('m', 200), 10, 5,
            );
        }
    });

    createTicketViaApi();

    expect(strlen(Ticket::latest('id')->first()->ai_classification_model))->toBe(64);
});

it('exposes ai_confidence as a float in the resource', function () {
    bindAssistGenerator('{"category":"technical","priority":"urgent","confidence":0.9}');

    [, $agent] = createTicketViaApi();
    $ticket = Ticket::latest('id')->first();

    $confidence = test()->asUser($agent)->getJson("/api/tickets/{$ticket->id}")
        ->json('data.ai_classification.confidence');

    expect(is_float($confidence))->toBeTrue();
});
