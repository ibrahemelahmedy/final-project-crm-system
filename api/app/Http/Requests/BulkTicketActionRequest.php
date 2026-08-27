<?php

namespace App\Http\Requests;

use App\Enums\TicketStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkTicketActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer'],
            'action' => ['required', Rule::in(['assign', 'status'])],
            'assigned_to' => ['required_if:action,assign', 'nullable', 'integer', Rule::exists('users', 'id')],
            'status' => ['required_if:action,status', Rule::enum(TicketStatus::class)],
        ];
    }
}
