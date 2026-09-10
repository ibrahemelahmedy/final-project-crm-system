<?php

namespace App\Http\Controllers;

use App\Enums\Channel;
use App\Http\Requests\ChannelOverviewRequest;
use App\Http\Resources\ChannelOverviewResource;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
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

        // Story 26 (WIS-22). At most four rows — never more than
        // Channel::connectable() has cases.
        $connections = ChannelConnection::query()->get()->keyBy(fn (ChannelConnection $c) => $c->channel->value);

        // The 24h inbound count is deliberately NOT visibleTo-scoped: it
        // counts arrivals on a wire, not tickets an agent may read, so
        // scoping it would make two agents disagree about whether a channel
        // is receiving traffic. ticket_count above stays scoped exactly as
        // it was.
        $inbound24h = ChannelInboundMessage::query()
            ->since(now()->subDay())
            ->groupBy('channel_connection_id')
            ->selectRaw('channel_connection_id, count(*) as aggregate')
            ->pluck('aggregate', 'channel_connection_id');

        $channels = collect(Channel::cases())->map(function (Channel $c) use ($counts, $connections, $inbound24h) {
            $connection = $connections->get($c->value);

            return [
                'value' => $c->value,
                'label_key' => "channels.{$c->value}.label",
                'status' => $connection?->status?->value ?? 'not_connected',
                'ticket_count' => (int) ($counts[$c->value] ?? 0),
                'connection' => $connection === null ? null : [
                    'provider' => $connection->provider->value,
                    'last_inbound_at' => $connection->last_inbound_at,
                    'inbound_24h' => (int) ($inbound24h[$connection->id] ?? 0),
                    'last_error_key' => $connection->last_error_key,
                    'connectable' => in_array($c, Channel::connectable(), true),
                ],
            ];
        });

        return new ChannelOverviewResource([
            'channels' => $channels,
            'period' => $request->period(),
            'from' => $from,
            'to' => $to,
            'total_tickets' => $total,
        ]);
    }
}
