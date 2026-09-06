<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Story 18 (WIS-19). `authorize()` is `true` — the `administrator` middleware
 * on the whole /api/admin/* group is the gate; IntegrationController also
 * calls IntegrationPolicy directly (redundant on purpose, see the story plan).
 */
class SaveIntegrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'endpoint_url' => ['required', 'string', 'max:2048', 'url:https'],
            // Nullable on PURPOSE: an update that omits it keeps the stored
            // secret (Decision 4 — the field renders empty on Configure).
            'secret' => ['nullable', 'string', 'min:8', 'max:512'],
        ];
    }
}
