<?php

namespace App\Services\Channels;

use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Services\SlaClock;
use App\Services\TicketAssigner;
use Illuminate\Support\Str;

/**
 * Story 26 (WIS-22), Decision 7. Mirrors
 * PortalRequestController::store()'s programmatic ticket-creation sequence —
 * StoreTicketRequest cannot be used here (category/priority/channel are all
 * required and authorize() calls $this->user()->can(...) with no user on a
 * webhook).
 */
class IngestedTicketFactory
{
    public function __construct(
        private readonly SlaClock $clock,
        private readonly TicketAssigner $assigner,
    ) {}

    /** @return array{0: Ticket, 1: TicketMessage} */
    public function create(InboundMessage $message, Customer $customer): array
    {
        $subject = trim($message->subject) !== ''
            ? Str::limit(trim($message->subject), 255, '')
            : __('channels.inbound.default_subject', ['channel' => $message->channel->label()]);

        $ticket = Ticket::create([
            'customer_id' => $customer->id,
            'created_by' => null,
            'status' => TicketStatus::Open->value,
            'channel' => $message->channel->value,
            // Set explicitly — create() does not re-read the DB default into
            // the in-memory model, and SlaClock::applyTo() needs a real
            // Priority instance to key its lookup (PortalRequestController.php:112-115).
            'priority' => Priority::Normal->value,
            'category' => 'general',
            'subject' => $subject,
            'description' => $message->body,
        ]);

        // applyTo() runs AFTER create(), not before: the anchor is
        // created_at, which does not exist until the row is inserted.
        $this->clock->applyTo($ticket);
        $ticket->save();

        $picked = $this->assigner->pick();

        if ($picked !== null) {
            $ticket->assigned_to = $picked->id;
            $ticket->save();
            $ticket->recordAutoAssigned($picked->id);
        }

        $ticketMessage = $ticket->messages()->create([
            'author_type' => TicketMessage::AUTHOR_CUSTOMER,
            'user_id' => null,
            'customer_id' => $customer->id,
            'channel' => $ticket->channel,
            'body' => $message->body,
        ]);

        return [$ticket, $ticketMessage];
    }
}
