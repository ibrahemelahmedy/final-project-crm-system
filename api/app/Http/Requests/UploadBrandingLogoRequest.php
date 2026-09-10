<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadBrandingLogoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'logo' => [
                'required', 'file', 'image',
                'max:'.config('branding.max_kb'),
                // The `image` rule alone is not enough on every Laravel
                // version to reject SVG; this explicit mimes: list, which
                // reads the real MIME type rather than the extension, is
                // the guard that matters (Decision 6).
                'mimes:'.implode(',', config('branding.allowed_extensions')),
            ],
        ];
    }

    /**
     * `logo.image` / `logo.required` resolve through the global
     * `validation.custom.logo.*` keys. `logo.max` and `logo.mimes` keep a
     * one-liner: the MB figure and the uppercase type list are computed from
     * config at message time (Story 28 / WIS-29).
     */
    public function messages(): array
    {
        return [
            'logo.max' => __('validation.custom.logo.max', [
                'mb' => round(config('branding.max_kb') / 1024, 1),
            ]),
            'logo.mimes' => __('validation.custom.logo.mimes', [
                'types' => strtoupper(implode(', ', config('branding.allowed_extensions'))),
            ]),
        ];
    }
}
