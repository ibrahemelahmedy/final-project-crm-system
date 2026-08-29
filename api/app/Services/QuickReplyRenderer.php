<?php

namespace App\Services;

use App\Models\QuickReply;
use App\Models\Ticket;
use App\Models\User;

/**
 * The ONE place a quick-reply placeholder is resolved — never in the React
 * composer, so a future automated/scheduled context (e.g. an SLA-breach
 * auto-reply) can reuse this exact rule set.
 *
 * Placeholder vocabulary (frozen by the plan):
 * {{customer.first_name}} · {{customer.full_name}} · {{ticket.id}} ·
 * {{ticket.subject}} · {{agent.first_name}}
 *
 * An unresolvable placeholder is ECHOED LITERALLY — never replaced with an
 * empty string. "Hello ," reaching a customer is the failure this rule
 * exists to prevent.
 *
 * Exactly ONE substitution pass runs over the template. A customer whose own
 * data literally contains "{{" must never trigger a second pass over the
 * renderer's own output — replacement values are never re-scanned.
 */
class QuickReplyRenderer
{
    public function render(QuickReply $quickReply, Ticket $ticket, User $agent): string
    {
        $customer = $ticket->customer;

        $values = [
            '{{customer.first_name}}' => $this->firstName($customer?->name),
            '{{customer.full_name}}' => $customer?->name,
            '{{ticket.id}}' => (string) $ticket->id,
            '{{ticket.subject}}' => $ticket->subject,
            '{{agent.first_name}}' => $this->firstName($agent->name),
        ];

        // preg_replace_callback makes exactly one pass — the replacement
        // strings are never re-scanned for further {{…}} tokens, so a
        // customer name containing literal "{{" is inert.
        return preg_replace_callback(
            '/\{\{[a-zA-Z0-9_.]+\}\}/',
            function (array $match) use ($values) {
                $token = $match[0];
                $value = $values[$token] ?? null;

                // Unresolvable — including a KNOWN token with a null value
                // (e.g. no linked customer) — is echoed literally.
                return $value === null || $value === '' ? $token : $value;
            },
            $quickReply->body
        );
    }

    private function firstName(?string $name): ?string
    {
        if (! $name) {
            return null;
        }

        $first = trim(explode(' ', trim($name))[0] ?? '');

        return $first === '' ? null : $first;
    }
}
