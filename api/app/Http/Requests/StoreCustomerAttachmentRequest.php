<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => [
                'required', 'file',
                'max:'.config('attachments.max_kb'),
                'mimes:'.implode(',', config('attachments.allowed_extensions')),
            ],
        ];
    }

    /**
     * `file.required` resolves through the global `validation.custom.file.*`
     * key. `file.max` and `file.mimes` keep a one-liner: the MB figure and the
     * uppercase type list are computed from config at message time (Story 28 /
     * WIS-29).
     */
    public function messages(): array
    {
        return [
            'file.max' => __('validation.custom.file.max', [
                'mb' => round(config('attachments.max_kb') / 1024, 1),
            ]),
            'file.mimes' => __('validation.custom.file.mimes', [
                'types' => strtoupper(implode(', ', config('attachments.allowed_extensions'))),
            ]),
        ];
    }
}
