<?php

namespace App\Http\Requests;

use App\Enums\ArticleStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexKbArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'array', 'max:50'],
            'category.*' => ['string', 'max:255'],
            'status' => ['nullable', 'array', 'max:3'],
            'status.*' => [Rule::in(ArticleStatus::values())],
            // A security control, not ergonomics — this whitelist is what
            // makes it safe to pass the value into orderBy(). Same reasoning
            // as IndexCustomerRequest.
            'sort' => ['nullable', Rule::in(['title', 'updated_at', 'published_at', 'view_count', 'status'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ];
    }
}
