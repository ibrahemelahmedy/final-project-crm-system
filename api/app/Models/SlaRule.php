<?php

namespace App\Models;

use App\Enums\Priority;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SlaRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'priority', 'first_response_minutes', 'resolution_minutes',
        'at_risk_threshold_pct', 'notify_on_breach', 'escalation_enabled',
        'escalate_after_minutes', 'escalate_to_role', 'auto_close_after_days',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'priority' => Priority::class,
            'notify_on_breach' => 'boolean',
            'escalation_enabled' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /** Human copy for the card's ON BREACH column, derived — never stored. */
    public function breachActionLabel(): string
    {
        if ($this->escalation_enabled && $this->escalate_to_role !== null) {
            $role = UserRole::from($this->escalate_to_role)->label();

            return $this->notify_on_breach
                ? "Notify Team Lead + escalate to {$role}"
                : "Escalate to {$role}";
        }

        return $this->notify_on_breach ? 'Notify Team Lead' : 'No escalation';
    }
}
