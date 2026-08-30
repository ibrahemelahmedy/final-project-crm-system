<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Story 06 (WIS-6). The seam between the SLA engine and Story 11's
 * Notifications Centre.
 *
 * The `class_exists` / `enum_exists` guard in send() is deliberate: the
 * PRESENCE of the class is the fact being tested, not a config flag someone
 * has to remember to flip. Story 11 has since landed, so the guard resolves
 * to the real dispatcher — but the fallback stays, because it is what lets
 * an operator verify the engine on an installation where it has not.
 *
 * The type strings 'sla_at_risk' / 'sla_breached' match NotificationType
 * exactly, and dispatch() is called positionally against Story 11's pinned
 * signature (recipient, type, title, body, source, linkTo).
 */
class SlaNotifier
{
    public function slaAtRisk(Ticket $ticket): void
    {
        $this->fanOut($ticket, 'sla_at_risk', "SLA at risk · #{$ticket->id}", $ticket->subject);
    }

    public function slaBreached(Ticket $ticket): void
    {
        $this->fanOut($ticket, 'sla_breached', "SLA breached · #{$ticket->id}", $ticket->subject);
    }

    /** The escalation target only — this is a hand-off, not a broadcast. */
    public function escalated(Ticket $ticket, User $target): void
    {
        $this->send($target, $ticket, 'sla_breached', "Escalated to you · #{$ticket->id}", $ticket->subject);
    }

    /** Assigned agent + every active Team Lead. */
    private function fanOut(Ticket $ticket, string $type, string $title, ?string $body): void
    {
        $recipients = collect();

        if ($ticket->assignee !== null && $ticket->assignee->is_active) {
            $recipients->push($ticket->assignee);
        }

        // Story 08 owns the teams model. Until it lands, "their Team Lead" fans
        // out to every active Team Lead — the same shortcut scopeVisibleTo() takes.
        $recipients = $recipients->merge(
            User::query()->where('is_active', true)->where('role', UserRole::TeamLead->value)->get()
        )->unique('id');

        foreach ($recipients as $recipient) {
            $this->send($recipient, $ticket, $type, $title, $body);
        }
    }

    private function send(User $recipient, Ticket $ticket, string $type, string $title, ?string $body): void
    {
        $dispatcher = 'App\\Services\\NotificationDispatcher';
        $typeEnum = 'App\\Enums\\NotificationType';

        // Until Story 11 lands, an alert is a log line and the SLA state on the
        // ticket row — never a silent no-op.
        if (! class_exists($dispatcher) || ! enum_exists($typeEnum)) {
            Log::info('sla.notification', [
                'type' => $type,
                'ticket_id' => $ticket->id,
                'recipient_id' => $recipient->id,
                'title' => $title,
            ]);

            return;
        }

        app($dispatcher)->dispatch(
            $recipient, $typeEnum::from($type), $title, $body, $ticket, "/tickets/{$ticket->id}",
        );
    }
}
