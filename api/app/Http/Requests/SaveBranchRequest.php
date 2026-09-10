<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveBranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:120',
                Rule::unique('branches', 'name')->ignore($this->route('branch')),
            ],
            'region' => ['nullable', 'string', 'max:120'],
            'timezone' => ['required', 'timezone'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * `name` and `timezone` are attributes other Form Requests also use, so
     * these point at form-specific catalogue keys rather than relying on the
     * global `validation.custom.<attr>.<rule>` fallback (Story 28 / WIS-29).
     */
    public function messages(): array
    {
        return [
            'name.required' => __('validation.custom.branch.name_required'),
            'name.unique' => __('validation.custom.branch.name_unique'),
            'timezone.timezone' => __('validation.custom.timezone.timezone'),
        ];
    }
}
