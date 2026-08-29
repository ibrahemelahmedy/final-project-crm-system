<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Creating an article. Only a title is required.
 *
 * Body and category are NOT required here on purpose: the acceptance criterion
 * is "required before it can be PUBLISHED", not "required to save a draft". An
 * editor must be able to park a title and come back to it. The publish gate
 * lives in ArticleWriter::assertPublishable(), which is also the path the bulk
 * publish action goes through.
 */
class StoreKbArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // KbArticlePolicy::create is applied in the controller.
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:100000'],
            'excerpt' => ['nullable', 'string', 'max:400'],
            'kb_category_id' => ['nullable', 'integer', 'exists:kb_categories,id'],
        ];
    }
}
