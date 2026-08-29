<?php

namespace App\Http\Requests;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'array', 'max:3'],
            'role.*' => [Rule::enum(UserRole::class)],
            'department' => ['nullable', 'array', 'max:50'],
            'department.*' => ['string', 'max:255'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'all'])],
            // A security control, not ergonomics — this whitelist is what
            // makes it safe to pass the value into orderBy().
            'sort' => ['nullable', Rule::in(['name', 'email', 'role', 'department', 'last_login_at', 'created_at'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ];
    }
}
