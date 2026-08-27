<?php

namespace App\Http\Requests;

use App\Enums\Channel;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Models\Ticket;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('ticket'));
    }

    public function rules(): array
    {
        return [
            'subject' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'customer_id' => ['sometimes', 'integer', Rule::exists('customers', 'id')],
            'category' => ['sometimes', Rule::in(Ticket::CATEGORIES)],
            'priority' => ['sometimes', Rule::enum(Priority::class)],
            'channel' => ['sometimes', Rule::enum(Channel::class)],
            'assigned_to' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')],
            // Transition legality is checked in the controller against
            // TicketStatus::canTransitionTo() — duplicating the graph here is
            // how the two drift.
            'status' => ['sometimes', Rule::enum(TicketStatus::class)],
        ];
    }
}
