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

    public function messages(): array
    {
        $mb = round(config('attachments.max_kb') / 1024, 1);

        return [
            'file.max' => "That file is too large. The limit is {$mb} MB.",
            'file.mimes' => 'That file type is not accepted. Allowed types: '
                .strtoupper(implode(', ', config('attachments.allowed_extensions'))).'.',
            'file.required' => 'Choose a file to attach.',
        ];
    }
}
