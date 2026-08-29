<?php

namespace App\Services;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Validates the `mentions: int[]` submitted with an internal note against
 * `TicketPolicy::view` for the ticket being replied to. Runs BEFORE the
 * message insert (see MentionAuthorizationTest) so a rejected mention can
 * never leave a partially-created message row — mentioning must never
 * become a content-leak channel.
 */
class MentionResolver
{
    /**
     * @param  int[]  $mentionIds
     * @return Collection<int, User> resolved, authorized mentioned users
     *
     * @throws ValidationException a 422 naming the specific user and reason
     */
    public function resolve(array $mentionIds, Ticket $ticket): Collection
    {
        if (empty($mentionIds)) {
            return collect();
        }

        $users = User::query()->whereIn('id', $mentionIds)->get()->keyBy('id');

        foreach ($mentionIds as $id) {
            /** @var User|null $user */
            $user = $users->get($id);

            if (! $user) {
                throw ValidationException::withMessages([
                    'mentions' => "Mentioned user #{$id} does not exist.",
                ]);
            }

            if (! $user->is_active) {
                throw ValidationException::withMessages([
                    'mentions' => "{$user->name} is deactivated and cannot be mentioned.",
                ]);
            }

            if ($user->cannot('view', $ticket)) {
                throw ValidationException::withMessages([
                    'mentions' => "{$user->name} does not have access to this ticket and cannot be mentioned.",
                ]);
            }
        }

        return $users->values();
    }
}
