<?php

use App\Models\Customer;
use App\Models\PortalSession;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function portalSessionFor(Customer $customer, string $token): PortalSession
{
    return PortalSession::factory()->for($customer)->withToken($token)->create();
}

it('lists only the caller open tickets for scope=open', function () {
    $customer = Customer::factory()->create();
    portalSessionFor($customer, 'open-token');

    $open = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'open']);
    $resolved = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'resolved']);
    $otherCustomerTicket = Ticket::factory()->create(['status' => 'open']);

    $res = $this->asToken('open-token')->getJson('/api/portal/requests?scope=open')->assertOk();

    $ids = collect($res->json('data'))->pluck('id');
    expect($ids)->toContain($open->id)
        ->and($ids)->not->toContain($resolved->id)
        ->and($ids)->not->toContain($otherCustomerTicket->id);
});

it('lists only the caller past tickets for scope=past, ordered by resolution date', function () {
    $customer = Customer::factory()->create();
    portalSessionFor($customer, 'past-token');

    $olderResolved = Ticket::factory()->create([
        'customer_id' => $customer->id, 'status' => 'resolved', 'resolved_at' => now()->subDays(5),
    ]);
    $newerClosed = Ticket::factory()->create([
        'customer_id' => $customer->id, 'status' => 'closed', 'resolved_at' => now()->subDay(),
    ]);
    $open = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'open']);

    $res = $this->asToken('past-token')->getJson('/api/portal/requests?scope=past')->assertOk();

    $ids = collect($res->json('data'))->pluck('id');
    expect($ids->all())->toBe([$newerClosed->id, $olderResolved->id]);
    expect($ids)->not->toContain($open->id);
});

it('falls back to scope=open for a junk scope value', function () {
    $customer = Customer::factory()->create();
    portalSessionFor($customer, 'junk-token');

    $open = Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'open']);

    $res = $this->asToken('junk-token')->getJson('/api/portal/requests?scope=nonsense')->assertOk();

    expect(collect($res->json('data'))->pluck('id'))->toContain($open->id);
});

it('matches the frozen PortalTicketResource key set exactly', function () {
    $customer = Customer::factory()->create();
    portalSessionFor($customer, 'shape-token');
    Ticket::factory()->create(['customer_id' => $customer->id, 'status' => 'open']);

    $res = $this->asToken('shape-token')->getJson('/api/portal/requests?scope=open')->assertOk();

    expect(array_keys($res->json('data.0')))->toBe([
        'id', 'subject', 'status', 'status_label', 'category', 'category_label',
        'channel', 'channel_label', 'created_at', 'last_activity_at', 'resolved_at',
        'closed_at', 'message_count', 'feedback_url',
    ]);
});

it('paginates', function () {
    $customer = Customer::factory()->create();
    portalSessionFor($customer, 'page-token');
    Ticket::factory()->count(25)->create(['customer_id' => $customer->id, 'status' => 'open']);

    $res = $this->asToken('page-token')->getJson('/api/portal/requests?scope=open')->assertOk();

    expect($res->json('data'))->toHaveCount(20);
    expect($res->json('meta.total'))->toBe(25);
});
