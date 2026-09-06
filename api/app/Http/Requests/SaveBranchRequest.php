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

    public function messages(): array
    {
        return [
            'name.required' => 'Enter a branch name.',
            'name.unique' => 'A branch with that name already exists.',
            'timezone.timezone' => 'Choose a valid timezone.',
        ];
    }
}
