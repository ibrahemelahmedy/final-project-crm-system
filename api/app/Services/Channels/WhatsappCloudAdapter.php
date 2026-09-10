<?php

namespace App\Services\Channels;

use App\Enums\Channel;
use App\Models\ChannelConnection;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Story 26 (WIS-22), Decision 3. Meta's WhatsApp Cloud API webhook.
 */
class WhatsappCloudAdapter implements InboundWebhookAdapter
{
    public function verify(Request $request, ChannelConnection $connection): bool
    {
        $header = $request->header('X-Hub-Signature-256');

        if (! is_string($header) || $header === '') {
            return false;
        }

        try {
            $secret = $connection->secret;
        } catch (Throwable) {
            return false; // DecryptException after an APP_KEY rotation — never a 500.
        }

        if ($secret === null || $secret === '') {
            return false;
        }

        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $secret);

        return hash_equals($expected, $header);
    }

    public function challenge(Request $request, ChannelConnection $connection): ?Response
    {
        // PHP mangles '.' to '_' when populating $_GET / parsing a query
        // string (parse_str's variable-name sanitisation) — Meta's real
        // `hub.mode` / `hub.verify_token` / `hub.challenge` query params
        // therefore arrive as `hub_mode` / `hub_verify_token` /
        // `hub_challenge` by the time Laravel's Request sees them. Reading
        // the dotted names here never matches a real handshake.
        if ($request->query('hub_mode') !== 'subscribe') {
            return null;
        }

        try {
            $verifyToken = $connection->verify_token;
        } catch (Throwable) {
            return response('', 403);
        }

        $given = (string) $request->query('hub_verify_token', '');

        // Checking the token IS the point — echoing the challenge
        // unconditionally hands an attacker the subscription.
        if ($verifyToken === null || ! hash_equals((string) $verifyToken, $given)) {
            return response('', 403);
        }

        return response((string) $request->query('hub_challenge', ''), 200, [
            'Content-Type' => 'text/plain',
        ]);
    }

    public function parse(Request $request, ChannelConnection $connection): array
    {
        try {
            $payload = $request->json()->all();
        } catch (Throwable) {
            return [];
        }

        $messages = [];

        foreach ((array) ($payload['entry'] ?? []) as $entry) {
            foreach ((array) ($entry['changes'] ?? []) as $change) {
                $value = (array) ($change['value'] ?? []);

                // Delivery receipts, not messages. Never opens a ticket.
                if (isset($value['statuses'])) {
                    continue;
                }

                $contacts = (array) ($value['contacts'] ?? []);
                $contactName = $contacts[0]['profile']['name'] ?? null;

                foreach ((array) ($value['messages'] ?? []) as $raw) {
                    $message = $this->parseOne((array) $raw, $contactName);

                    if ($message !== null) {
                        $messages[] = $message;
                    }
                }
            }
        }

        return $messages;
    }

    private function parseOne(array $raw, ?string $contactName): ?InboundMessage
    {
        $id = $raw['id'] ?? null;
        $from = $raw['from'] ?? null;

        if (! is_string($id) || $id === '' || ! is_string($from) || $from === '') {
            return null;
        }

        $type = $raw['type'] ?? 'text';
        $hadAttachment = $type !== 'text';
        $body = $hadAttachment
            ? __('channels.inbound.attachment_placeholder')
            : (string) ($raw['text']['body'] ?? '');

        $timestamp = isset($raw['timestamp']) ? (int) $raw['timestamp'] : null;

        try {
            return new InboundMessage(
                providerMessageId: $id,
                channel: Channel::Whatsapp,
                fromEmail: null,
                fromPhone: str_starts_with($from, '+') ? $from : '+'.$from,
                fromName: $contactName,
                subject: '',
                body: $body,
                threadRefs: [],
                hadAttachment: $hadAttachment,
                occurredAt: $timestamp !== null ? CarbonImmutable::createFromTimestamp($timestamp) : CarbonImmutable::now(),
            );
        } catch (Throwable $e) {
            Log::warning('WhatsappCloudAdapter failed to build InboundMessage', ['exception' => $e::class]);

            return null;
        }
    }
}
