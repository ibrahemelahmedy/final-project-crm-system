<?php

namespace App\Http\Requests;

use App\Models\Ticket;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Story 17 (WIS-16, Customer Portal). `customer_id` comes from the portal
 * session, never the body; `priority`, `assigned_to`, and `channel` are not
 * accepted at all — a portal ticket always takes the priority default and
 * channel `web_form`. `authorize()` returns true; PortalAuth is the gate.
 */
class StorePortalRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
            'category' => ['required', Rule::in(Ticket::CATEGORIES)],
        ];
    }
}
