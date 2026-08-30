<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SlaRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // Story 04's Priority enum, not a second label map.
            'priority' => $this->priority->value,
            'priority_label' => $this->priority->label(),
            'first_response_minutes' => $this->first_response_minutes,
            'resolution_minutes' => $this->resolution_minutes,
            'at_risk_threshold_pct' => $this->at_risk_threshold_pct,
            'notify_on_breach' => $this->notify_on_breach,
            'escalation_enabled' => $this->escalation_enabled,
            'escalate_after_minutes' => $this->escalate_after_minutes,
            'escalate_to_role' => $this->escalate_to_role,
            'auto_close_after_days' => $this->auto_close_after_days,
            'is_active' => $this->is_active,
            // Server-computed. Deriving this sentence twice — once here, once
            // in TypeScript — is exactly how the screen and the engine drift.
            'breach_action_label' => $this->breachActionLabel(),
        ];
    }
}
