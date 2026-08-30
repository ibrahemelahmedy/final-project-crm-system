<?php

namespace App\Http\Requests;

use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\SlaRule;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSlaRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', SlaRule::class);
    }

    /**
     * `max:525600` is one year in minutes. An unbounded integer overflows
     * Carbon inside SlaClock::applyTo(), which surfaces as a 500 on ticket
     * creation rather than as a validation error here.
     *
     * `at_risk_threshold_pct` is bounded 1..99: `0` puts the at-risk boundary
     * at creation time (every ticket instantly at risk) and `100` puts it at
     * the due date, which is the breach — so `at_risk` would be unreachable.
     *
     * `escalate_to_role` uses Rule::in on two UserRole values rather than
     * Rule::enum, because the enum's third case (agent) is exactly the one
     * that must be rejected — escalating to an agent is a lateral move.
     */
    public function rules(): array
    {
        return [
            'priority' => ['required', Rule::enum(Priority::class), Rule::unique('sla_rules', 'priority')],
            'first_response_minutes' => ['required', 'integer', 'min:1', 'max:525600'],
            'resolution_minutes' => ['required', 'integer', 'min:1', 'max:525600'],
            'at_risk_threshold_pct' => ['required', 'integer', 'min:1', 'max:99'],
            'notify_on_breach' => ['required', 'boolean'],
            'escalation_enabled' => ['required', 'boolean'],
            'escalate_after_minutes' => ['nullable', 'integer', 'min:1', 'max:525600'],
            'escalate_to_role' => ['nullable', 'required_if:escalation_enabled,true', Rule::in([
                UserRole::TeamLead->value, UserRole::Administrator->value,
            ])],
            'auto_close_after_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Without this an Administrator can save a rule whose resolution deadline
     * precedes the response deadline, putting escalate_at (built on the
     * response due date) after the breach — an escalation that fires after
     * the thing it exists to prevent.
     */
    public function withValidator(ValidatorContract $validator): void
    {
        $validator->after(function (ValidatorContract $v) {
            if ((int) $this->input('resolution_minutes') <= (int) $this->input('first_response_minutes')) {
                $v->errors()->add(
                    'resolution_minutes',
                    'The resolution target must be longer than the response target.'
                );
            }
        });
    }
}
