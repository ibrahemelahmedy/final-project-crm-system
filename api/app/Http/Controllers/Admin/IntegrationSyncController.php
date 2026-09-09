<?php

namespace App\Http\Controllers\Admin;

use App\Enums\IntegrationType;
use App\Enums\OutboxStatus;
use App\Enums\SyncRunTrigger;
use App\Http\Controllers\Controller;
use App\Http\Requests\SaveIntegrationSyncRequest;
use App\Http\Resources\IntegrationResource;
use App\Http\Resources\OutboxMessageResource;
use App\Http\Resources\SyncRunResource;
use App\Models\Integration;
use App\Models\IntegrationOutboxMessage;
use App\Models\SyncRun;
use App\Services\AuditTrail;
use App\Services\Integrations\CustomerPuller;
use App\Services\Integrations\OutboxDispatcher;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Story 25 (WIS-24). Admin-only integration sync configuration, manual
 * "Run now", history, and dead-letter surface.
 */
class IntegrationSyncController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly CustomerPuller $puller,
        private readonly OutboxDispatcher $dispatcher,
        private readonly AuditTrail $audit,
    ) {}

    public function updateConfig(SaveIntegrationSyncRequest $request, string $type): JsonResponse
    {
        $this->authorize('update', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);

        $integration = Integration::where('type', $integrationType->value)->first();

        if ($integration === null) {
            abort(404);
        }

        $validated = $request->validated();

        $integration->fill([
            'inbound_enabled' => $validated['inbound_enabled'],
            'inbound_url' => $validated['inbound_url'] ?? null,
            'inbound_field_map' => $validated['inbound_field_map'] ?? null,
            'conflict_rules' => $validated['conflict_rules'] ?? null,
            'outbound_enabled' => $validated['outbound_enabled'],
            'outbound_url' => $validated['outbound_url'] ?? null,
            'outbound_events' => $validated['outbound_events'] ?? null,
        ])->save();

        $this->audit->record(AuditTrail::INTEGRATION_SYNC_CONFIG_CHANGED, $request->user(), $request, [
            ...AuditTrail::target('integration', $integrationType->value, $integrationType->value),
            'inbound_url' => $integration->inbound_url,
            'outbound_url' => $integration->outbound_url,
        ]);

        return response()->json(['data' => IntegrationResource::forType($integrationType, $integration)]);
    }

    public function runs(Request $request, string $type): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);
        $integration = Integration::where('type', $integrationType->value)->first();

        $perPage = min((int) $request->query('per_page', 20), 50);

        if ($integration === null) {
            return SyncRunResource::collection(
                (new SyncRun)->newQuery()->whereRaw('1 = 0')->paginate($perPage)->withQueryString()
            );
        }

        $runs = $integration->syncRuns()
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return SyncRunResource::collection($runs);
    }

    public function run(Request $request, string $type): JsonResponse
    {
        $this->authorize('update', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);
        $integration = Integration::where('type', $integrationType->value)->first();

        if ($integration === null) {
            abort(404);
        }

        if (! $integration->inbound_enabled) {
            return response()->json(['error_key' => 'integrations.sync.error.not_configured'], 422);
        }

        $run = $this->puller->pull($integration, SyncRunTrigger::Manual);

        return response()->json(['data' => new SyncRunResource($run)]);
    }

    public function outbox(Request $request, string $type): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);
        $integration = Integration::where('type', $integrationType->value)->first();

        $perPage = min((int) $request->query('per_page', 20), 50);

        if ($integration === null) {
            return OutboxMessageResource::collection(
                (new IntegrationOutboxMessage)->newQuery()->whereRaw('1 = 0')->paginate($perPage)->withQueryString()
            );
        }

        $messages = $integration->outboxMessages()
            ->dead()
            ->orderByDesc('failed_at')
            ->paginate($perPage)
            ->withQueryString();

        return OutboxMessageResource::collection($messages);
    }

    public function retryOutbox(Request $request, string $type): JsonResponse
    {
        $this->authorize('update', Integration::class);

        $integrationType = IntegrationType::tryFrom($type) ?? abort(404);
        $integration = Integration::where('type', $integrationType->value)->first();

        if ($integration === null) {
            abort(404);
        }

        $batchSize = (int) config('integrations.sync.outbound.batch_size');

        $ids = $integration->outboxMessages()
            ->dead()
            ->limit($batchSize)
            ->pluck('id');

        $requeued = IntegrationOutboxMessage::whereIn('id', $ids)->update([
            'status' => OutboxStatus::Pending->value,
            'attempts' => 0,
            'next_attempt_at' => null,
            'last_error_key' => null,
            'failed_at' => null,
        ]);

        return response()->json(['requeued' => $requeued]);
    }
}
