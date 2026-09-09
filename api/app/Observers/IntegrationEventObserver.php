<?php

namespace App\Observers;

use App\Enums\IntegrationEvent;
use App\Enums\TicketStatus;
use App\Models\CsatSurvey;
use App\Models\Ticket;
use App\Services\Integrations\IntegrationEvents;

/**
 * Story 25 (WIS-24). Enqueues outbound events on Ticket create/resolve.
 * Single responsibility: enqueue. It decides nothing about delivery.
 *
 * Registered on Ticket LAST in AppServiceProvider::boot(), after
 * TicketResolutionObserver and TicketClassificationObserver —
 * TicketResolutionObserver has already created this cycle's CsatSurvey by
 * the time updated() runs here, so max('resolution_cycle') is the current
 * cycle. This ordering is load-bearing for the event_id.
 */
class IntegrationEventObserver
{
    public function created(Ticket $ticket): void
    {
        app(IntegrationEvents::class)->record(
            IntegrationEvent::TicketCreated,
            'ticket.created:'.$ticket->id,
            fn () => ['data' => IntegrationEvents::ticketPayload($ticket)],
        );
    }

    public function updated(Ticket $ticket): void
    {
        // Same detection as TicketResolutionObserver:52-60 — wasChanged first,
        // then the target status. An update that touches other columns while
        // the ticket is already Resolved must NOT re-emit.
        if (! $ticket->wasChanged('status') || $ticket->status !== TicketStatus::Resolved) {
            return;
        }

        $cycle = CsatSurvey::query()->where('ticket_id', $ticket->id)->max('resolution_cycle') ?? 1;

        app(IntegrationEvents::class)->record(
            IntegrationEvent::TicketResolved,
            'ticket.resolved:'.$ticket->id.':'.$cycle,
            fn () => ['data' => IntegrationEvents::ticketPayload($ticket)],
        );
    }
}
