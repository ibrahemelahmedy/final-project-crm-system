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

    public function messages(): array
    {
        $mb = round(config('branding.max_kb') / 1024, 1);

        return [
            'logo.max' => "That file is too large. The limit is {$mb} MB.",
            'logo.mimes' => 'That file type is not accepted. Allowed types: '
                .strtoupper(implode(', ', config('branding.allowed_extensions'))).'.',
            'logo.image' => 'Choose an image file.',
            'logo.required' => 'Choose a logo to upload.',
        ];
    }
}
