<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Story 25 (WIS-24). */
class SyncRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'direction' => $this->direction->value,
            'trigger' => $this->trigger->value,
            'status' => $this->status->value,
            'records_read' => $this->records_read,
            'records_created' => $this->records_created,
            'records_updated' => $this->records_updated,
            'records_skipped' => $this->records_skipped,
            'records_failed' => $this->records_failed,
            'started_at' => $this->started_at?->toJSON(),
            'finished_at' => $this->finished_at?->toJSON(),
            'duration_seconds' => $this->durationSeconds(),
            'error_key' => $this->error_key,
            'errors' => array_values((array) $this->errors),
        ];
    }
}
