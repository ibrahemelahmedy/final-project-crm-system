<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTicketTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('view', $this->route('ticket'));
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'due_at' => ['sometimes', 'nullable', 'date'],
            // Defaults to the creator when omitted — see TicketTaskController::store().
            'assignee_id' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
        ];
    }
}
