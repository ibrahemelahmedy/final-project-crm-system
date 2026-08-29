<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTicketTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('task'));
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'due_at' => ['sometimes', 'nullable', 'date'],
            'assignee_id' => ['sometimes', 'integer', Rule::exists('users', 'id')],
        ];
    }
}
