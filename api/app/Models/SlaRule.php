<?php

namespace App\Models;

use App\Enums\Priority;
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

    /**
     * Human copy for the card's ON BREACH column, derived — never stored.
     * Storing the sentence would let the copy drift from the behaviour the
     * engine actually runs.
     *
     * Resolved through Laravel's translator, not built from PHP string
     * concatenation, so it arrives in the caller's language: SetLocale reads
     * the SPA's Accept-Language on every request. A client-side translation is
     * impossible here — the sentence is derived from four booleans the card
     * never sees.
     *
     * The design's Normal card reads "Flag in queue, no escalation" and its Low
     * card reads "No escalation". Both are the SAME no-escalation state, so
     * both ship as "No escalation" — two strings for one behaviour is exactly
     * the drift this method exists to prevent.
     */
    public function breachActionLabel(): string
    {
        if ($this->escalation_enabled && $this->escalate_to_role !== null) {
            $role = __('sla.role_'.$this->escalate_to_role);

            return $this->notify_on_breach
                ? __('sla.breach_notify_and_escalate', ['role' => $role])
                : __('sla.breach_escalate', ['role' => $role]);
        }

        return $this->notify_on_breach
            ? __('sla.breach_notify')
            : __('sla.breach_none');
    }
}
