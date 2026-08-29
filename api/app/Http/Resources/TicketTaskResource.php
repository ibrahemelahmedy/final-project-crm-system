<?php

namespace App\Http\Resources;

use App\Enums\TaskStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * `due_state` is computed HERE — `overdue` | `due_soon` | `upcoming` | `none`
 * — so the client never re-derives it from a raw timestamp (plan's
 * "Resources" section). "Due soon" is within the next 4 hours, matching the
 * artboard's "Due soon · in 2 hours" example.
 */
class TicketTaskResource extends JsonResource
{
    private const DUE_SOON_WINDOW_MINUTES = 240;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_id' => $this->ticket_id,
            'title' => $this->title,
            'due_at' => $this->due_at?->toJSON(),
            'due_state' => $this->dueState(),
            'assignee' => $this->assignee ? new TaskUserResource($this->assignee) : null,
            'creator' => $this->creator ? new TaskUserResource($this->creator) : null,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'completed_by' => $this->completer ? new TaskUserResource($this->completer) : null,
            'completed_at' => $this->completed_at?->toJSON(),
            'cancel_reason' => $this->cancel_reason,
            'created_at' => $this->created_at,
        ];
    }

    private function dueState(): string
    {
        if ($this->status !== TaskStatus::Open || ! $this->due_at) {
            return 'none';
        }

        /** @var Carbon $dueAt */
        $dueAt = $this->due_at;
        $now = Carbon::now();

        if ($dueAt->lessThanOrEqualTo($now)) {
            return 'overdue';
        }

        if ($now->diffInMinutes($dueAt, false) <= self::DUE_SOON_WINDOW_MINUTES) {
            return 'due_soon';
        }

        return 'upcoming';
    }
}
