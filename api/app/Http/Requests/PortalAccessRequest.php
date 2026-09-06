<?php

namespace App\Http\Requests;

use App\Services\PortalAccess;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Story 17 (WIS-16, Customer Portal). Public route — PortalAccess owns
 * whether the identifier actually matches anyone; this only rejects
 * something that could never normalise to an email or a phone number.
 */
class PortalAccessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'identifier' => [
                'required',
                'string',
                'max:191',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (PortalAccess::normalize((string) $value) === null) {
                        $fail(__('portal.identifier_format'));
                    }
                },
            ],
        ];
    }
}
