<?php

namespace Database\Seeders;

use App\Enums\Channel;
use App\Enums\MessageVisibility;
use App\Models\CsatSurvey;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Story 21 (WIS-25) — realistic ticket seed data.
 *
 * Replaces the 60 `Ticket::factory()` filler rows the DatabaseSeeder used to
 * create. Every ticket here is one row of data/ticket-schedule.php, pointing
 * at one authored scenario in data/ticket-scenarios.php, with a thread built
 * from data/ticket-message-templates.php.
 *
 * Three properties this file exists to guarantee:
 *  - Age follows status. A running ticket is HOURS old; a finished one is
 *    DAYS old. A 30-day-old Open ticket is a breached ticket, not a realistic
 *    one — see the plan's Decision 4.
 *  - Every ticket is CREATED with its final status. Nothing here transitions a
 *    ticket, so TicketResolutionObserver never mints a survey behind our back
 *    and no `status_changed` history row is written dated today.
 *  - SlaClock::applyTo() runs AFTER created_at is backdated, because it
 *    anchors every target on created_at.
 *
 * Deliberately seeded: two Open tickets with zero messages (the empty state,
 * schedule rows A-19/A-20), two tickets whose SLA was missed on close (C-07,
 * D-09), one 36-message thread (D-01 — the message index cursor-paginates at
 * 30), two multi-channel threads (C-01, D-10) and four internal notes.
 *
 * FRESH-INSTALL ONLY. Like DatabaseSeeder above it, this uses create() not
 * updateOrCreate(); the supported command is `php artisan migrate:fresh --seed`.
 */
class TicketScenarioSeeder extends Seeder
{
    /** Schedule indices (0-based) that carry one extra internal-note turn. */
    private const INTERNAL_NOTE_INDICES = [8, 27, 33, 48]; // A-09, B-08, C-02, D-03

    // D-01 (schedule index 46) carries turns:36 — the only thread longer than
    // TicketMessageController's cursorPaginate(30). Handled generically by the
    // resolved/closed turn planner; no special index needed here.

    private const MIXED_CHANNEL_WHATSAPP_TICKET = 32;       // C-01: one agent turn on Email

    private const MIXED_CHANNEL_EMAIL_TICKET = 55;          // D-10: one customer turn on WhatsApp

    /** First 12 Block C/D rows in schedule order — 6 from C, 6 from D. */
    private const CSAT_INDICES = [32, 33, 34, 35, 36, 37, 46, 47, 48, 49, 50, 51];

    /** Per-role running counter, so consecutive tickets do not repeat a variant. */
    private array $counters = [];

    public function run(): void
    {
        mt_srand(20250909);
        fake()->seed(20250909);

        $agents = [
            'agent1' => User::where('email', 'agent@wisal.test')->first(),
            'agent2' => User::where('email', 'agent2@wisal.test')->first(),
        ];

        if ($agents['agent1'] === null || $agents['agent2'] === null) {
            $this->command?->warn('TicketScenarioSeeder: seeded agents not found — skipping.');

            return;
        }

        $customers = Customer::query()->orderBy('id')->get();

        if ($customers->isEmpty()) {
            $this->command?->warn('TicketScenarioSeeder: no customers to attach tickets to — skipping.');

            return;
        }

        $scenarios = collect(require __DIR__.'/data/ticket-scenarios.php')->keyBy('key');
        $templates = require __DIR__.'/data/ticket-message-templates.php';
        $schedule = require __DIR__.'/data/ticket-schedule.php';

        $clock = app(SlaClock::class);

        /** @var array<int, Ticket> $csatTickets keyed by CSAT_INDICES position */
        $csatTickets = [];

        foreach ($schedule as $index => $row) {
            $scenario = $scenarios[$row['key']];
            $agent = $agents[$row['assignee']] ?? null;

            $pool = $index < 32 ? $customers->take(10)->values() : $customers->values();
            $customer = $pool[$index % $pool->count()];

            $ticket = $this->seedTicket($index, $row, $scenario, $templates, $agent, $customer, $clock);

            $csatPos = array_search($index, self::CSAT_INDICES, true);
            if ($csatPos !== false) {
                $csatTickets[$csatPos] = $ticket;
            }
        }

        $this->seedCsat($csatTickets);
    }

    private function seedTicket(
        int $index,
        array $row,
        array $scenario,
        array $templates,
        ?User $agent,
        Customer $customer,
        SlaClock $clock,
    ): Ticket {
        $lang = $scenario['lang'];
        $age = $row['age'];
        $isFinished = in_array($row['status'], ['resolved', 'closed'], true);

        // (a) — the real creation moment.
        if (isset($age['hours'])) {
            $createdAt = Carbon::now()->subHours($age['hours'])->subSeconds(mt_rand(0, 59));
            $resolvedAt = null;
            $closedAt = null;
        } else {
            $createdAt = Carbon::now()->subDays($age['days'])->setTime(mt_rand(8, 17), mt_rand(0, 59), mt_rand(0, 59));
            $resolvedAt = $isFinished ? $createdAt->copy()->addHours($age['resolve_hours']) : null;
            $closedAt = $row['status'] === 'closed' ? $resolvedAt->copy()->addDays($age['close_days']) : null;
        }

        // (b) — created with its FINAL status, in one create().
        $ticket = Ticket::create([
            'subject' => $scenario['subject_'.$lang],
            'description' => $scenario['opening_'.$lang],
            'customer_id' => $customer->id,
            'status' => $row['status'],
            'priority' => $row['priority'],
            'category' => $scenario['category'],
            'channel' => $row['channel'],
            'assigned_to' => $agent?->id,
            'created_by' => $agent?->id,
            'resolved_at' => $resolvedAt,
            'closed_at' => $closedAt,
        ]);

        // (c) — backdate. created_at is not fillable, so forceFill.
        $ticket->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();

        // (g, part 1) — repair the `created` event the observer dated to now().
        TicketEvent::query()
            ->where('ticket_id', $ticket->id)
            ->where('event', 'created')
            ->update(['created_at' => $createdAt]);

        // (d) — the thread.
        $messages = $this->seedThread($index, $ticket, $row, $scenario, $templates, $agent, $createdAt, $resolvedAt);

        // (e) — updated_at tracks the last message.
        if ($messages !== []) {
            $ticket->forceFill(['updated_at' => end($messages)->created_at])->save();
        }

        // (f) — SLA, AFTER the backdate. applyTo anchors on created_at.
        $clock->applyTo($ticket);

        $firstAgentMessage = null;
        foreach ($messages as $message) {
            if ($message->author_type === TicketMessage::AUTHOR_AGENT
                && $message->visibility === MessageVisibility::Public) {
                $firstAgentMessage = $message;
                break;
            }
        }
        if ($firstAgentMessage !== null) {
            $clock->markFirstResponse($ticket, $firstAgentMessage->created_at);
        }

        if ($row['status'] === 'pending') {
            $clock->pause($ticket, $messages !== [] ? end($messages)->created_at : $createdAt);
        }

        $ticket->save();

        // (g, part 2) — the status history a finished ticket would really have.
        if ($isFinished) {
            TicketEvent::create([
                'ticket_id' => $ticket->id,
                'user_id' => $agent?->id,
                'event' => 'status_changed',
                'field' => 'status',
                'old_value' => 'open',
                'new_value' => 'resolved',
                'created_at' => $resolvedAt,
            ]);

            if ($row['status'] === 'closed') {
                TicketEvent::create([
                    'ticket_id' => $ticket->id,
                    'user_id' => $agent?->id,
                    'event' => 'status_changed',
                    'field' => 'status',
                    'old_value' => 'resolved',
                    'new_value' => 'closed',
                    'created_at' => $closedAt,
                ]);
            }
        }

        return $ticket->refresh();
    }

    /**
     * @return array<int, TicketMessage> chronological order
     */
    private function seedThread(
        int $index,
        Ticket $ticket,
        array $row,
        array $scenario,
        array $templates,
        ?User $agent,
        Carbon $createdAt,
        ?Carbon $resolvedAt,
    ): array {
        $turns = $row['turns'];

        if ($turns === 0) {
            return []; // A-19 / A-20 — the deliberate empty state.
        }

        $hasInternalNote = in_array($index, self::INTERNAL_NOTE_INDICES, true);

        $plan = $this->turnPlan($row['status'], $row['assignee'], $hasInternalNote ? $turns - 1 : $turns);

        if ($hasInternalNote) {
            $pos = max(1, count($plan) - 1); // second-to-last
            array_splice($plan, $pos, 0, [['agent', 'internal_note']]);
        }

        // The two deliberate multi-channel threads.
        $channelOverrides = [];
        if ($index === self::MIXED_CHANNEL_WHATSAPP_TICKET) {
            foreach ($plan as $k => $turn) {
                if ($turn[0] === 'agent') {
                    $channelOverrides[$k] = Channel::Email;
                    break;
                }
            }
        }
        if ($index === self::MIXED_CHANNEL_EMAIL_TICKET) {
            foreach ($plan as $k => $turn) {
                if ($k > 0 && $turn[0] === 'customer') {
                    $channelOverrides[$k] = Channel::Whatsapp;
                    break;
                }
            }
        }

        $times = $this->messageTimes($plan, $row['status'], $createdAt, $resolvedAt);

        $lang = $scenario['lang'];
        $ticketChannel = $ticket->channel;
        $messages = [];

        foreach ($plan as $k => [$author, $role]) {
            $isAgent = $author === 'agent';
            $visibility = $role === 'internal_note' ? MessageVisibility::Internal : MessageVisibility::Public;

            $body = $role === 'opening'
                ? $scenario['opening_'.$lang]
                : $this->body($templates, $role, $scenario['category'], $lang);

            $messages[] = $this->writeMessage(
                $ticket,
                $isAgent ? TicketMessage::AUTHOR_AGENT : TicketMessage::AUTHOR_CUSTOMER,
                $agent,
                $channelOverrides[$k] ?? $ticketChannel,
                $body,
                $times[$k],
                $visibility,
            );
        }

        return $messages;
    }

    /**
     * An ordered list of [author, roleKey] pairs of exactly `$turns` entries
     * (a truncation that would land on the wrong author is corrected in place).
     *
     * @return array<int, array{0: string, 1: string}>
     */
    private function turnPlan(string $status, ?string $assignee, int $turns): array
    {
        if ($status === 'open' && $assignee === null) {
            // Nobody has picked it up — never an agent turn.
            $plan = [['customer', 'opening']];
            if ($turns >= 2) {
                $plan[] = ['customer', 'customer_chase'];
            }

            return $plan;
        }

        if ($status === 'open') {
            $plan = [['customer', 'opening'], ['agent', 'agent_ack']];
            while (count($plan) < $turns) {
                $plan[] = count($plan) % 2 === 0
                    ? ['agent', 'agent_question']
                    : ['customer', 'customer_followup'];
            }
            if (end($plan)[0] === 'agent') {
                $plan[count($plan) - 1] = ['customer', 'customer_followup']; // must end on the customer
            }

            return $plan;
        }

        if ($status === 'pending') {
            $plan = [['customer', 'opening'], ['agent', 'agent_ack']];
            while (count($plan) < $turns - 1) {
                $plan[] = count($plan) % 2 === 0
                    ? ['customer', 'customer_followup']
                    : ['agent', 'agent_update'];
            }
            $plan[] = ['agent', 'agent_pending']; // must end on the agent asking

            return $plan;
        }

        // resolved / closed
        $wantThanks = $turns % 2 === 0;
        $middleAgentRole = $turns >= 12 ? 'agent_update' : 'agent_question';
        $plan = [['customer', 'opening'], ['agent', 'agent_ack']];
        $target = $wantThanks ? $turns - 1 : $turns;
        while (count($plan) < $target - 1) {
            $plan[] = count($plan) % 2 === 0
                ? ['agent', $middleAgentRole]
                : ['customer', 'customer_followup'];
        }
        $plan[] = ['agent', 'agent_resolution']; // the last agent message
        if ($wantThanks) {
            $plan[] = ['customer', 'customer_thanks'];
        }

        return $plan;
    }

    /**
     * @param  array<int, array{0: string, 1: string}>  $plan
     * @return array<int, Carbon>
     */
    private function messageTimes(array $plan, string $status, Carbon $createdAt, ?Carbon $resolvedAt): array
    {
        $count = count($plan);

        if ($status === 'open' || $status === 'pending') {
            $times = [$createdAt->copy()];
            $cursor = $createdAt->copy();
            for ($i = 1; $i < $count; $i++) {
                $cursor = $cursor->copy()->addMinutes(mt_rand(12, 95));
                $times[] = $cursor->copy();
            }

            $now = Carbon::now();
            if ($times[$count - 1]->greaterThan($now)) {
                $needed = max(1, $createdAt->diffInSeconds($times[$count - 1]));
                $room = $createdAt->diffInSeconds($now) * 0.95;
                $factor = $room / $needed;
                for ($i = 1; $i < $count; $i++) {
                    $offset = (int) round($createdAt->diffInSeconds($times[$i]) * $factor);
                    $times[$i] = $createdAt->copy()->addSeconds(max($i, $offset));
                }
            }

            return $times;
        }

        // finished: distribute across created_at -> resolved_at, resolution lands exactly on resolved_at.
        $resIdx = null;
        $thanksIdx = null;
        foreach ($plan as $k => [$author, $role]) {
            if ($role === 'agent_resolution') {
                $resIdx = $k;
            }
            if ($role === 'customer_thanks') {
                $thanksIdx = $k;
            }
        }
        $resIdx ??= $count - 1;

        $totalSec = max(1, $createdAt->diffInSeconds($resolvedAt));
        $times = array_fill(0, $count, null);
        $times[0] = $createdAt->copy();

        for ($i = 1; $i < $resIdx; $i++) {
            $base = (int) round($totalSec * $i / $resIdx);
            $jitter = (int) round($totalSec / $resIdx * 0.2);
            $offset = $base + mt_rand(-$jitter, $jitter);
            $times[$i] = $createdAt->copy()->addSeconds(max($i, $offset));
        }
        for ($i = 1; $i < $resIdx; $i++) {
            if ($times[$i]->lessThanOrEqualTo($times[$i - 1])) {
                $times[$i] = $times[$i - 1]->copy()->addMinutes(1);
            }
        }
        if ($resIdx > 0 && $times[$resIdx - 1]->greaterThanOrEqualTo($resolvedAt)) {
            $times[$resIdx - 1] = $resolvedAt->copy()->subMinutes(1);
        }
        $times[$resIdx] = $resolvedAt->copy();

        for ($i = $resIdx + 1; $i < $count; $i++) {
            $times[$i] = $resolvedAt->copy()->addMinutes(mt_rand(30, 240));
        }
        if ($thanksIdx !== null) {
            $times[$thanksIdx] = $resolvedAt->copy()->addMinutes(mt_rand(30, 240));
        }

        return $times;
    }

    private function body(array $templates, string $role, string $category, string $lang): string
    {
        $list = in_array($role, ['agent_question', 'agent_resolution'], true)
            ? $templates[$role][$category][$lang]
            : $templates[$role][$lang];

        $n = $this->counters[$role] ?? 0;
        $this->counters[$role] = $n + 1;

        return $list[$n % count($list)];
    }

    private function writeMessage(
        Ticket $ticket,
        string $authorType,
        ?User $agent,
        Channel $channel,
        string $body,
        Carbon $at,
        MessageVisibility $visibility = MessageVisibility::Public,
    ): TicketMessage {
        $message = TicketMessage::create([
            'ticket_id' => $ticket->id,
            'author_type' => $authorType,
            'user_id' => $authorType === TicketMessage::AUTHOR_AGENT ? $agent?->id : null,
            'customer_id' => $authorType === TicketMessage::AUTHOR_CUSTOMER ? $ticket->customer_id : null,
            'channel' => $channel->value,
            'body' => $body,
            'visibility' => $visibility->value,
        ]);

        // created_at is not fillable on TicketMessage; stamp it after insert.
        $message->forceFill(['created_at' => $at, 'updated_at' => $at])->save();

        return $message;
    }

    /**
     * @param  array<int, Ticket>  $csatTickets  keyed by CSAT_INDICES position
     */
    private function seedCsat(array $csatTickets): void
    {
        // Reports CSAT average lands at a plausible 4.2; every star bucket is
        // populated; index 10 is the one deliberately outstanding survey.
        $ratings = [5, 4, 5, 3, 4, 5, 2, 4, 5, 4, null, 5];

        $comments = [
            0 => 'Fixed on the same day and explained clearly. No complaints.',
            3 => 'تمت المعالجة بسرعة والشرح كان واضحًا.',
            6 => 'Took a couple of rounds but got there in the end.',
            9 => 'Clear communication the whole way through. Happy with how it was handled.',
        ];

        ksort($csatTickets);

        foreach ($csatTickets as $pos => $ticket) {
            $rating = $ratings[$pos] ?? null;

            CsatSurvey::create([
                'ticket_id' => $ticket->id,
                'resolution_cycle' => 1,
                'resolved_by' => $ticket->assigned_to,
                'resolved_at' => $ticket->resolved_at,
                'rating' => $rating,
                'comment' => $comments[$pos] ?? null,
                'responded_at' => $rating === null
                    ? null
                    : $ticket->resolved_at->copy()->addHours(mt_rand(3, 72)),
                'expires_at' => $ticket->resolved_at->copy()->addDays(30),
            ]);
        }
    }
}
