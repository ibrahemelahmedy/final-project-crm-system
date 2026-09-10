<?php

namespace App\Mail;

use App\Mail\Concerns\BrandsMail;
use App\Models\CsatSurvey;
use App\Services\CustomerLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * Story 23 (WIS-27), Decision 4-6. The CSAT invitation the customer receives
 * when their ticket is resolved. New in this story — nothing mailed a customer
 * about a resolution before.
 *
 * Renders in the customer's locale, NOT the ambient request locale: this mail
 * is sent from a ticket resolve, where App::getLocale() is the resolving
 * AGENT's choice, not the customer's. Story 28 (WIS-29) Decision 6:
 * CustomerLocale::forTicket() returns `ar` when the ticket's own text is
 * Arabic, otherwise config('mail.customer_locale'). The locale is set on the
 * constructor (not in build()) so Mailable::render()'s withLocale() wrapper
 * picks it up.
 *
 * Not `implements ShouldQueue` — there is no queue worker in this repository.
 */
final class CsatInvitationMail extends Mailable
{
    use BrandsMail;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public readonly CsatSurvey $survey,
        public readonly string $url,
    ) {
        $this->locale(CustomerLocale::forTicket($survey->ticket));
    }

    public function build(): self
    {
        $ticket = $this->survey->ticket;
        $subject = Str::limit((string) $ticket?->subject, 60, '');

        return $this->subject(__('mail.csat.subject', ['subject' => $subject]))
            ->view('mail.csat-invitation', [
                'url' => $this->url,
                'customerName' => (string) ($ticket?->customer?->name ?? ''),
                'ticketSubject' => (string) $ticket?->subject,
                'expiresAt' => optional($this->survey->expires_at)->format('Y-m-d'),
                ...$this->brandingViewData(),
            ]);
    }
}
