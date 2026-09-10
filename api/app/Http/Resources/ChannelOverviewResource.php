<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Story 14 — the Channels overview payload. Story 26 (WIS-22) adds the
 * nested `connection` object per channel.
 *
 * `data` is ALWAYS all channels of App\Enums\Channel, in declaration order,
 * whether or not any ticket used them. `status` is now SOURCED FROM the
 * channel_connections row (Decision 1's absent-row convention): a channel
 * with no row is `not_connected`, otherwise it is the row's
 * ChannelConnectionStatus value (`connected` | `error`). It is no longer a
 * literal. `last_error_key` inside `connection` is an i18n key resolved in
 * the SPA, following this feature's own `label_key` convention. The
 * per-channel help-line copy is NOT returned here; it is UI copy owned by
 * the frontend catalogue.
 *
 * @property array{
 *   channels: Collection<int, array{value: string, label_key: string, status: string, ticket_count: int, connection: ?array}>,
 *   period: string,
 *   from: Carbon,
 *   to: Carbon,
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
                'connection' => $c['connection'] === null ? null : [
                    'provider' => $c['connection']['provider'],
                    'last_inbound_at' => $c['connection']['last_inbound_at']?->toIso8601ZuluString(),
                    'inbound_24h' => $c['connection']['inbound_24h'],
                    'last_error_key' => $c['connection']['last_error_key'],
                    'connectable' => $c['connection']['connectable'],
                ],
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
