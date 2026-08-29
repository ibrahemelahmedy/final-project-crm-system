<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\IndexAuditLogRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;

/**
 * The audit log VIEWER. Read-only by construction: this controller has an
 * index and a facets action and nothing else, and api.php registers no PUT,
 * PATCH, or DELETE against an audit row. The AuditLog model refuses those
 * operations too, and on PostgreSQL a trigger refuses them a third time.
 *
 * Pagination is server-side and mandatory — the log grows unbounded, so there
 * is no "return everything" path to reach.
 */
class AuditLogController extends Controller
{
    use AuthorizesRequests;

    public function index(IndexAuditLogRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAuditLog', User::class);

        $logs = AuditLog::query()
            ->with('user:id,name,email')
            ->search($request->query('q'))
            ->when($request->query('actor_id'), fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->query('event'), fn ($q, $e) => $q->whereIn('event', (array) $e))
            // The date range is inclusive at both ends: `to=2026-08-28` means
            // "through the end of the 28th", not "up to 00:00 on the 28th".
            ->when($request->query('from'), fn ($q, $from) => $q->where('created_at', '>=', Carbon::parse($from)->startOfDay()))
            ->when($request->query('to'), fn ($q, $to) => $q->where('created_at', '<=', Carbon::parse($to)->endOfDay()))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(min((int) $request->query('per_page', 25), IndexAuditLogRequest::MAX_PER_PAGE))
            ->withQueryString();

        return AuditLogResource::collection($logs);
    }

    /** The viewer's actor and event filter option lists. */
    public function facets(Request $request): JsonResponse
    {
        $this->authorize('viewAuditLog', User::class);

        $eventCounts = AuditLog::query()
            ->select('event')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('event')
            ->pluck('aggregate', 'event');

        $actorIds = AuditLog::query()->whereNotNull('user_id')->distinct()->pluck('user_id');

        return response()->json([
            'events' => collect(AuditTrail::events())->map(fn (string $event) => [
                'value' => $event,
                'label' => AuditTrail::label($event),
                'count' => (int) ($eventCounts[$event] ?? 0),
            ])->values(),
            'actors' => User::whereIn('id', $actorIds)
                ->orderBy('name')
                ->get(['id', 'name', 'email'])
                ->map(fn (User $u) => ['value' => $u->id, 'label' => $u->name, 'email' => $u->email]),
            'total' => AuditLog::count(),
        ]);
    }
}
