<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PortalVerifyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'identifier' => ['required', 'string', 'max:191'],
            'code' => ['required', 'string', 'size:6', 'regex:/^\d{6}$/'],
        ];
    }
}
