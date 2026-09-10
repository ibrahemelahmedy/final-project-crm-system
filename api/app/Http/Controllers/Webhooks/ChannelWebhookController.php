<?php

namespace App\Http\Controllers\Webhooks;

use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelProvider;
use App\Http\Controllers\Controller;
use App\Models\ChannelConnection;
use App\Services\Channels\ChannelAdapters;
use App\Services\Channels\MessageIngestor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Story 26 (WIS-22), Decisions 2-4. The ordering of the checks in receive()
 * IS the threat model — do not reorder them.
 */
class ChannelWebhookController extends Controller
{
    public function __construct(
        private readonly ChannelAdapters $adapters,
        private readonly MessageIngestor $ingestor,
    ) {}

    public function receive(Request $request, string $provider): JsonResponse
    {
        $providerEnum = ChannelProvider::tryFrom($provider) ?? abort(404);

        // Hashing an unbounded body is the cheap DoS — reject BEFORE the HMAC.
        if (strlen($request->getContent()) > (int) config('channels.inbound.max_body_bytes')) {
            abort(413);
        }

        $connection = $this->connectionFor($providerEnum);

        if ($connection === null || $connection->status !== ChannelConnectionStatus::Connected) {
            // The SAME 401 as a bad signature — the endpoint must not
            // disclose which channels are live.
            return $this->rejected();
        }

        $adapter = $this->adapters->for($providerEnum);

        if (! $adapter->verify($request, $connection)) {
            return $this->rejected();
        }

        $messages = array_slice(
            $adapter->parse($request, $connection),
            0,
            (int) config('channels.inbound.max_per_request'),
        );

        $accepted = 0;

        foreach ($messages as $message) {
            try {
                $this->ingestor->ingest($connection, $message);
                $accepted++;
            } catch (Throwable $e) {
                Log::error('Channel message ingestion failed.', ['exception' => $e::class]);
            }
        }

        // Always 2xx once verification has passed (Decision 4) — providers
        // retry non-2xx aggressively and some disable a webhook after
        // sustained failures.
        return response()->json(['received' => $accepted], 202);
    }

    public function verify(Request $request, string $provider): Response
    {
        $providerEnum = ChannelProvider::tryFrom($provider) ?? abort(404);

        $connection = $this->connectionFor($providerEnum);

        if ($connection === null) {
            return $this->rejected();
        }

        $adapter = $this->adapters->for($providerEnum);

        return $adapter->challenge($request, $connection) ?? abort(405);
    }

    private function connectionFor(ChannelProvider $provider): ?ChannelConnection
    {
        return ChannelConnection::query()->where('channel', $provider->channel()->value)->first();
    }

    private function rejected(): JsonResponse
    {
        return response()->json(['message' => __('channels.webhook_rejected')], 401);
    }
}
