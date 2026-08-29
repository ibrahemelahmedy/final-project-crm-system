<?php

namespace App\Http\Resources;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * Story 11's notification shape. `source_available` is computed HERE by
 * resolving the morph target and running the recipient's own policy check
 * against it (e.g. TicketPolicy::view for a ticket source) — never a static
 * flag on the row. When it is false, `link_to` is omitted entirely so the
 * client cannot navigate into a 403/404: unavailability is learned from this
 * flag, never from following a dead link.
 */
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $sourceAvailable = $this->resolveSourceAvailable($request);

        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'tone' => $this->type->tone(),
            'title' => $this->title,
            'body' => $this->body,
            'link_to' => $sourceAvailable ? $this->link_to : null,
            'source_available' => $sourceAvailable,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
        ];
    }

    /**
     * True when the notification carries no source at all (nothing to hide),
     * or when the source record still exists AND passes the recipient's own
     * policy `view` check. False on a hard-deleted row or a policy failure —
     * the two cases the plan requires to render identically as "no longer
     * available".
     */
    private function resolveSourceAvailable(Request $request): bool
    {
        if (! $this->source_type || ! $this->source_id) {
            return true;
        }

        $modelClass = $this->source_type;

        if (! class_exists($modelClass) || ! is_subclass_of($modelClass, Model::class)) {
            return false;
        }

        /** @var Model|null $model */
        $model = $modelClass::find($this->source_id);

        if (! $model) {
            return false;
        }

        $user = $request->user();

        if (! $user) {
            return false;
        }

        return Gate::forUser($user)->allows('view', $model);
    }
}
