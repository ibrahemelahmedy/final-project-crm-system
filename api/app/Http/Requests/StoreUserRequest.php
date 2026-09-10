<?php

namespace App\Http\Requests;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Invite. `role` is REQUIRED and no default is applied — a user is never
 * role-less, and the users table's `default('agent')` must not be allowed to
 * silently supply one.
 */
class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'role' => ['required', Rule::enum(UserRole::class)],
            'department' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', Password::defaults()],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    /**
     * `role.required` resolves through the global `validation.custom.role.required`
     * key; `email` is shared with the customer forms, so it points at a
     * user-specific key (Story 28 / WIS-29).
     */
    public function messages(): array
    {
        return [
            'email.unique' => __('validation.custom.user_email.unique'),
        ];
    }
}
