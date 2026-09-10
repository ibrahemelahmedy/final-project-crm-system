<?php

namespace App\Console\Commands;

use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use App\Services\Channels\ChannelAdapters;
use App\Services\Channels\MessageIngestor;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;

/**
 * Story 26 (WIS-22), Decision 13. Replays a stored provider payload through
 * the REAL verification + ingestion pipeline — signing the fixture with the
 * stored secret so verify() genuinely runs. This is how the owner sees
 * ingestion work before any external account exists.
 */
class IngestChannelFixtureCommand extends Command
{
    protected $signature = 'channels:ingest-fixture {provider} {--file=}';

    protected $description = 'Replay a stored provider webhook payload through the real verification and ingestion pipeline.';

    private const DEFAULT_FIXTURES = [
        'whatsapp_cloud' => 'whatsapp-cloud-text.json',
        'twilio_sms' => 'twilio-sms-form.json',
        'email_webhook' => 'email-inbound.json',
    ];

    public function handle(): int
    {
        $providerEnum = ChannelProvider::tryFrom((string) $this->argument('provider'));

        if ($providerEnum === null) {
            $this->error('Unknown provider: '.$this->argument('provider'));

            return self::FAILURE;
        }

        $file = $this->option('file') ?: base_path(
            'tests/fixtures/channels/'.(self::DEFAULT_FIXTURES[$providerEnum->value] ?? '')
        );

        if (! is_string($file) || $file === '' || ! file_exists($file)) {
            $this->error("Fixture file not found: {$file}");

            return self::FAILURE;
        }

        $connection = ChannelConnection::query()->where('channel', $providerEnum->channel()->value)->first();

        if ($connection === null || $connection->status !== ChannelConnectionStatus::Connected) {
            $this->error("Channel {$providerEnum->channel()->value} is not connected. Connect it first via Admin -> Channels.");

            return self::FAILURE;
        }

        $raw = (string) file_get_contents($file);
        $secret = $connection->secret;

        $request = Request::create('/api/webhooks/channels/'.$providerEnum->value, 'POST', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], $raw);

        if ($providerEnum === ChannelProvider::TwilioSms) {
            // The fixture is stored as a JSON object of field => value (Twilio
            // itself POSTs application/x-www-form-urlencoded) — decode it into
            // form fields here so verify() genuinely runs over the real
            // canonicalisation Twilio's scheme signs.
            $params = json_decode($raw, true) ?: [];
            $request = Request::create('https://example.com/api/webhooks/channels/twilio_sms', 'POST', $params);
            $data = $request->request->all();
            ksort($data);
            $signed = $request->fullUrl();
            foreach ($data as $k => $v) {
                $signed .= $k.$v;
            }
            $request->headers->set('X-Twilio-Signature', base64_encode(hash_hmac('sha1', $signed, (string) $secret, true)));
        } elseif ($providerEnum === ChannelProvider::WhatsappCloud) {
            $request->headers->set('X-Hub-Signature-256', 'sha256='.hash_hmac('sha256', $raw, (string) $secret));
        } else {
            $request->headers->set('X-Wisal-Signature', 'sha256='.hash_hmac('sha256', $raw, (string) $secret));
        }

        App::instance('request', $request);

        $adapter = app(ChannelAdapters::class)->for($providerEnum);

        if (! $adapter->verify($request, $connection)) {
            $this->error('Signature verification failed — the fixture could not be authenticated.');

            return self::FAILURE;
        }

        $messages = $adapter->parse($request, $connection);

        if ($messages === []) {
            $this->warn('The adapter parsed zero messages from this fixture.');

            return self::SUCCESS;
        }

        $ingestor = app(MessageIngestor::class);

        foreach ($messages as $message) {
            $outcome = $ingestor->ingest($connection, $message);

            $ledger = ChannelInboundMessage::query()
                ->where('channel_connection_id', $connection->id)
                ->where('provider_message_id', $message->providerMessageId)
                ->first();

            $this->info("provider_message_id: {$message->providerMessageId}");
            $this->info("outcome: {$outcome}");
            $this->info('ticket_id: '.($ledger?->ticket_id ?? 'n/a'));
        }

        return self::SUCCESS;
    }
}
