<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Story 18 (WIS-19). Both fields are OPTIONAL here (unlike
 * SaveIntegrationRequest, where endpoint_url is required) — a test can be run
 * against the already-saved values by submitting neither, and the
 * controller falls back to the stored row for whichever is omitted. This is
 * what lets "Test connection" work before the first save AND on a
 * reconfigure where only one field changed.
 */
class TestIntegrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'endpoint_url' => ['sometimes', 'string', 'max:2048', 'url:https'],
            'secret' => ['sometimes', 'nullable', 'string', 'min:8', 'max:512'],
        ];
    }
}
