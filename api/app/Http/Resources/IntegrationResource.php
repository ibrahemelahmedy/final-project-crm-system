<?php

namespace App\Http\Resources;

use App\Enums\IntegrationStatus;
use App\Enums\IntegrationType;
use App\Models\Integration;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 18 (WIS-19). Constructed from an array, not an Eloquent model
 * directly — {@see IntegrationResource::forType()} — so it can render a
 * not-connected type that has no `integrations` row, the same "always return
 * every enum case" contract Story 14 established for channels.
 *
 * `secret` does NOT appear here, in any form. secret_last_four is the only
 * thing derived from it that ever leaves the server.
 */
class IntegrationResource extends JsonResource
{
    /** @param array{type: IntegrationType, model: ?Integration} $resource */
    public function __construct(array $resource)
    {
        parent::__construct($resource);
    }

    public static function forType(IntegrationType $type, ?Integration $model): self
    {
        return new self(['type' => $type, 'model' => $model]);
    }

    public function toArray(Request $request): array
    {
        /** @var IntegrationType $type */
        $type = $this->resource['type'];
        /** @var ?Integration $model */
        $model = $this->resource['model'];

        return [
            'type' => $type->value,
            'label_key' => $type->labelKey(),
            'status' => $model?->status ?? IntegrationStatus::NotConnected->value,
            'endpoint_url' => $model?->endpoint_url,
            'secret_last_four' => $model?->secret_last_four,
            'last_checked_at' => $model?->last_checked_at?->toJSON(),
            'last_check_failed_at' => $model?->last_check_failed_at?->toJSON(),
            'last_error_key' => $model?->last_error,
        ];
    }
}
