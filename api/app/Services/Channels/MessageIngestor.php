<?php

namespace App\Services\Channels;

use App\Enums\TicketStatus;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Story 26 (WIS-22), Decision 5 & 6. The provider-agnostic ingestion core.
 * Never throws — every caller (the webhook controller, the console fixture
 * command, the chat widget) treats this as the one write path.
 */
class MessageIngestor
{
    public function __construct(
        private readonly InboundCustomerResolver $customers,
        private readonly ThreadMatcher $matcher,
        private readonly IngestedTicketFactory $factory,
    ) {}

    /** @return string One of: ignored | duplicate | created | appended */
    public function ingest(ChannelConnection $connection, InboundMessage $message): string
    {
        if (! config('channels.enabled')) {
            return 'ignored';
        }

        // Duplicate check FIRST, before any write. Decision 5's zero-write
        // no-op depends on this happening before anything else touches the
        // database.
        $exists = ChannelInboundMessage::query()
            ->where('channel_connection_id', $connection->id)
            ->where('provider_message_id', $message->providerMessageId)
            ->exists();

        if ($exists) {
            return 'duplicate';
        }

        $customer = $this->customers->resolve($message);
        $ticket = $this->matcher->match($message, $customer);

        try {
            $outcome = DB::transaction(function () use ($connection, $message, $customer, $ticket) {
                if ($ticket !== null) {
                    $ticketMessage = $this->append($ticket, $message, $customer);
                    $outcome = 'appended';
                    $ticketForLedger = $ticket;
                } else {
                    [$ticketForLedger, $ticketMessage] = $this->factory->create($message, $customer);
                    $outcome = 'created';
                }

                $threadRef = $message->threadRefs[0] ?? null;

                try {
                    DB::transaction(function () use ($connection, $message, $ticketForLedger, $ticketMessage, $customer, $outcome, $threadRef) {
                        ChannelInboundMessage::create([
                            'channel_connection_id' => $connection->id,
                            'provider_message_id' => $message->providerMessageId,
                            'external_thread_ref' => $threadRef,
                            'ticket_id' => $ticketForLedger->id,
                            'ticket_message_id' => $ticketMessage->id,
                            'customer_id' => $customer->id,
                            'outcome' => $outcome,
                            'received_at' => now(),
                        ]);
                    });
                } catch (QueryException $e) {
                    if (! $this->isUniqueViolation($e)) {
                        throw $e;
                    }

                    // A concurrent duplicate won the race. Roll the outer
                    // work back and report it as a duplicate.
                    throw new DuplicateIngestionException;
                }

                return $outcome;
            });
        } catch (DuplicateIngestionException) {
            return 'duplicate';
        }

        // After commit, saveQuietly so the bump fires no model events.
        $connection->forceFill(['last_inbound_at' => now()])->saveQuietly();

        return $outcome;
    }

    private function append(Ticket $ticket, InboundMessage $message, Customer $customer): TicketMessage
    {
        $message2 = $ticket->messages()->create([
            'author_type' => TicketMessage::AUTHOR_CUSTOMER,
            'user_id' => null,
            'customer_id' => $customer->id,
            'channel' => $ticket->channel,
            'body' => $message->body,
        ]);

        $ticket->touch();

        TicketEvent::create([
            'ticket_id' => $ticket->id,
            'user_id' => null,
            'event' => 'replied',
            'field' => null,
            'old_value' => null,
            'new_value' => (string) $message2->id,
            'created_at' => $message2->created_at,
        ]);

        if ($ticket->status === TicketStatus::Resolved) {
            $ticket->update(['status' => TicketStatus::Open->value, 'resolved_at' => null]);
            $ticket->recordReopened();
        }

        Customer::whereKey($customer->id)
            ->where(fn ($q) => $q->whereNull('last_contact_at')
                ->orWhere('last_contact_at', '<', $message2->created_at))
            ->update(['last_contact_at' => $message2->created_at]);

        return $message2;
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || $sqlState === '23505';
    }
}

/** Internal control-flow signal only — never escapes MessageIngestor::ingest(). */
final class DuplicateIngestionException extends \RuntimeException {}
