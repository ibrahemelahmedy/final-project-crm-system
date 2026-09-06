<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveBrandingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // present + nullable, not sometimes: "reset to default" must be
            // expressible as an explicit null, and an absent key must not
            // silently mean "keep". Case-insensitive 6-digit hex, '#'
            // required. No contrast rule here — a failing ratio is a
            // warning, never a 422 (the artboard's own copy: "You can still
            // save, but consider choosing a darker shade").
            'primary_color' => ['present', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'primary_color.regex' => 'Enter a valid 6-digit hex color, e.g. #4F46E5.',
        ];
    }
}
