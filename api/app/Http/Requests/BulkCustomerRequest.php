<?php

namespace App\Http\Requests;

use App\Enums\CustomerTier;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'action' => ['required', Rule::in(['delete', 'set_tier'])],
            // The frontend's "select all" only ever selects the current page
            // (<=100), so anything larger is a malformed or hostile request.
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'exists:customers,id'],
            'tier' => ['required_if:action,set_tier', Rule::in(CustomerTier::values())],
        ];
    }
}
