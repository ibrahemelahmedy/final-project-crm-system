<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The notifications list is ALWAYS server-side paginated — `per_page` has a
 * hard ceiling, matching IndexAuditLogRequest's pattern (Story 08).
 */
class IndexNotificationRequest extends FormRequest
{
    public const MAX_PER_PAGE = 50;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'filter' => ['nullable', Rule::in(['unread', 'all'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:'.self::MAX_PER_PAGE],
        ];
    }
}
