<?php

namespace App\Http\Requests;

use App\Services\AuditTrail;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The audit log grows unbounded, so `per_page` has a HARD ceiling and a
 * larger value is rejected rather than silently clamped — a caller asking for
 * 100000 rows should learn that it will not happen.
 */
class IndexAuditLogRequest extends FormRequest
{
    public const MAX_PER_PAGE = 100;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'actor_id' => ['nullable', 'integer', 'exists:users,id'],
            'event' => ['nullable', 'array', 'max:20'],
            'event.*' => [Rule::in(AuditTrail::events())],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:'.self::MAX_PER_PAGE],
        ];
    }

    public function messages(): array
    {
        return [
            'per_page.max' => 'The audit log returns at most '.self::MAX_PER_PAGE.' entries per page.',
        ];
    }
}
