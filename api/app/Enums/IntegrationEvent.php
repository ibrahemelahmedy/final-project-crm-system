<?php

namespace App\Enums;

/**
 * Story 25 (WIS-24). The three outbound event sources. Authority for the
 * `outbound_events` array an admin selects — the FormRequest validates
 * against values().
 */
enum IntegrationEvent: string
{
    case TicketCreated = 'ticket.created';
    case TicketResolved = 'ticket.resolved';
    case CsatSubmitted = 'csat.submitted';

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $e) => $e->value, self::cases());
    }
}
