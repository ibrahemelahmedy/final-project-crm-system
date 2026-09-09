<?php

use App\Enums\SyncRunTrigger;
use App\Models\Customer;
use App\Models\Integration;
use App\Models\SyncRun;
use App\Services\Integrations\CustomerPuller;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['integrations.sync.enabled' => true]);
    bindOutboundUrlGuard(true);
});

function remoteRecord(string $id, string $name, string $email, ?string $phone = null, ?string $company = null, ?string $tier = null): array
{
    return [
        'id' => $id,
        'attributes' => ['display_name' => $name],
        'contact' => ['email' => $email, 'phone' => $phone],
        'account' => ['name' => $company],
        'segment' => $tier,
    ];
}

/**
 * Queues every page for every `pull()` call in a test, in call order, ended
 * with an empty fallback. Http::fakeSequence() registers a NEW handler each
 * time it is called, but a request always matches the FIRST-registered
 * handler for a pattern — a second fakeSequence() call mid test never
 * intercepts anything, so a test with two `pull()` calls must enqueue both
 * calls' pages up front.
 */
function pullSequence(array ...$pages): void
{
    $sequence = Http::fakeSequence();

    foreach ($pages as $page) {
        $sequence->push($page);
    }

    $sequence->whenEmpty(Http::response([]));
}

it('imports three new customers from a one-page response', function () {
    $integration = Integration::factory()->inbound()->create();

    pullSequence([
        remoteRecord('ext-1', 'Alice A', 'alice@example.com'),
        remoteRecord('ext-2', 'Bob B', 'bob@example.com'),
        remoteRecord('ext-3', 'Cara C', 'cara@example.com'),
    ]);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->records_read)->toBe(3)
        ->and($run->records_created)->toBe(3)
        ->and($run->records_updated)->toBe(0)
        ->and($run->records_skipped)->toBe(0)
        ->and($run->records_failed)->toBe(0)
        ->and($run->status->value)->toBe('success');

    expect(Customer::count())->toBe(3);
});

it('follows pagination with our own page counter until an empty page', function () {
    $integration = Integration::factory()->inbound()->create();

    pullSequence(
        [remoteRecord('ext-1', 'Alice', 'alice@example.com')],
        [remoteRecord('ext-2', 'Bob', 'bob@example.com')],
        [],
    );

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $requests = Http::recorded();
    expect($requests)->toHaveCount(3);

    foreach ($requests as $i => [$request, $response]) {
        expect($request->url())->toContain('page='.($i + 1));
    }
});

it('applies the field map and lower-cases the email through the mutator', function () {
    $integration = Integration::factory()->inbound()->create();

    pullSequence([remoteRecord('ext-1', 'Dana D', 'DANA@EXAMPLE.COM')]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $customer = Customer::where('external_id', 'ext-1')->first();
    expect($customer->name)->toBe('Dana D');
    expect($customer->email)->toBe('dana@example.com');
});

it('is idempotent: a second run over identical data writes nothing and updated_at is unchanged', function () {
    $integration = Integration::factory()->inbound()->create();
    $record = remoteRecord('ext-1', 'Eve E', 'eve@example.com', '+15550001111', 'Acme', 'premium');

    // Call 1: page 1 (record) + page 2 (empty, via the sequence's own pushes).
    // Call 2: page 1 (record again) + page 2 falls through to whenEmpty().
    pullSequence([$record], [], [$record]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);
    $after1 = Customer::where('external_id', 'ext-1')->first();
    $updatedAtAfter1 = $after1->updated_at;

    $run2 = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run2->records_created)->toBe(0)
        ->and($run2->records_updated)->toBe(0)
        ->and($run2->records_skipped)->toBe(1);

    $after2 = Customer::where('external_id', 'ext-1')->first();
    expect($after2->updated_at->equalTo($updatedAtAfter1))->toBeTrue();
});

it('updates exactly the changed field and bumps external_synced_at', function () {
    $integration = Integration::factory()->inbound()->create();

    pullSequence(
        [remoteRecord('ext-1', 'Frank F', 'frank@example.com')],
        [],
        [remoteRecord('ext-1', 'Frank Farley', 'frank@example.com')],
    );

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $before = Customer::where('external_id', 'ext-1')->first();
    $beforeSyncedAt = $before->external_synced_at;

    $run2 = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    $after = Customer::where('external_id', 'ext-1')->first();
    expect($run2->records_updated)->toBe(1);
    expect($after->name)->toBe('Frank Farley');
    expect($after->external_synced_at->greaterThanOrEqualTo($beforeSyncedAt))->toBeTrue();
});

it('upserts by (integration_id, external_id), not by email — a matching local email with no external id creates a new row', function () {
    $integration = Integration::factory()->inbound()->create();
    Customer::factory()->create(['email' => 'shared@example.com']);

    pullSequence([remoteRecord('ext-1', 'Shared Name', 'shared@example.com')]);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    // The duplicate unique index rejects the second row with the same email.
    expect($run->records_failed)->toBe(1);
    expect($run->errors[0]['reason_key'])->toBe('integrations.sync.error.duplicate');
});

it('counts records_read by record, not by page', function () {
    $integration = Integration::factory()->inbound()->create();

    pullSequence([remoteRecord('ext-1', 'A', 'a@example.com'), remoteRecord('ext-2', 'B', 'b@example.com')], []);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->records_read)->toBe(2);
});

it('stops at max_records_per_run and finishes success', function () {
    config(['integrations.sync.inbound.max_records_per_run' => 2]);
    config(['integrations.sync.inbound.page_size' => 1]);
    $integration = Integration::factory()->inbound()->create();

    pullSequence(
        [remoteRecord('ext-1', 'A', 'a@example.com')],
        [remoteRecord('ext-2', 'B', 'b@example.com')],
        [remoteRecord('ext-3', 'C', 'c@example.com')],
    );

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual);

    expect($run->records_read)->toBe(2);
    expect($run->status->value)->toBe('success');
    expect(Http::recorded())->toHaveCount(2);
});

it('a --dry-run invocation writes no customer and no SyncRun', function () {
    $integration = Integration::factory()->inbound()->create();

    pullSequence([remoteRecord('ext-1', 'Dry Run', 'dry@example.com')]);

    app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Manual, dryRun: true);

    expect(Customer::count())->toBe(0);
    expect(SyncRun::count())->toBe(0);
});

// Plan-review regression (Decision 9 / Done Criterion 4): a run that fails on
// page 2 must still report the records page 1 actually read. `records_read` is
// flushed after the loop, so the mid-loop failure sites must `break`, not
// `return`, or the history shows created > 0 alongside read = 0.
it('reports records_read for pages already consumed when a later page fails the run', function () {
    $integration = Integration::factory()->inbound()->create();

    Http::fakeSequence()
        ->push([
            remoteRecord('ext-1', 'Alice A', 'alice@example.com'),
            remoteRecord('ext-2', 'Bob B', 'bob@example.com'),
        ])
        ->push('<html>not json</html>', 200);

    $run = app(CustomerPuller::class)->pull($integration, SyncRunTrigger::Scheduled);

    expect($run->status->value)->toBe('failed');
    expect($run->error_key)->toBe('integrations.sync.error.bad_payload');
    expect($run->records_created)->toBe(2);
    // The bug this pins: read must not be 0 while created is 2.
    expect($run->records_read)->toBe(2);
    expect($run->finished_at)->not->toBeNull();
});
