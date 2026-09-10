<?php

namespace App\Services\Channels;

use App\Enums\Channel;
use App\Models\ChannelConnection;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Story 26 (WIS-22), Decision 3. The repo's own X-Wisal-Signature scheme —
 * byte-identical in shape to what OutboundHttpClient.php:91 sends.
 */
class EmailWebhookAdapter implements InboundWebhookAdapter
{
    public function verify(Request $request, ChannelConnection $connection): bool
    {
        $header = $request->header('X-Wisal-Signature');

        if (! is_string($header) || $header === '') {
            return false;
        }

        try {
            $secret = $connection->secret;
        } catch (Throwable) {
            return false;
        }

        if ($secret === null || $secret === '') {
            return false;
        }

        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $secret);

        return hash_equals($expected, $header);
    }

    public function challenge(Request $request, ChannelConnection $connection): ?Response
    {
        return null;
    }

    public function parse(Request $request, ChannelConnection $connection): array
    {
        try {
            $payload = $request->json()->all();
        } catch (Throwable) {
            return [];
        }

        $messageId = $payload['message_id'] ?? null;

        if (! is_string($messageId) || $messageId === '') {
            return [];
        }

        $from = (array) ($payload['from'] ?? []);
        $fromEmail = is_string($from['email'] ?? null) ? $from['email'] : null;
        $fromName = is_string($from['name'] ?? null) ? $from['name'] : null;

        if ($fromEmail === null || $fromEmail === '') {
            return [];
        }

        $subject = (string) ($payload['subject'] ?? '');

        $text = $payload['text'] ?? null;
        if (! is_string($text) || $text === '') {
            $html = (string) ($payload['html'] ?? '');
            $text = $html !== '' ? strip_tags($html) : '';
        }

        $body = $this->stripQuotedReply((string) $text);
        $body = Str::limit($body, (int) config('channels.inbound.max_message_chars'), '');

        $inReplyTo = $payload['in_reply_to'] ?? null;
        $references = array_values(array_filter((array) ($payload['references'] ?? []), 'is_string'));

        $threadRefs = [];
        if (is_string($inReplyTo) && $inReplyTo !== '') {
            $threadRefs[] = $inReplyTo;
        }
        $threadRefs = [...$threadRefs, ...array_reverse($references)];
        $threadRefs = array_values(array_unique($threadRefs));

        $hadAttachment = ! empty($payload['attachments']);

        try {
            return [new InboundMessage(
                providerMessageId: $messageId,
                channel: Channel::Email,
                fromEmail: $fromEmail,
                fromPhone: null,
                fromName: $fromName,
                subject: $subject,
                body: $hadAttachment ? trim($body.' '.__('channels.inbound.attachment_placeholder')) : $body,
                threadRefs: $threadRefs,
                hadAttachment: $hadAttachment,
                occurredAt: CarbonImmutable::now(),
            )];
        } catch (Throwable) {
            return [];
        }
    }

    private function stripQuotedReply(string $text): string
    {
        $lines = preg_split('/\r\n|\r|\n/', $text) ?: [];
        $cut = null;

        foreach ($lines as $i => $line) {
            if (preg_match('/^(>|On .+ wrote:|-{2,}\s*$)/m', $line) === 1) {
                $cut = $i;
                break;
            }
        }

        if ($cut === null) {
            return trim($text);
        }

        return trim(implode("\n", array_slice($lines, 0, $cut)));
    }
}
