<?php

namespace App\Http\Controllers;

use App\Enums\Channel;
use App\Http\Requests\ChannelOverviewRequest;
use App\Http\Resources\ChannelOverviewResource;
use App\Models\Ticket;

/**
 * Story 14 — Channels Overview (read-only) / WIS-15.
 *
 * A single read endpoint. There is NO migration, NO model, and NO policy in
 * this story — it adds zero schema. Authorization is "any authenticated user"
 * (the route sits in `auth:sanctum`), and the aggregate inherits the exact
 * ticket-visibility scope the queue uses (`Ticket::visibleTo`) rather than
 * re-implementing it — so an Agent whose queue is scoped to their own tickets
 * sees counts scoped the same way.
 *
 * The channel list is App\Enums\Channel (Story 04). There is no second channel
 * list anywhere: a sixth enum case appears here with no code change, its help
 * line falling back to a generic string on the frontend.
 */
class ChannelOverviewController extends Controller
{
    public function __invoke(ChannelOverviewRequest $request): ChannelOverviewResource
    {
        [$from, $to] = $request->window();

        $base = Ticket::query()
            ->visibleTo($request->user())              // the security boundary, inherited not re-derived
            ->whereBetween('created_at', [$from, $to]);

        // ONE aggregate query — never fetch rows and count them in PHP.
        $counts = (clone $base)
            ->whereNotNull('channel')
            ->groupBy('channel')
            ->selectRaw('channel, count(*) as aggregate')
            ->pluck('aggregate', 'channel');

        // Counted independently of the grouped query: any row with a NULL
        // channel (the column is NOT NULL today, but a future backfill gap
        // must not silently vanish) lands in the total and in no card, so the
        // per-card figures are allowed not to sum to the total.
        $total = (clone $base)->count();

        $channels = collect(Channel::cases())->map(fn (Channel $c) => [
            'value' => $c->value,
            'label_key' => "channels.{$c->value}.label",
            'status' => 'not_connected',
            'ticket_count' => (int) ($counts[$c->value] ?? 0),
        ]);

        return new ChannelOverviewResource([
            'channels' => $channels,
            'period' => $request->period(),
            'from' => $from,
            'to' => $to,
            'total_tickets' => $total,
        ]);
    }
}
