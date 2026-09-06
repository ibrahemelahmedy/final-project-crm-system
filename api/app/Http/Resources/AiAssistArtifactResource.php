<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Story 19 (WIS-18). A frozen key set. Token counts are NOT exposed — they
 * are cost telemetry, not agent-facing data.
 */
class AiAssistArtifactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'content' => $this->content,
            'locale' => $this->locale,
            'model' => $this->model,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'dismissed' => $this->dismissed_at !== null,
        ];
    }
}
