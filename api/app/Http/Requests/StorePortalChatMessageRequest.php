<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Story 24 (WIS-23). PortalAuth is the gate (exactly as
 * StorePortalRequestRequest documents), so authorize() is true.
 */
class StorePortalChatMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:'.(int) config('ai.chat.max_question_chars')],
        ];
    }
}
