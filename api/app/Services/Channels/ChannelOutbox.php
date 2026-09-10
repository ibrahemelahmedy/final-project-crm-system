<?php

namespace App\Services\Channels;

use App\Enums\Channel;
use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelDeliveryStatus;
use App\Enums\MessageVisibility;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use App\Models\ChannelOutboundMessage;
use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Story 26 (WIS-22), Decision 8. The enqueue seam — structurally
 * App\Services\Integrations\IntegrationEvents. The ONLY caller is
 * TicketMessageController@store; this class carries no observer.
 */
final class ChannelOutbox
{
    /** Deliveries attempted inline THIS request. A process static. Reset in TestCase::setUp(). */
    private static int $attemptedThisRequest = 0;

    public static function resetInlineCounter(): void
    {
        self::$attemptedThisRequest = 0;
    }

    /**
     * Never throws: an enqueue failure must not fail the agent's reply.
     *
     * `$payload` is a Closure — see IntegrationEvents.php's docblock for the
     * bug this rule exists to prevent (an eager array argument runs
     * relation loads on every message create even with the flag off).
     */
    public function enqueue(TicketMessage $reply, \Closure $payload): void
    {
        try {
            $this->doEnqueue($reply, $payload);
        } catch (Throwable $e) {
            Log::error('Channel outbound enqueue failed.', ['exception' => $e::class]);
        }
    }

    private function doEnqueue(TicketMessage $reply, \Closure $payload): void
    {
        if (! config('channels.enabled')) {
            return;
        }

        if ($reply->visibility !== MessageVisibility::Public) {
            return;
        }

        $ticket = $reply->ticket;

        if ($ticket === null || ! in_array($ticket->channel, Channel::deliverable(), true)) {
            return;
        }

        $connection = ChannelConnection::query()->where('channel', $ticket->channel->value)->first();

        if ($connection === null || $connection->status !== ChannelConnectionStatus::Connected) {
            return;
        }

        $envelope = $payload();

        $recipient = $envelope['recipient'] ?? null;

        if (! is_string($recipient) || $recipient === '') {
            return;
        }

        try {
            $message = DB::transaction(fn () => ChannelOutboundMessage::create([
                'channel_connection_id' => $connection->id,
                'ticket_id' => $ticket->id,
                'ticket_message_id' => $reply->id,
                'recipient' => $recipient,
                'body' => (string) ($envelope['body'] ?? $reply->body),
                'in_reply_to' => $envelope['in_reply_to'] ?? null,
                'status' => ChannelDeliveryStatus::Pending->value,
                'attempts' => 0,
                'next_attempt_at' => null,
            ]));
        } catch (QueryException $e) {
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }

            return; // already enqueued for this (connection, ticket_message).
        }

        $id = $message->id;

        if (++self::$attemptedThisRequest > (int) config('channels.outbound.inline_max_per_request')) {
            return; // the scheduled drain will pick it up. Never log the body.
        }

        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return; // migrate:fresh --seed performs zero sends.
        }

        DB::afterCommit(function () use ($id) {
            app()->terminating(function () use ($id) {
                try {
                    $outbound = ChannelOutboundMessage::find($id);

                    if ($outbound !== null && $outbound->status === ChannelDeliveryStatus::Pending) {
                        app(ChannelOutboxDispatcher::class)->attempt($outbound);
                    }
                } catch (Throwable $e) {
                    Log::error('Channel outbound inline delivery failed.', [
                        'id' => $id,
                        'exception' => $e::class,
                    ]);
                }
            });
        });
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || $sqlState === '23505';
    }

    /**
     * The reply payload builder for TicketMessageController@store's enqueue
     * call site. Recipient is resolved from the customer at enqueue time,
     * not send time — an address change afterwards must not redirect an
     * already-queued delivery.
     *
     * @return array{recipient: ?string, body: string, in_reply_to: ?string}
     */
    public static function replyPayload(TicketMessage $message, Ticket $ticket): array
    {
        $customer = $ticket->customer;

        $recipient = match ($ticket->channel) {
            Channel::Email => $customer?->email,
            Channel::Whatsapp, Channel::Sms => $customer?->phone,
            default => null,
        };

        $inReplyTo = ChannelInboundMessage::query()
            ->where('ticket_id', $ticket->id)
            ->latest('received_at')
            ->value('provider_message_id');

        return [
            'recipient' => $recipient,
            'body' => (string) $message->body,
            'in_reply_to' => $inReplyTo,
        ];
    }
}
