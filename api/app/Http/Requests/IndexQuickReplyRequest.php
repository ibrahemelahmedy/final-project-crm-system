<?php

namespace App\Http\Requests;

use App\Enums\QuickReplyStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexQuickReplyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'nullable', Rule::enum(QuickReplyStatus::class)],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
