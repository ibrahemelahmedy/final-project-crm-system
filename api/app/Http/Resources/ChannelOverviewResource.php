<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 14 — the Channels overview payload.
 *
 * `data` is ALWAYS all channels of App\Enums\Channel, in declaration order,
 * whether or not any ticket used them. `status` is the literal string
 * `not_connected` for every channel in this release — it is a field, not a
 * computed health check. The per-channel help-line copy is NOT returned here;
 * it is UI copy owned by the frontend catalogue.
 *
 * @property array{
 *   channels: \Illuminate\Support\Collection<int, array{value: string, label_key: string, status: string, ticket_count: int}>,
 *   period: string,
 *   from: \Illuminate\Support\Carbon,
 *   to: \Illuminate\Support\Carbon,
 *   total_tickets: int
 * } $resource
 */
class ChannelOverviewResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'data' => collect($this->resource['channels'])->map(fn (array $c) => [
                'value' => $c['value'],
                'label_key' => $c['label_key'],
                'status' => $c['status'],
                'ticket_count' => $c['ticket_count'],
            ])->values()->all(),
            'meta' => [
                'period' => $this->resource['period'],
                'from' => $this->resource['from']->toIso8601ZuluString(),
                'to' => $this->resource['to']->toIso8601ZuluString(),
                'total_tickets' => $this->resource['total_tickets'],
                'has_tickets' => $this->resource['total_tickets'] > 0,
            ],
        ];
    }
}
