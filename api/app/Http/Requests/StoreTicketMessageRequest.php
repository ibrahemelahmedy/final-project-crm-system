<?php

namespace App\Http\Requests;

use App\Enums\MessageVisibility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTicketMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('ticket'));
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:1', 'max:10000'],
            // Story 10: composer mode. Defaults to public — an internal note
            // is always an explicit choice, never accidental.
            'visibility' => ['sometimes', Rule::enum(MessageVisibility::class)],
            'mentions' => ['sometimes', 'array'],
            'mentions.*' => ['integer'],
        ];
    }

    public function messages(): array
    {
        return ['body.required' => 'Write a reply before sending.'];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['body' => is_string($this->body) ? trim($this->body) : $this->body]);
    }
}
