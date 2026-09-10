<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Channel;
use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelProvider;
use App\Http\Controllers\Controller;
use App\Http\Requests\SaveChannelConnectionRequest;
use App\Http\Resources\ChannelConnectionResource;
use App\Models\ChannelConnection;
use App\Services\AuditTrail;
use App\Services\Channels\ChannelHttpClient;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Story 26 (WIS-22), Task 39. Admin-only connect/configure/test/disconnect
 * surface for the four connectable channels. {channel} is the ONLY route
 * parameter (see routes/api.php's comment).
 */
class ChannelConnectionController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly ChannelHttpClient $http,
        private readonly AuditTrail $audit,
    ) {}

    /** All connectable channels, connected or not — one query, never four. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', ChannelConnection::class);

        $rows = ChannelConnection::query()->get()->keyBy(fn (ChannelConnection $c) => $c->channel->value);

        return ChannelConnectionResource::collection(
            collect(Channel::connectable())
                ->map(fn (Channel $c) => ChannelConnectionResource::forChannel($c, $rows->get($c->value)))
        );
    }

    public function save(SaveChannelConnectionRequest $request, string $channel): JsonResponse
    {
        $this->authorize('update', ChannelConnection::class);

        $channelEnum = Channel::tryFrom($channel);

        if ($channelEnum === null || ! in_array($channelEnum, Channel::connectable(), true)) {
            abort(404);
        }

        $validated = $request->validated();
        $existing = ChannelConnection::query()->where('channel', $channelEnum->value)->first();

        $secret = array_key_exists('secret', $validated) ? $validated['secret'] : null;
        $verifyToken = array_key_exists('verify_token', $validated) ? $validated['verify_token'] : null;

        $connection = DB::transaction(function () use ($channelEnum, $validated, $secret, $verifyToken, $request) {
            $attributes = [
                'provider' => $validated['provider'],
                'config' => $validated['config'] ?? [],
                'status' => ChannelConnectionStatus::Connected->value,
                'last_error_key' => null,
                'connected_by' => $request->user()->id,
            ];

            // Three-state contract: absent = keep, "" = clear, non-empty = replace.
            if ($secret !== null) {
                $attributes['secret'] = $secret === '' ? null : $secret;
                $attributes['secret_last_four'] = $secret === '' ? null : substr($secret, -4);
            }

            if ($verifyToken !== null) {
                $attributes['verify_token'] = $verifyToken === '' ? null : $verifyToken;
            }

            return ChannelConnection::updateOrCreate(['channel' => $channelEnum->value], $attributes);
        });

        $this->audit->record(AuditTrail::CHANNEL_CONNECTION_CHANGED, $request->user(), $request, [
            ...AuditTrail::target('channel', $channelEnum->value, $channelEnum->value),
            'verb' => $existing === null ? 'connected' : 'updated',
        ]);

        return response()->json([
            'data' => ChannelConnectionResource::forChannel($channelEnum, $connection->fresh()),
        ]);
    }

    /**
     * A credential probe. whatsapp_cloud / twilio_sms make a real (guarded)
     * GET; email_webhook / wisal_chat have no endpoint to probe and return a
     * local-validation-only result rather than faking a live check.
     */
    public function test(Request $request, string $channel): JsonResponse
    {
        $this->authorize('update', ChannelConnection::class);

        $channelEnum = Channel::tryFrom($channel);

        if ($channelEnum === null || ! in_array($channelEnum, Channel::connectable(), true)) {
            abort(404);
        }

        $connection = ChannelConnection::query()->where('channel', $channelEnum->value)->first();

        if ($connection === null) {
            return response()->json(['ok' => false, 'checked' => false, 'error_key' => 'channels.error.not_connected']);
        }

        [$ok, $checked, $errorKey] = $this->probe($connection);

        $connection->forceFill($ok
            ? ['status' => ChannelConnectionStatus::Connected->value, 'last_error_key' => null, 'last_error_at' => null]
            : ['status' => ChannelConnectionStatus::Error->value, 'last_error_key' => $errorKey, 'last_error_at' => now()]
        )->save();

        $this->audit->record(AuditTrail::CHANNEL_CONNECTION_CHANGED, $request->user(), $request, [
            ...AuditTrail::target('channel', $channelEnum->value, $channelEnum->value),
            'verb' => 'tested',
        ]);

        return response()->json(['ok' => $ok, 'checked' => $checked, 'error_key' => $errorKey]);
    }

    /** @return array{0: bool, 1: bool, 2: ?string} */
    private function probe(ChannelConnection $connection): array
    {
        try {
            $secret = $connection->secret;
        } catch (\Throwable) {
            return [false, true, 'channels.error.not_configured'];
        }

        return match ($connection->provider) {
            ChannelProvider::WhatsappCloud => $this->probeGet(
                (string) config('channels.providers.whatsapp_cloud.base_url').'/'.($connection->config['phone_number_id'] ?? ''),
                $secret,
            ),
            ChannelProvider::TwilioSms => $this->probeGet(
                (string) config('channels.providers.twilio_sms.base_url').'/Accounts/'.($connection->config['account_sid'] ?? '').'.json',
                null,
                $connection->config['account_sid'] ?? null,
                $secret,
            ),
            default => [true, false, null],
        };
    }

    /** @return array{0: bool, 1: bool, 2: ?string} */
    private function probeGet(string $url, ?string $bearer, ?string $basicUser = null, ?string $basicPass = null): array
    {
        $response = $this->http->get(
            $url,
            [],
            $bearer,
            $basicUser !== null && $basicPass !== null ? [$basicUser, $basicPass] : null,
        );

        return [$response->ok, true, $response->ok ? null : $response->errorKey];
    }

    /** Deletes the row — the absent row IS the not-connected state. */
    public function destroy(Request $request, string $channel): JsonResponse
    {
        $this->authorize('delete', ChannelConnection::class);

        $channelEnum = Channel::tryFrom($channel);

        if ($channelEnum === null || ! in_array($channelEnum, Channel::connectable(), true)) {
            abort(404);
        }

        $connection = ChannelConnection::query()->where('channel', $channelEnum->value)->first();

        if ($connection !== null) {
            $connection->delete();

            $this->audit->record(AuditTrail::CHANNEL_CONNECTION_CHANGED, $request->user(), $request, [
                ...AuditTrail::target('channel', $channelEnum->value, $channelEnum->value),
                'verb' => 'disconnected',
            ]);
        }

        return response()->json(null, 204);
    }
}
