<?php

namespace App\Models;

use App\Enums\SyncDirection;
use App\Enums\SyncRunStatus;
use App\Enums\SyncRunTrigger;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Story 25 (WIS-24), Decision 9. One row per sync attempt, either direction.
 *
 * Five counters serve both directions — this docblock is the ONE authority
 * for their meaning; do not re-document it anywhere else.
 *
 * | Column            | Inbound meaning                | Outbound meaning              |
 * |-------------------|---------------------------------|--------------------------------|
 * | records_read      | remote records received         | outbox messages picked up      |
 * | records_created   | customers inserted              | messages delivered             |
 * | records_updated   | customers updated               | (unused, 0)                    |
 * | records_skipped   | records identical / no-op       | messages deferred to a retry   |
 * | records_failed    | records rejected                | messages dead-lettered         |
 *
 * `status` is running|success|partial|failed: `partial` when
 * records_failed > 0 but the run completed; `failed` when the run itself
 * aborted (guard rejection, bad payload, transport failure on page 1). A row
 * is created `running` BEFORE the first request and finished in a `finally`,
 * so a fatal never leaves a phantom `running` row for a completed run.
 */
class SyncRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'integration_id', 'direction', 'trigger', 'status',
        'records_read', 'records_created', 'records_updated', 'records_skipped', 'records_failed',
        'started_at', 'finished_at', 'error_key', 'errors',
    ];

    protected function casts(): array
    {
        return [
            'direction' => SyncDirection::class,
            'trigger' => SyncRunTrigger::class,
            'status' => SyncRunStatus::class,
            'errors' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'records_read' => 'integer',
            'records_created' => 'integer',
            'records_updated' => 'integer',
            'records_skipped' => 'integer',
            'records_failed' => 'integer',
        ];
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(Integration::class);
    }

    public function durationSeconds(): ?int
    {
        if ($this->started_at === null || $this->finished_at === null) {
            return null;
        }

        return $this->started_at->diffInSeconds($this->finished_at);
    }

    /**
     * Appends up to config('integrations.sync.max_error_rows'), then stops.
     * The counter that tracks the underlying failure (records_failed) keeps
     * incrementing past the cap; only the detail list is bounded.
     */
    public function addError(array $row): void
    {
        $errors = $this->errors ?? [];
        $max = (int) config('integrations.sync.max_error_rows');

        if (count($errors) >= $max) {
            return;
        }

        $errors[] = $row;
        $this->errors = $errors;
    }
}
