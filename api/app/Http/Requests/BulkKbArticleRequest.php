<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkKbArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // KbArticlePolicy::bulk is applied in the controller.
    }

    public function rules(): array
    {
        return [
            'action' => ['required', Rule::in(['publish', 'unpublish', 'archive'])],
            // The frontend's "select all" only ever selects the current page
            // (<=100), so anything larger is malformed or hostile — the same
            // bound BulkCustomerRequest uses.
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer', 'exists:kb_articles,id'],
        ];
    }
}
