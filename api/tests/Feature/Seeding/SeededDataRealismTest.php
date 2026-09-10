<?php

use App\Enums\CsatSurveyState;
use App\Enums\TicketStatus;
use App\Models\ChannelConnection;
use App\Models\ChannelInboundMessage;
use App\Models\ChannelOutboundMessage;
use App\Models\ChatSession;
use App\Models\CsatSurvey;
use App\Models\Integration;
use App\Models\IntegrationOutboxMessage;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use App\Models\User;
use App\Services\SlaClock;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

// The first (and only) test in the repo that runs the real seeder. Slow by
// design — kept to one file.
beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
});

it('performs zero outbound requests and writes zero outbox rows (WIS-24)', function () {
    // The seeder ran in beforeEach above. No integration is ever seeded
    // (IntegrationFactory's docblock), so IntegrationEvents::record() returns
    // after one query regardless of the INTEGRATION_SYNC_ENABLED flag — proven
    // here by the row counts, not by trusting the reasoning (WIS-27/WIS-23
    // both ran this same class of check).
    expect(Integration::count())->toBe(0);
    expect(IntegrationOutboxMessage::count())->toBe(0);
});

it('re-seeding with the sync flag explicitly ON still sends nothing (no integration row to enqueue against)', function () {
    config(['integrations.sync.enabled' => true]);
    Http::fake();

    Ticket::factory()->create(); // fires the same Ticket::created observer the seeder's tickets do

    expect(IntegrationOutboxMessage::count())->toBe(0);
    Http::assertNothingSent();
});

it('seeds exactly 64 tickets with the designed status mix', function () {
    expect(Ticket::count())->toBe(64);
    expect(Ticket::where('status', TicketStatus::Open)->count())->toBe(20);
    expect(Ticket::where('status', TicketStatus::Pending)->count())->toBe(12);
    expect(Ticket::where('status', TicketStatus::Resolved)->count())->toBe(14);
    expect(Ticket::where('status', TicketStatus::Closed)->count())->toBe(18);
});

it('seeds no lorem-ipsum subject or body', function () {
    $stems = ['ipsum', 'dolor', 'voluptas', 'quia', 'accusantium', 'laudantium', 'eveniet', 'inventore', 'sunt', 'nemo'];

    foreach ($stems as $stem) {
        expect(Ticket::where('subject', 'like', "%{$stem}%")->count())->toBe(0);
        expect(Ticket::where('description', 'like', "%{$stem}%")->count())->toBe(0);
        expect(TicketMessage::where('body', 'like', "%{$stem}%")->count())->toBe(0);
    }
});

it('gives every closed ticket a resolving agent message and every open ticket a customer last message', function () {
    foreach (Ticket::whereIn('status', [TicketStatus::Resolved, TicketStatus::Closed])->get() as $ticket) {
        expect($ticket->resolved_at)->not->toBeNull();
        expect($ticket->messages()->where('author_type', TicketMessage::AUTHOR_AGENT)->count())
            ->toBeGreaterThan(0);
    }

    $emptyOpen = 0;
    foreach (Ticket::where('status', TicketStatus::Open)->get() as $ticket) {
        $last = $ticket->messages()->reorder('id', 'desc')->first();
        if ($last === null) {
            $emptyOpen++;

            continue;
        }
        expect($last->author_type)->toBe(TicketMessage::AUTHOR_CUSTOMER);
    }
    expect($emptyOpen)->toBe(2);

    foreach (Ticket::where('status', TicketStatus::Pending)->get() as $ticket) {
        $last = $ticket->messages()->reorder('id', 'desc')->first();
        expect($last)->not->toBeNull();
        expect($last->author_type)->toBe(TicketMessage::AUTHOR_AGENT);
    }
});

it('recomputes SLA targets from the real created date', function () {
    $expected = ['urgent' => 240, 'high' => 480, 'normal' => 1440, 'low' => 7200];

    foreach ($expected as $priority => $minutes) {
        $ticket = Ticket::where('priority', $priority)->whereNotNull('resolution_due_at')->first();
        expect($ticket)->not->toBeNull();
        $diff = (int) round($ticket->created_at->diffInMinutes($ticket->resolution_due_at, absolute: true));
        expect($diff)->toBe($minutes + (int) $ticket->sla_paused_minutes);
    }

    $clock = app(SlaClock::class);

    $openVerdicts = Ticket::where('status', TicketStatus::Open)->get()
        ->groupBy(fn (Ticket $t) => $clock->riskFor($t) ?? 'null')->map->count();
    expect($openVerdicts['breached'] ?? 0)->toBe(3);
    expect($openVerdicts['at_risk'] ?? 0)->toBe(3);

    $finishedBreached = Ticket::whereIn('status', [TicketStatus::Resolved, TicketStatus::Closed])->get()
        ->filter(fn (Ticket $t) => $clock->riskFor($t) === 'breached')->count();
    expect($finishedBreached)->toBe(2);
});

it('seeds CSAT only on resolved or closed tickets', function () {
    expect(CsatSurvey::count())->toBe(12);

    $nullRating = 0;
    foreach (CsatSurvey::with('ticket')->get() as $survey) {
        expect(in_array($survey->ticket->status, [TicketStatus::Resolved, TicketStatus::Closed], true))->toBeTrue();
        expect($survey->ticket->resolved_at)->not->toBeNull();
        expect($survey->resolved_by)->not->toBeNull();

        if ($survey->rating === null) {
            $nullRating++;
            expect($survey->state)->toBe(CsatSurveyState::Outstanding);
        }
    }
    expect($nullRating)->toBe(1);
});

it('spreads ticket and message timestamps across six weeks', function () {
    expect(Ticket::min('created_at'))->toBeLessThan(now()->subDays(40)->toDateTimeString());
    expect(Ticket::max('created_at'))->toBeGreaterThan(now()->subHours(2)->toDateTimeString());

    $distinctDays = (int) Ticket::query()->selectRaw('count(distinct date(created_at)) as d')->value('d');
    expect($distinctDays)->toBeGreaterThanOrEqual(25);

    expect(TicketMessage::where('created_at', '>', now())->count())->toBe(0);
    expect(TicketMessage::min('created_at'))->toBeLessThan(now()->subDays(40)->toDateTimeString());
});

it('matches the channels overview counts', function () {
    $admin = User::where('email', 'admin@wisal.test')->firstOrFail();

    $response = $this->asUser($admin)->getJson('/api/channels/overview?period=90d');
    $response->assertOk();

    $expected = ['email' => 30, 'chat' => 14, 'web_form' => 9, 'whatsapp' => 8, 'sms' => 3];

    foreach ($response->json('data') as $card) {
        expect($card['ticket_count'])->toBe(Ticket::where('channel', $card['value'])->count());
        if (isset($expected[$card['value']])) {
            expect($card['ticket_count'])->toBe($expected[$card['value']]);
        }
    }

    expect($response->json('meta.total_tickets'))->toBe(64);
});

it('keeps one thread longer than the message page size', function () {
    $longest = Ticket::withCount('messages')->orderByDesc('messages_count')->first();
    expect($longest->messages_count)->toBeGreaterThan(30);

    $admin = User::where('email', 'admin@wisal.test')->firstOrFail();
    $response = $this->asUser($admin)->getJson("/api/tickets/{$longest->id}/messages");
    $response->assertOk();
    expect($response->json('meta.next_cursor'))->not->toBeNull();
});

it("dates the created history event to the ticket's creation", function () {
    $oldest = Ticket::orderBy('created_at')->first();

    $event = TicketEvent::where('ticket_id', $oldest->id)->where('event', 'created')->first();
    expect($event)->not->toBeNull();
    expect($event->created_at->timestamp)->toBe($oldest->created_at->timestamp);
});

it('seeds internal notes and multi-channel threads', function () {
    expect(TicketMessage::where('visibility', 'internal')->count())->toBe(4);

    $mixed = Ticket::query()->get()->filter(function (Ticket $ticket) {
        return $ticket->messages()
            ->where('channel', '!=', $ticket->channel->value)
            ->exists();
    });
    expect($mixed->count())->toBeGreaterThanOrEqual(2);
});

// Story 24 (WIS-23), Edge Case 1. migrate:fresh --seed must fire ZERO
// provider calls: the console guard skips it, and even here the terminating
// callback the observer would register never runs during $this->seed().
it('performs zero AI classifications during seeding', function () {
    // The seeder already ran in beforeEach with the real config (a live Groq
    // key is in api/.env). If the console guard in TicketClassificationObserver
    // had let a single terminate through, a ticket row would carry
    // ai_classified_at — none does.
    expect(Ticket::whereNotNull('ai_classified_at')->count())->toBe(0)
        ->and(Ticket::where('needs_triage', true)->count())->toBe(0);
});

// Story 26 (WIS-22), Edge Case 23. migrate:fresh --seed must leave every new
// channel table at zero rows — a seeded connection would show a fabricated
// CONNECTED card on a fresh install (ChannelConnectionFactory's docblock).
it('leaves every channel table at zero rows after seeding', function () {
    expect(ChannelConnection::count())->toBe(0);
    expect(ChannelInboundMessage::count())->toBe(0);
    expect(ChannelOutboundMessage::count())->toBe(0);
    expect(ChatSession::count())->toBe(0);
});
