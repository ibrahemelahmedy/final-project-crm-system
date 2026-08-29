<?php

namespace App\Http\Requests;

use App\Enums\QuickReplyStatus;
use App\Models\QuickReply;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreQuickReplyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', QuickReply::class);
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:10000'],
            'category' => ['required', 'string', 'max:100'],
            'status' => ['sometimes', Rule::enum(QuickReplyStatus::class)],
        ];
    }
}
