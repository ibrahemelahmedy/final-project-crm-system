<?php

namespace Database\Factories;

use App\Enums\Priority;
use App\Models\SlaRule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SlaRule>
 */
class SlaRuleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'priority' => Priority::Normal->value,
            'first_response_minutes' => 240,
            'resolution_minutes' => 1440,
            'at_risk_threshold_pct' => 80,
            'notify_on_breach' => true,
            'escalation_enabled' => false,
            'escalate_after_minutes' => null,
            'escalate_to_role' => null,
            'auto_close_after_days' => 5,
            'is_active' => true,
        ];
    }

    public function forPriority(string $priority, int $resolutionMinutes = 1440, int $atRiskPct = 80): static
    {
        return $this->state(fn (array $attributes) => [
            'priority' => $priority,
            'resolution_minutes' => $resolutionMinutes,
            'at_risk_threshold_pct' => $atRiskPct,
        ]);
    }
}
