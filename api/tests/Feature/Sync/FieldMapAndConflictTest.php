<?php

use App\Enums\SyncRunTrigger;
use App\Enums\UserRole;
use App\Models\Customer;
use App\Models\Integration;
use App\Models\User;
use App\Services\Integrations\CustomerPuller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['integrations.sync.enabled' => true]);
    bindOutboundUrlGuard(true);
});

function fieldMapRecord(array $overrides = []): array
{
    return array_replace([
        'id' => 'ext-1',
        'attributes' => ['display_name' => 'Remote Name'],
        'contact' => ['email' => 'remote@example.com', 'phone' => '+15550009999'],
        'account' => ['name' => 'Remote Co'],
        'segment' => 'premium',
    ], $overrides);
}

function pushPageThenEmpty(array $records): void
{
    Http::fakeSequence()->push($records)->whenEmpty(Http::response([]));
}

/** See InboundCustomerPullTest's pullSequence() docblock for why this must be one call. */
function pushPages(array ...$pages): void
{
    $sequence = Http::fakeSequence();

    foreach ($pages as $page) {
        $sequence->push($page);
    }

    $sequence->whenEmpty(Http::response([]));
}

it('remote_wins overwrites a non-empty local value', function () {
    $integration = Integration::factory()->inbound([], ['name' => 'remote_wins'])->create();
    $customer = Customer::factory()->create(['name' => 'Local Name']);
    $customer->forceFill(['integration_id' => $integration->id, 'external_id' => 'ext-1'])->save();

    pushPageThenEmpty([fieldMapRecord(['attributes' => ['display_name' => 'Remote Wins Name']])]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($customer->fresh()->name)->toBe('Remote Wins Name');
});

it('wisal_wins leaves a non-empty local value untouched', function () {
    $integration = Integration::factory()->inbound([], ['name' => 'wisal_wins'])->create();
    $customer = Customer::factory()->create(['name' => 'Keep Me']);
    $customer->forceFill(['integration_id' => $integration->id, 'external_id' => 'ext-1'])->save();

    pushPageThenEmpty([fieldMapRecord(['attributes' => ['display_name' => 'Should Not Apply']])]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($customer->fresh()->name)->toBe('Keep Me');
});

it('wisal_wins fills a null local value', function () {
    $integration = Integration::factory()->inbound([
        'external_id' => 'id',
        'company' => 'account.name',
    ], ['company' => 'wisal_wins'])->create();

    $customer = Customer::factory()->create(['company' => null]);
    $customer->forceFill(['integration_id' => $integration->id, 'external_id' => 'ext-1'])->save();

    pushPageThenEmpty([fieldMapRecord(['account' => ['name' => 'Filled Co']])]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($customer->fresh()->company)->toBe('Filled Co');
});

it('an absent remote field is never written under either rule', function () {
    $integration = Integration::factory()->inbound()->create();
    $customer = Customer::factory()->create(['company' => 'Original Co']);
    $customer->forceFill(['integration_id' => $integration->id, 'external_id' => 'ext-1'])->save();

    pushPageThenEmpty([fieldMapRecord(['account' => []])]); // account.name missing entirely

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($customer->fresh()->company)->toBe('Original Co');
});

it('a null remote field is never written', function () {
    $integration = Integration::factory()->inbound()->create();
    $customer = Customer::factory()->create(['company' => 'Original Co']);
    $customer->forceFill(['integration_id' => $integration->id, 'external_id' => 'ext-1'])->save();

    pushPageThenEmpty([fieldMapRecord(['account' => ['name' => null]])]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($customer->fresh()->company)->toBe('Original Co');
});

it('an unmapped field is never written', function () {
    $integration = Integration::factory()->inbound(['external_id' => 'id', 'name' => 'attributes.display_name'])->create();

    pushPageThenEmpty([fieldMapRecord()]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $customer = Customer::where('external_id', 'ext-1')->first();
    expect($customer->company)->toBeNull();
});

it('a field name not in SyncFieldMap::FIELDS present in the stored map is ignored', function () {
    $integration = Integration::factory()->inbound([
        'external_id' => 'id',
        'name' => 'attributes.display_name',
        'not_a_real_field' => 'attributes.display_name',
    ])->create();

    pushPageThenEmpty([fieldMapRecord()]);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->status->value)->toBe('success');
    expect(Customer::where('external_id', 'ext-1')->exists())->toBeTrue();
});

it('a bad email is omitted with bad_email and the record still imports', function () {
    $integration = Integration::factory()->inbound()->create();

    pushPageThenEmpty([fieldMapRecord(['contact' => ['email' => 'not-an-email', 'phone' => null]])]);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->records_created)->toBe(1);
    $customer = Customer::where('external_id', 'ext-1')->first();
    expect($customer)->not->toBeNull();
    expect($customer->email)->toBeNull();
    expect(collect($run->errors)->pluck('reason_key'))->toContain('integrations.sync.error.bad_email');
});

it('a bad tier is omitted with bad_tier and the row is created with standard', function () {
    $integration = Integration::factory()->inbound()->create();

    pushPageThenEmpty([fieldMapRecord(['segment' => 'platinum'])]);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $customer = Customer::where('external_id', 'ext-1')->first();
    expect($customer->tier->value)->toBe('standard');
    expect(collect($run->errors)->pluck('reason_key'))->toContain('integrations.sync.error.bad_tier');
});

it('editing the map through PUT /sync-config changes what the next run writes', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $integration = Integration::factory()->inbound([
        'external_id' => 'id',
        'name' => 'attributes.display_name',
    ])->create();

    pushPages([fieldMapRecord(['account' => ['name' => 'Newly Mapped Co']])], [], [fieldMapRecord(['account' => ['name' => 'Newly Mapped Co']])]);
    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $before = Customer::where('external_id', 'ext-1')->first();
    expect($before->company)->toBeNull();

    $this->asUser($admin)->putJson('/api/admin/integrations/erp/sync-config', [
        'inbound_enabled' => true,
        'inbound_url' => $integration->inbound_url,
        'inbound_field_map' => ['external_id' => 'id', 'name' => 'attributes.display_name', 'company' => 'account.name'],
        'conflict_rules' => ['company' => 'remote_wins'],
        'outbound_enabled' => false,
    ])->assertOk();

    app(CustomerPuller::class)->pull($integration->fresh(), SyncRunTrigger::Manual);

    expect($before->fresh()->company)->toBe('Newly Mapped Co');
});
