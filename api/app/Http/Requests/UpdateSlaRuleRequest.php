<?php

namespace App\Http\Requests;

use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\SlaRule;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSlaRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('sla_rule'));
    }

    /** Same constraints as StoreSlaRuleRequest, every field `sometimes`. */
    public function rules(): array
    {
        return [
            'priority' => ['sometimes', Rule::enum(Priority::class),
                Rule::unique('sla_rules', 'priority')->ignore($this->route('sla_rule'))],
            'first_response_minutes' => ['sometimes', 'integer', 'min:1', 'max:525600'],
            'resolution_minutes' => ['sometimes', 'integer', 'min:1', 'max:525600'],
            'at_risk_threshold_pct' => ['sometimes', 'integer', 'min:1', 'max:99'],
            'notify_on_breach' => ['sometimes', 'boolean'],
            'escalation_enabled' => ['sometimes', 'boolean'],
            'escalate_after_minutes' => ['nullable', 'integer', 'min:1', 'max:525600'],
            'escalate_to_role' => ['nullable', 'required_if:escalation_enabled,true', Rule::in([
                UserRole::TeamLead->value, UserRole::Administrator->value,
            ])],
            'auto_close_after_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Reads through to the STORED value for any field the partial update
     * omits, so a PATCH that changes only one of the two targets is still
     * compared against the other as it will actually be saved.
     */
    public function withValidator(ValidatorContract $validator): void
    {
        $validator->after(function (ValidatorContract $v) {
            /** @var SlaRule $rule */
            $rule = $this->route('sla_rule');

            $resolution = (int) $this->input('resolution_minutes', $rule->resolution_minutes);
            $response = (int) $this->input('first_response_minutes', $rule->first_response_minutes);

            if ($resolution <= $response) {
                $v->errors()->add(
                    'resolution_minutes',
                    'The resolution target must be longer than the response target.'
                );
            }
        });
    }
}
