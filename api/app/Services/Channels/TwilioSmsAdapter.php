<?php

namespace App\Services\Channels;

use App\Enums\Channel;
use App\Models\ChannelConnection;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Story 26 (WIS-22), Decision 3. Twilio SMS webhook.
 *
 * verify() is the ONE adapter that legitimately reads the parsed form
 * fields — Twilio signs a canonicalised parameter list, not the raw body.
 * Do not "fix" this to $request->getContent().
 */
class TwilioSmsAdapter implements InboundWebhookAdapter
{
    public function verify(Request $request, ChannelConnection $connection): bool
    {
        $header = $request->header('X-Twilio-Signature');

        if (! is_string($header) || $header === '') {
            return false;
        }

        try {
            $token = $connection->secret;
        } catch (Throwable) {
            return false;
        }

        if ($token === null || $token === '') {
            return false;
        }

        $params = $request->request->all();
        ksort($params);

        $data = $request->fullUrl();
        foreach ($params as $key => $value) {
            $data .= $key.(is_array($value) ? implode('', $value) : (string) $value);
        }

        $expected = base64_encode(hash_hmac('sha1', $data, $token, true));

        return hash_equals($expected, $header);
    }

    public function challenge(Request $request, ChannelConnection $connection): ?Response
    {
        return null;
    }

    public function parse(Request $request, ChannelConnection $connection): array
    {
        try {
            $sid = (string) $request->input('MessageSid', '');
            $from = (string) $request->input('From', '');
            $body = (string) $request->input('Body', '');
            $numMedia = (int) $request->input('NumMedia', 0);

            if ($sid === '' || $from === '') {
                return [];
            }

            return [new InboundMessage(
                providerMessageId: $sid,
                channel: Channel::Sms,
                fromEmail: null,
                fromPhone: $from,
                fromName: null,
                subject: '',
                body: $body,
                threadRefs: [],
                hadAttachment: $numMedia > 0,
                occurredAt: CarbonImmutable::now(),
            )];
        } catch (Throwable) {
            return [];
        }
    }
}
