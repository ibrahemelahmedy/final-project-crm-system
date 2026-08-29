<?php

namespace App\Http\Requests;

use App\Services\SystemSettings;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Server-side validation of system configuration.
 *
 * The rules come from SystemSettings::rules() so there is exactly one
 * definition of what a valid value is. A password minimum length of 0, a
 * negative number, or a non-numeric string is rejected here — the client's
 * matching check in SystemSettingsPage is a convenience only.
 */
class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'settings' => ['required', 'array', 'min:1'],
            ...SystemSettings::rules(),
        ];
    }

    public function attributes(): array
    {
        $attributes = [];

        foreach (SystemSettings::definitions() as $key => $definition) {
            $attributes['settings.'.$key] = $definition['label'];
        }

        return $attributes;
    }

    /**
     * Reject a key that is not in the catalogue rather than quietly ignoring
     * it — a typo'd key that "saves" successfully is worse than an error.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $unknown = array_diff(array_keys((array) $this->input('settings', [])), SystemSettings::keys());

            foreach ($unknown as $key) {
                $validator->errors()->add('settings.'.$key, "Unknown setting \"{$key}\".");
            }
        });
    }
}
