<?php

namespace App\Services;

use App\Models\Ticket;

/**
 * Story 28 (WIS-29), Decision 6. Which locale a customer-facing email renders
 * in. A ticket whose subject or description contains Arabic script means the
 * customer writes Arabic, so the email renders `ar`; otherwise it falls back
 * to `config('mail.customer_locale')` exactly as before. No `customers.locale`
 * column, no migration — the ticket's own text is the signal.
 */
final class CustomerLocale
{
    public static function forTicket(?Ticket $ticket): string
    {
        $fallback = (string) config('mail.customer_locale');

        if ($ticket === null) {
            return $fallback;
        }

        $text = $ticket->subject.' '.(string) $ticket->description;

        return preg_match('/[\x{0600}-\x{06FF}]/u', $text) === 1 ? 'ar' : $fallback;
    }
}
