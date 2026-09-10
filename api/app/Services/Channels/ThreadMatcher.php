<?php

namespace App\Services\Channels;

use App\Enums\TicketStatus;
use App\Models\ChannelInboundMessage;
use App\Models\ChannelOutboundMessage;
use App\Models\Customer;
use App\Models\Ticket;

/**
 * Story 26 (WIS-22), Decision 6. Three genuinely different mechanisms
 * behind one entry point, with the identity check as the LAST step so it
 * cannot be skipped by a caller.
 */
class ThreadMatcher
{
    public function match(InboundMessage $message, ?Customer $customer): ?Ticket
    {
        if ($customer === null) {
            // An unrecognised sender NEVER joins an existing thread.
            return null;
        }

        $candidate = $message->threadRefs !== []
            ? $this->byThreadRefs($message)
            : null;

        $candidate ??= $this->bySubjectToken($message);
        $candidate ??= $this->byRecentChannelTicket($message, $customer);

        // THE security boundary. A forged In-Reply-To or a guessed [#412]
        // subject token must never attach a message to a stranger's ticket.
        if ($candidate === null || $candidate->customer_id !== $customer->id) {
            return null;
        }

        return $candidate;
    }

    private function byThreadRefs(InboundMessage $message): ?Ticket
    {
        foreach ($message->threadRefs as $ref) {
            $outbound = ChannelOutboundMessage::query()->where('provider_message_id', $ref)->first();

            if ($outbound !== null && $outbound->ticket_id !== null) {
                return $outbound->ticket;
            }

            $inbound = ChannelInboundMessage::query()->where('provider_message_id', $ref)->first();

            if ($inbound !== null && $inbound->ticket_id !== null) {
                return $inbound->ticket;
            }
        }

        return null;
    }

    private function bySubjectToken(InboundMessage $message): ?Ticket
    {
        if (preg_match((string) config('channels.inbound.subject_token_pattern'), $message->subject, $m) !== 1) {
            return null;
        }

        return Ticket::find((int) $m[1]);
    }

    private function byRecentChannelTicket(InboundMessage $message, Customer $customer): ?Ticket
    {
        return Ticket::query()
            ->whereBelongsTo($customer)
            ->where('channel', $message->channel->value)
            ->whereNot('status', TicketStatus::Closed->value)
            ->where('updated_at', '>=', now()->subHours((int) config('channels.inbound.thread_window_hours')))
            ->latest('updated_at')
            ->first();
    }
}
