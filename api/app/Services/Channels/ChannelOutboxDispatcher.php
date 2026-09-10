<?php

namespace App\Services\Channels;

use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelDeliveryStatus;
use App\Models\ChannelOutboundMessage;

/**
 * Story 26 (WIS-22), Decision 8. One delivery attempt per call. Mutates and
 * saves $message. Never throws. Ports OutboxDispatcher line for line, with
 * the connection-not-Connected addition (Edge Case 18) and the DNS-blip
 * carve-out (Edge Case 19) kept intact.
 */
class ChannelOutboxDispatcher
{
    public function __construct(private readonly ChannelSenders $senders) {}

    public function attempt(ChannelOutboundMessage $message): ChannelDeliveryStatus
    {
        $connection = $message->connection;

        if ($connection === null) {
            $message->status = ChannelDeliveryStatus::Dead->value;
            $message->failed_at = now();
            $message->last_error_key = 'channels.error.connection_gone';
            $message->save();

            return ChannelDeliveryStatus::Dead;
        }

        // Edge Case 18: not Dead — an admin fixing a rejected credential must
        // not have lost the reply. Queue up rather than burn an attempt.
        if ($connection->status !== ChannelConnectionStatus::Connected) {
            $backoffList = (array) config('channels.outbound.backoff');
            $backoff = $backoffList[0];

            $message->status = ChannelDeliveryStatus::Pending->value;
            $message->next_attempt_at = now()->addSeconds($backoff);
            $message->last_error_key = 'channels.error.connection_not_connected';
            $message->save();

            return ChannelDeliveryStatus::Pending;
        }

        $response = $this->senders->for($connection->provider)->send($connection, $message);

        $message->attempts++;
        $message->last_status = $response->status;

        if ($response->ok) {
            $message->status = ChannelDeliveryStatus::Delivered->value;
            $message->delivered_at = now();
            $message->last_error_key = null;
            $message->save();

            $connection->forceFill(['last_outbound_at' => now()])->saveQuietly();

            return ChannelDeliveryStatus::Delivered;
        }

        $maxAttempts = (int) config('channels.outbound.max_attempts');

        // Edge Case 19 / the WIS-24 plan-review carve-out: a guard
        // `integrations.error.unreachable` verdict is a DNS blip and IS
        // retryable, even though every other guard verdict (scheme,
        // blocked_host) is a permanent configuration error.
        $retryable = $response->retryable
            || $response->errorKey === 'integrations.error.unreachable';

        if (! $retryable) {
            $message->status = ChannelDeliveryStatus::Dead->value;
            $message->failed_at = now();
            $message->last_error_key = $response->errorKey;
            $message->save();

            if (in_array($response->status, [401, 403], true)) {
                $connection->forceFill([
                    'status' => ChannelConnectionStatus::Error->value,
                    'last_error_key' => $response->errorKey,
                    'last_error_at' => now(),
                ])->saveQuietly();
            }

            return ChannelDeliveryStatus::Dead;
        }

        if ($message->attempts >= $maxAttempts) {
            $message->status = ChannelDeliveryStatus::Dead->value;
            $message->failed_at = now();
            $message->last_error_key = 'channels.error.max_attempts';
            $message->save();

            return ChannelDeliveryStatus::Dead;
        }

        $backoffList = (array) config('channels.outbound.backoff');
        $backoff = $backoffList[min($message->attempts - 1, count($backoffList) - 1)];

        $message->status = ChannelDeliveryStatus::Pending->value;
        $message->next_attempt_at = now()->addSeconds($backoff);
        $message->last_error_key = $response->errorKey;
        $message->save();

        return ChannelDeliveryStatus::Pending;
    }
}
