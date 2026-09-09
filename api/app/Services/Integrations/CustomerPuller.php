<?php

namespace App\Services\Integrations;

use App\Enums\SyncDirection;
use App\Enums\SyncRunStatus;
use App\Enums\SyncRunTrigger;
use App\Models\Customer;
use App\Models\Integration;
use App\Models\SyncRun;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Story 25 (WIS-24). The inbound engine — pages a configured ERP collection
 * endpoint, maps remote fields onto Wisal fields, resolves conflicts, and
 * upserts by (integration_id, external_id). Writes through the Customer
 * MODEL, never a query-builder upsert(), so the email/phone mutators run.
 */
class CustomerPuller
{
    public function __construct(private readonly OutboundHttpClient $http) {}

    public function pull(Integration $integration, SyncRunTrigger $trigger, bool $dryRun = false): SyncRun
    {
        $attributes = [
            'integration_id' => $integration->id,
            'direction' => SyncDirection::Inbound->value,
            'trigger' => $trigger->value,
            'status' => SyncRunStatus::Running->value,
            'started_at' => now(),
            'records_read' => 0,
            'records_created' => 0,
            'records_updated' => 0,
            'records_skipped' => 0,
            'records_failed' => 0,
        ];

        $run = $dryRun ? new SyncRun($attributes) : SyncRun::create($attributes);

        try {
            $this->run($integration, $run, $dryRun);
        } finally {
            $run->finished_at = now();
            $run->status = $run->status === SyncRunStatus::Failed
                ? SyncRunStatus::Failed
                : ($run->records_failed > 0 ? SyncRunStatus::Partial : SyncRunStatus::Success);

            if (! $dryRun) {
                $run->save();

                if ($run->status !== SyncRunStatus::Failed) {
                    $integration->forceFill(['last_inbound_sync_at' => now()])->save();
                }
            }
        }

        return $run;
    }

    private function run(Integration $integration, SyncRun $run, bool $dryRun): void
    {
        $map = (array) $integration->inbound_field_map;
        $rules = (array) $integration->conflict_rules;

        if (! $integration->inbound_enabled || blank($integration->inbound_url) || empty($map[SyncFieldMap::EXTERNAL_ID] ?? null)) {
            $this->fail($run, 'integrations.sync.error.not_configured');

            return;
        }

        $pageSize = (int) config('integrations.sync.inbound.page_size');
        $maxPages = (int) config('integrations.sync.inbound.max_pages');
        $maxRecords = (int) config('integrations.sync.inbound.max_records_per_run');

        $page = 1;
        $totalRead = 0;

        while (true) {
            $response = $this->http->get($integration, $integration->inbound_url, [
                'page' => $page,
                'per_page' => $pageSize,
            ]);

            // `break`, never `return`, on every mid-loop failure: the run's
            // counters are only flushed after the loop, and a page-2 failure
            // that follows a page-1 import must still report the records it
            // actually read (Decision 9 — the history is accurate or it is
            // useless). `fail()` has already pinned the status to Failed.
            if (! $response->ok) {
                $this->fail($run, $response->errorKey);

                break;
            }

            $decoded = json_decode((string) $response->body, true);

            if (! is_array($decoded)) {
                $this->fail($run, 'integrations.sync.error.bad_payload');

                break;
            }

            $records = array_is_list($decoded) ? $decoded : ($decoded['data'] ?? null);

            if (! is_array($records) || ! array_is_list($records)) {
                $this->fail($run, 'integrations.sync.error.bad_payload');

                break;
            }

            if (count($records) === 0) {
                break;
            }

            foreach ($records as $record) {
                if (! is_array($record)) {
                    continue;
                }

                $this->upsert($integration, $run, $record, $map, $rules, $dryRun);
                $totalRead++;
            }

            $hasMore = is_array($decoded) && array_key_exists('meta', $decoded)
                ? (bool) ($decoded['meta']['has_more'] ?? true)
                : true;

            if (! $hasMore) {
                break;
            }

            if ($page >= $maxPages) {
                break;
            }

            if ($totalRead >= $maxRecords) {
                break;
            }

            $page++;
        }

        $run->records_read = $totalRead;
    }

    /** A model attribute's comparable scalar form — a BackedEnum cast (e.g. tier) compares by ->value. */
    private function scalar(mixed $value): string
    {
        if ($value instanceof \BackedEnum) {
            return (string) $value->value;
        }

        return (string) ($value ?? '');
    }

    private function fail(SyncRun $run, ?string $errorKey): void
    {
        $run->status = SyncRunStatus::Failed;
        $run->error_key = $errorKey ?? 'integrations.sync.error.bad_payload';
    }

    /** @param array<string,string> $map @param array<string,string> $rules */
    private function upsert(Integration $integration, SyncRun $run, array $record, array $map, array $rules, bool $dryRun): void
    {
        $externalId = SyncFieldMap::read($record, $map[SyncFieldMap::EXTERNAL_ID]);

        if ($externalId === null) {
            $run->records_failed++;
            $run->addError(['external_id' => null, 'field' => null, 'reason_key' => 'integrations.sync.error.missing_external_id', 'detail' => null]);

            return;
        }

        $existing = Customer::query()
            ->where('integration_id', $integration->id)
            ->where('external_id', $externalId)
            ->first();

        $result = SyncFieldMap::attributesFor($record, $map, $rules, $existing);
        $attributes = $result['attributes'];

        foreach ($result['warnings'] as $warning) {
            $run->addError([
                'external_id' => $externalId,
                'field' => $warning['field'],
                'reason_key' => $warning['reason_key'],
                'detail' => null,
            ]);
        }

        if ($existing === null) {
            if (blank($attributes['name'] ?? null)) {
                $run->records_failed++;
                $run->addError(['external_id' => $externalId, 'field' => 'name', 'reason_key' => 'integrations.sync.error.missing_name', 'detail' => null]);

                return;
            }

            if ($dryRun) {
                $run->records_created++;

                return;
            }

            // Wrapped in its own transaction (a Postgres SAVEPOINT, since the
            // test/RefreshDatabase transaction is already open) so a duplicate
            // email/phone unique violation here does not poison the outer
            // transaction for the rest of the run — one bad row never aborts
            // a run (mirrors CustomerController's duplicate mapping).
            try {
                DB::transaction(function () use ($attributes, $integration, $externalId) {
                    Customer::create([
                        ...$attributes,
                        'integration_id' => $integration->id,
                        'external_id' => $externalId,
                        'external_synced_at' => now(),
                        'created_by' => null,
                    ]);
                });
                $run->records_created++;
            } catch (QueryException $e) {
                $run->records_failed++;
                $run->addError(['external_id' => $externalId, 'field' => null, 'reason_key' => 'integrations.sync.error.duplicate', 'detail' => null]);
            }

            return;
        }

        $dirty = array_filter(
            $attributes,
            fn ($value, $field) => $this->scalar($existing->{$field} ?? null) !== (string) $value,
            ARRAY_FILTER_USE_BOTH
        );

        if (empty($dirty)) {
            $run->records_skipped++;

            return;
        }

        if ($dryRun) {
            $run->records_updated++;

            return;
        }

        try {
            DB::transaction(function () use ($existing, $dirty) {
                $existing->fill($dirty);
                $existing->external_synced_at = now();
                $existing->save();
            });
            $run->records_updated++;
        } catch (QueryException $e) {
            $run->records_failed++;
            $run->addError(['external_id' => $externalId, 'field' => null, 'reason_key' => 'integrations.sync.error.duplicate', 'detail' => null]);
        }
    }
}
