<?php

namespace App\Http\Resources;

use App\Enums\Channel;
use App\Models\ChannelConnection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 26 (WIS-22). Constructed from an array, not the model directly, so
 * it can render a not-connected channel that has no channel_connections row
 * — the same "always return every enum case" contract Story 14 established.
 *
 * `config` is filtered to a non-secret allowlist. `secret` and
 * `verify_token` NEVER appear here, in any form — modelled on
 * IntegrationResource's secret_last_four-only posture.
 */
class ChannelConnectionResource extends JsonResource
{
    private const CONFIG_ALLOWLIST = [
        'phone_number_id', 'from_number', 'account_sid',
        'inbound_address', 'allowed_origins', 'site_key',
    ];

    /** @param array{channel: Channel, model: ?ChannelConnection} $resource */
    public function __construct(array $resource)
    {
        parent::__construct($resource);
    }

    public static function forChannel(Channel $channel, ?ChannelConnection $model): self
    {
        return new self(['channel' => $channel, 'model' => $model]);
    }

    public function toArray(Request $request): array
    {
        /** @var Channel $channel */
        $channel = $this->resource['channel'];
        /** @var ?ChannelConnection $model */
        $model = $this->resource['model'];

        $config = (array) ($model?->config ?? []);

        return [
            'channel' => $channel->value,
            'label_key' => 'enums.channel.'.$channel->value,
            'provider' => $model?->provider?->value,
            'status' => $model?->status?->value ?? 'not_connected',
            'secret_last_four' => $model?->secret_last_four,
            'config' => array_intersect_key($config, array_flip(self::CONFIG_ALLOWLIST)),
            'last_inbound_at' => $model?->last_inbound_at?->toJSON(),
            'last_outbound_at' => $model?->last_outbound_at?->toJSON(),
            'last_error_key' => $model?->last_error_key,
            'last_error_at' => $model?->last_error_at?->toJSON(),
        ];
    }
}
