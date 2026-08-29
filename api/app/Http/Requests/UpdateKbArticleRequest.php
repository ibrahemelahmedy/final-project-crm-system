<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Editing an article. Every field is `sometimes` so a PATCH that touches only
 * the category does not have to resend the whole body.
 *
 * Editing a PUBLISHED article back into an unpublishable state (blanking the
 * body, clearing the category) is rejected in the controller rather than here,
 * because the rule depends on the article's current status, which a
 * FormRequest's static rules cannot see.
 */
class UpdateKbArticleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // KbArticlePolicy::update is applied in the controller.
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'body' => ['sometimes', 'nullable', 'string', 'max:100000'],
            'excerpt' => ['sometimes', 'nullable', 'string', 'max:400'],
            'kb_category_id' => ['sometimes', 'nullable', 'integer', 'exists:kb_categories,id'],
        ];
    }
}
