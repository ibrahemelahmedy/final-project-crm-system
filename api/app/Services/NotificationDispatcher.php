<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * The ONLY way a notification row is created (Story 11). Stories 06 and 10
 * call `dispatch()`; neither inserts into the `notifications` table directly.
 *
 * The deactivated-recipient guard lives HERE, inside the single write path,
 * so no producer can bypass it by writing to the model or table directly.
 */
class NotificationDispatcher
{
    public function dispatch(
        User $recipient,
        NotificationType $type,
        string $title,
        ?string $body = null,
        ?Model $source = null,
        ?string $linkTo = null,
    ): ?Notification {
        // A deactivated account gets nothing. Rows created before
        // deactivation stay in the table but are unreachable — every read
        // path requires an authenticated (and `active`-gated) session.
        if (! $recipient->is_active) {
            return null;
        }

        return Notification::create([
            'user_id' => $recipient->id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'source_type' => $source?->getMorphClass(),
            'source_id' => $source?->getKey(),
            'link_to' => $linkTo,
        ]);
    }
}
