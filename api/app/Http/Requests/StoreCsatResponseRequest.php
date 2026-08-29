<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Story 13 — validation is the FIRST gate on a rating; the DB CHECK
 * `rating BETWEEN 1 AND 5` is the second, independent one. The route is
 * public + signed, so authorize() is open (the signature is the auth).
 */
class StoreCsatResponseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
