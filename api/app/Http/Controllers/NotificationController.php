<?php

namespace App\Http\Controllers;

use App\Http\Requests\IndexNotificationRequest;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Story 11's Notifications Centre. Every action is scoped to `auth()->id()`
 * with no request-supplied user parameter — there is no cross-user read
 * path. `markRead` on another user's row is a 404 (not 403): a 403 would
 * confirm the row exists at all.
 */
class NotificationController extends Controller
{
    public function index(IndexNotificationRequest $request): AnonymousResourceCollection
    {
        $notifications = Notification::query()
            ->forUser($request->user())
            ->when($request->query('filter') === 'unread', fn ($q) => $q->unread())
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(min((int) $request->query('per_page', 20), IndexNotificationRequest::MAX_PER_PAGE))
            ->withQueryString();

        return NotificationResource::collection($notifications);
    }

    /** The bell's ONLY source of truth. Server-derived on every call. */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = Notification::query()
            ->forUser($request->user())
            ->unread()
            ->count();

        return response()->json(['count' => $count]);
    }

    /**
     * Idempotent: sets `read_at` only where it is currently null, so a second
     * call is a no-op and does not rewrite the timestamp.
     */
    public function markRead(Request $request, int $notification): JsonResponse
    {
        $row = Notification::query()
            ->forUser($request->user())
            ->find($notification);

        abort_if($row === null, 404);

        $row->newQuery()
            ->whereKey($row->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(
            (new NotificationResource($row->refresh()))->toArray($request)
        );
    }

    /** Idempotent, and affects only the caller's own rows. */
    public function markAllRead(Request $request): JsonResponse
    {
        Notification::query()
            ->forUser($request->user())
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['status' => 'ok']);
    }
}
