<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Story 15 (WIS-11). Body for PATCH /api/user/preferences. There is no
 * `{user}` route parameter — the controller writes only the authenticated
 * user's row — so there is no authorization question here.
 */
class UpdatePreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'locale' => ['required', 'string', 'in:en,ar'],
        ];
    }
}
