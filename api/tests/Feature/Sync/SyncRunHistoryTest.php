<?php

use App\Enums\SyncRunTrigger;
use App\Enums\UserRole;
use App\Models\Integration;
use App\Models\SyncRun;
use App\Models\User;
use App\Services\Integrations\CustomerPuller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['integrations.sync.enabled' => true]);
});

function historyRecord(string $id, ?string $name = 'Name'): array
{
    return [
        'id' => $id,
        'attributes' => ['display_name' => $name],
        'contact' => ['email' => null, 'phone' => null],
        'account' => ['name' => null],
        'segment' => null,
    ];
}

it('records accurate counters and a null error_key for a successful run', function () {
    bindOutboundUrlGuard(true);
    $integration = Integration::factory()->inbound()->create();

    Http::fakeSequence()->push([historyRecord('ext-1')])->whenEmpty(Http::response([]));

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->status->value)->toBe('success');
    expect($run->error_key)->toBeNull();
    expect($run->records_created)->toBe(1);
});

it('finishes partial with two bad rows and two error entries, each with an i18n reason_key', function () {
    bindOutboundUrlGuard(true);
    $integration = Integration::factory()->inbound()->create();

    Http::fakeSequence()
        ->push([historyRecord('ext-1', null), historyRecord('ext-2', '')])
        ->whenEmpty(Http::response([]));

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->status->value)->toBe('partial');
    expect($run->records_failed)->toBe(2);
    expect(count($run->errors))->toBe(2);

    foreach ($run->errors as $error) {
        expect($error['reason_key'])->toBe('integrations.sync.error.missing_name');
    }
});

it('caps the error list at max_error_rows while records_failed keeps counting', function () {
    config(['integrations.sync.max_error_rows' => 2]);
    bindOutboundUrlGuard(true);
    $integration = Integration::factory()->inbound()->create();

    $badRecords = array_map(fn ($i) => historyRecord('ext-'.$i, null), range(1, 5));

    Http::fakeSequence()->push($badRecords)->whenEmpty(Http::response([]));

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->records_failed)->toBe(5);
    expect(count($run->errors))->toBe(2);
});

it('never leaks the secret, endpoint, or an exception message into errors', function () {
    config(['integrations.sync.max_error_rows' => 10]);
    bindOutboundUrlGuard(true);
    $integration = Integration::factory()->inbound()->create();

    Http::fakeSequence()->push([historyRecord('ext-1', null)])->whenEmpty(Http::response([]));

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $json = json_encode($run->errors);
    expect($json)->not->toContain('sk_test_');
    expect($json)->not->toContain($integration->inbound_url);
});

it('lists runs newest-first, paginated, through GET /sync-runs', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $integration = Integration::factory()->inbound()->create();

    SyncRun::factory()->for($integration)->create(['started_at' => now()->subHour()]);
    SyncRun::factory()->for($integration)->create(['started_at' => now()]);

    $response = $this->asUser($admin)->getJson('/api/admin/integrations/erp/sync-runs')->assertOk();

    $dates = collect($response->json('data'))->pluck('started_at');
    expect($dates->first())->toBeGreaterThanOrEqual($dates->last());
});

it('finishes a guard-rejected run as failed with finished_at set and leaves no running row', function () {
    bindOutboundUrlGuard(false, 'integrations.error.blocked_host');
    $integration = Integration::factory()->inbound()->create();

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->status->value)->toBe('failed');
    expect($run->finished_at)->not->toBeNull();
    expect(SyncRun::where('status', 'running')->count())->toBe(0);
});

it('duration_seconds is null while running and an integer once finished', function () {
    $run = SyncRun::factory()->running()->create();
    expect($run->durationSeconds())->toBeNull();

    $run->finished_at = $run->started_at->copy()->addSeconds(5);
    expect($run->durationSeconds())->toBe(5);
});
