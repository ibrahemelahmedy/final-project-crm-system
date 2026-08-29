<?php

namespace App\Http\Requests;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Edit. `role` is optional here (a name-only edit is legitimate), but when it
 * IS present it must be one of the three UserRole values — it can never be
 * cleared to null.
 */
class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($this->route('user')?->id),
            ],
            'role' => ['sometimes', 'required', Rule::enum(UserRole::class)],
            'department' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'role.required' => 'Select a role. Every user has exactly one.',
            'email.unique' => 'A user with this email address already exists.',
        ];
    }
}
