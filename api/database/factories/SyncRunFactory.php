<?php

namespace Database\Factories;

use App\Enums\SyncDirection;
use App\Enums\SyncRunStatus;
use App\Enums\SyncRunTrigger;
use App\Models\Integration;
use App\Models\SyncRun;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SyncRun>
 *
 * Story 25 (WIS-24). Defaults to a finished, successful inbound run.
 */
class SyncRunFactory extends Factory
{
    protected $model = SyncRun::class;

    public function definition(): array
    {
        return [
            'integration_id' => Integration::factory(),
            'direction' => SyncDirection::Inbound->value,
            'trigger' => SyncRunTrigger::Scheduled->value,
            'status' => SyncRunStatus::Success->value,
            'records_read' => 3,
            'records_created' => 3,
            'records_updated' => 0,
            'records_skipped' => 0,
            'records_failed' => 0,
            'started_at' => now()->subMinutes(2),
            'finished_at' => now()->subMinute(),
            'error_key' => null,
            'errors' => [],
        ];
    }

    public function inbound(): static
    {
        return $this->state(fn () => ['direction' => SyncDirection::Inbound->value]);
    }

    public function outbound(): static
    {
        return $this->state(fn () => [
            'direction' => SyncDirection::Outbound->value,
            'records_updated' => 0,
        ]);
    }

    public function failed(): static
    {
        return $this->state(fn () => [
            'status' => SyncRunStatus::Failed->value,
            'records_read' => 0,
            'records_created' => 0,
            'error_key' => 'integrations.sync.error.not_configured',
        ]);
    }

    public function partial(): static
    {
        return $this->state(fn () => [
            'status' => SyncRunStatus::Partial->value,
            'records_failed' => 2,
        ]);
    }

    public function running(): static
    {
        return $this->state(fn () => [
            'status' => SyncRunStatus::Running->value,
            'finished_at' => null,
        ]);
    }
}
