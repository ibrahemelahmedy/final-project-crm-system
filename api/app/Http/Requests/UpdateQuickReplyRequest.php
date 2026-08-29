<?php

namespace App\Http\Requests;

use App\Enums\QuickReplyStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuickReplyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('quickReply'));
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'body' => ['sometimes', 'string', 'max:10000'],
            'category' => ['sometimes', 'string', 'max:100'],
            'status' => ['sometimes', Rule::enum(QuickReplyStatus::class)],
        ];
    }
}
