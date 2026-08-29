<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A thin wrapper over {@see TicketResource} for dashboard widgets.
 *
 * It does two things TicketResource (owned by Story 04) must not be widened to
 * do: it fills the `sla` block from the SLA payload the DashboardMetrics
 * service attached (`sla_payload`), and — for the escalations widget — it adds
 * the dashboard-only `escalated_by_name` / `escalated_at` fields.
 */
class DashboardTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $base = (new TicketResource($this->resource))->toArray($request);

        $sla = $this->resource->sla_payload ?? null;
        $base['sla'] = [
            'due_at' => $sla['due_at'] ?? null,
            'minutes_left' => $sla['minutes_left'] ?? null,
            'risk' => $sla['risk'] ?? null,
        ];

        if ($this->resource->escalated_by_name !== null || $this->resource->escalated_at !== null) {
            $base['escalated_by_name'] = $this->resource->escalated_by_name;
            $base['escalated_at'] = $this->resource->escalated_at;
        }

        return $base;
    }
}
