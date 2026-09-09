<?php

namespace App\Services\Integrations;

use App\Enums\OutboxStatus;
use App\Models\IntegrationOutboxMessage;

/**
 * Story 25 (WIS-24), Decision 3. One delivery attempt per call. Mutates and
 * saves $message. Never throws.
 */
class OutboxDispatcher
{
    public function __construct(private readonly OutboundHttpClient $http) {}

    public function attempt(IntegrationOutboxMessage $message): OutboxStatus
    {
        $integration = $message->integration;

        if ($integration === null) {
            $message->status = OutboxStatus::Dead;
            $message->failed_at = now();
            $message->last_error_key = 'integrations.sync.error.integration_gone';
            $message->save();

            return $message->status;
        }

        $url = $integration->outbound_url;

        if (blank($url)) {
            $message->status = OutboxStatus::Dead;
            $message->failed_at = now();
            $message->last_error_key = 'integrations.sync.error.no_endpoint';
            $message->save();

            return $message->status;
        }

        $response = $this->http->post($integration, $url, $message->payload, [
            'X-Wisal-Event' => $message->event->value,
            'X-Wisal-Event-Id' => $message->event_id,
        ]);

        $message->attempts++;
        $message->last_status = $response->status;

        if ($response->ok) {
            $message->status = OutboxStatus::Delivered;
            $message->delivered_at = now();
            $message->last_error_key = null;
            $message->save();

            return $message->status;
        }

        $maxAttempts = (int) config('integrations.sync.outbound.max_attempts');

        // Edge case 2. A guard rejection is permanent EXCEPT for
        // `integrations.error.unreachable`: gethostbyname() returning the host
        // unchanged is a DNS blip, and a DNS blip is transient. Every other
        // guard verdict (scheme, blocked_host) is a configuration error that
        // will not self-heal, so it dead-letters immediately. This is the one
        // guard verdict that is not permanent — do not treat them all alike.
        $retryable = $response->retryable
            || $response->errorKey === 'integrations.error.unreachable';

        if (! $retryable) {
            $message->status = OutboxStatus::Dead;
            $message->failed_at = now();
            $message->last_error_key = $response->errorKey;
            $message->save();

            return $message->status;
        }

        if ($message->attempts >= $maxAttempts) {
            $message->status = OutboxStatus::Dead;
            $message->failed_at = now();
            $message->last_error_key = 'integrations.sync.error.max_attempts';
            $message->save();

            return $message->status;
        }

        $backoffList = (array) config('integrations.sync.outbound.backoff');
        $backoff = $backoffList[min($message->attempts - 1, count($backoffList) - 1)];

        $message->status = OutboxStatus::Pending;
        $message->next_attempt_at = now()->addSeconds($backoff);
        $message->last_error_key = $response->errorKey;
        $message->save();

        return $message->status;
    }
}
