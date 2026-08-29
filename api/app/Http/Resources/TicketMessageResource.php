<?php

namespace App\Http\Resources;

use App\Models\TicketMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class TicketMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ticket_id' => $this->ticket_id,
            'author_type' => $this->author_type,
            'author' => $this->authorPayload(),
            'is_mine' => $this->author_type === TicketMessage::AUTHOR_AGENT
                && $this->user_id === $request->user()?->id,
            'channel' => $this->channel->value,
            'channel_label' => $this->channel->label(),
            'body' => $this->body,
            'visibility' => $this->visibility->value,
            'mentions' => $this->whenLoaded(
                'mentions',
                fn () => $this->mentions->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values()
            ),
            'created_at' => $this->created_at,
        ];
    }

    /** @return array{id: int, name: string, initials: string}|null */
    private function authorPayload(): ?array
    {
        $model = match ($this->author_type) {
            TicketMessage::AUTHOR_AGENT => $this->author,
            TicketMessage::AUTHOR_CUSTOMER => $this->customer,
            default => null,
        };

        if (! $model) {
            return null;
        }

        return [
            'id' => $model->id,
            'name' => $model->name,
            'initials' => static::initials($model->name),
        ];
    }

    private static function initials(string $name): string
    {
        $words = Str::of($name)->squish()->explode(' ')->filter()->values();

        if ($words->isEmpty()) {
            return '';
        }

        $first = Str::upper(Str::substr($words->first(), 0, 1));

        if ($words->count() === 1) {
            return $first;
        }

        return $first.Str::upper(Str::substr($words->last(), 0, 1));
    }
}
