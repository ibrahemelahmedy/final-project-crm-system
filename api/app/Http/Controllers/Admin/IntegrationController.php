<?php

namespace App\Http\Controllers\Admin;

use App\Enums\IntegrationStatus;
use App\Enums\IntegrationType;
use App\Http\Controllers\Controller;
use App\Http\Requests\SaveIntegrationRequest;
use App\Http\Requests\TestIntegrationRequest;
use App\Http\Resources\IntegrationResource;
use App\Models\Integration;
use App\Services\AuditTrail;
use App\Services\IntegrationConnectionTester;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Story 18 (WIS-19). Admin-only connect/configure/status/test surface for the
 * five integration types. No provider-specific wiring — see the story plan's
 * "Explicitly out of scope".
 */
class IntegrationController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly IntegrationConnectionTester $tester,
        private readonly AuditTrail $audit,
    ) {}

    /**
     * All five types, in IntegrationType declaration order, whether or not a
     * row exists — one query, never five.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Integration::class);

        $rows = Integration::query()->get()->keyBy(fn (Integration $i) => $i->type->value);

        return IntegrationResource::collection(
            collect(IntegrationType::cases())
                ->map(fn (IntegrationType $type) => IntegrationResource::forType($type, $rows->get($type->value)))
        );
    }

    public function save(SaveIntegrationRequest $request, string $type): JsonResponse
    {
        $this->authorize('update', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);

        $existing = Integration::where('type', $integrationType->value)->first();
        $wasConnected = $existing !== null;

        $validated = $request->validated();
        $secret = $validated['secret'] ?? null;

        $result = $this->tester->test(
            $validated['endpoint_url'],
            $secret ?? $existing?->secret,
        );

        $integration = DB::transaction(function () use ($integrationType, $validated, $secret, $result, $request, $wasConnected) {
            $attributes = [
                'endpoint_url' => $validated['endpoint_url'],
                'status' => $result['ok'] ? IntegrationStatus::Connected->value : IntegrationStatus::Error->value,
                'last_error' => $result['ok'] ? null : $result['error'],
                'connected_by' => $request->user()->id,
            ];

            if ($result['ok']) {
                $attributes['last_checked_at'] = now();
            } else {
                $attributes['last_check_failed_at'] = now();
            }

            if ($secret !== null && $secret !== '') {
                $attributes['secret'] = $secret;
                $attributes['secret_last_four'] = substr($secret, -4);
            }

            $integration = Integration::updateOrCreate(
                ['type' => $integrationType->value],
                $attributes,
            );

            // A failing save is its own event — takes priority over
            // connected/updated, per the story's audit contract.
            $event = match (true) {
                ! $result['ok'] => AuditTrail::INTEGRATION_TEST_FAILED,
                ! $wasConnected => AuditTrail::INTEGRATION_CONNECTED,
                default => AuditTrail::INTEGRATION_UPDATED,
            };

            $this->audit->record($event, $request->user(), $request, [
                ...AuditTrail::target('integration', $integrationType->value, $integrationType->value),
                'endpoint_url' => $validated['endpoint_url'],
            ]);

            return $integration;
        });

        return response()->json([
            'data' => IntegrationResource::forType($integrationType, $integration),
            'test' => ['ok' => $result['ok'], 'error_key' => $result['error']],
        ]);
    }

    /**
     * Test-only. Writes nothing — not the row, not last_checked_at, not an
     * audit entry. A failed pre-save probe is not an event; a failed SAVE is.
     */
    public function test(TestIntegrationRequest $request, string $type): JsonResponse
    {
        $this->authorize('update', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);

        $existing = Integration::where('type', $integrationType->value)->first();
        $validated = $request->validated();

        $endpointUrl = $validated['endpoint_url'] ?? $existing?->endpoint_url ?? '';
        $secret = array_key_exists('secret', $validated) ? $validated['secret'] : $existing?->secret;

        $result = $this->tester->test($endpointUrl, $secret);

        return response()->json(['ok' => $result['ok'], 'error_key' => $result['error']]);
    }

    /**
     * Deletes the row — the stored endpoint AND the secret are gone.
     * Idempotent: deleting a type with no row is also 204.
     */
    public function destroy(Request $request, string $type): JsonResponse
    {
        $this->authorize('delete', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);

        $integration = Integration::where('type', $integrationType->value)->first();

        if ($integration !== null) {
            $integration->delete();

            $this->audit->record(AuditTrail::INTEGRATION_DISCONNECTED, $request->user(), $request, [
                ...AuditTrail::target('integration', $integrationType->value, $integrationType->value),
            ]);
        }

        return response()->json(null, 204);
    }
}
