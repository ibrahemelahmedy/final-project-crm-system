<?php

use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use App\Services\Ai\AssistTranscript;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->transcript = new AssistTranscript;
    $this->agent = User::factory()->create();
    $this->customer = Customer::factory()->create();
});

it('takes the newest-N window from the recent end and re-sorts it ascending', function () {
    config(['ai.transcript_messages' => 2]);
    $ticket = Ticket::factory()->create();

    TicketMessage::factory()->for($ticket)->create(['body' => 'oldest']);
    TicketMessage::factory()->for($ticket)->create(['body' => 'middle']);
    TicketMessage::factory()->for($ticket)->create(['body' => 'newest']);

    [, $prompt] = $this->transcript->forSummary($ticket, 'en');

    expect($prompt)->not->toContain('oldest');
    expect($prompt)->toContain('middle');
    expect($prompt)->toContain('newest');
    // Chronological order preserved: "middle" appears before "newest".
    expect(strpos($prompt, 'middle'))->toBeLessThan(strpos($prompt, 'newest'));
});

it('clamps each message body at transcript_chars', function () {
    config(['ai.transcript_chars' => 20]);
    $ticket = Ticket::factory()->create();
    TicketMessage::factory()->for($ticket)->create(['body' => str_repeat('a', 100)]);

    [, $prompt] = $this->transcript->forSummary($ticket, 'en');

    // Str::limit appends a trailing marker, so assert the clamp happened
    // rather than an exact length.
    expect($prompt)->not->toContain(str_repeat('a', 100));
});

it('adds the Arabic instruction to the system prompt only when the locale is ar', function () {
    $ticket = Ticket::factory()->create();
    TicketMessage::factory()->for($ticket)->create();

    [$systemEn] = $this->transcript->forSummary($ticket, 'en');
    [$systemAr] = $this->transcript->forSummary($ticket, 'ar');

    expect($systemEn)->not->toContain('Arabic');
    expect($systemAr)->toContain('Write the summary in Arabic.');

    [$replySystemAr] = $this->transcript->forReply($ticket, 'ar');
    expect($replySystemAr)->toContain('Write the reply in Arabic.');
});

it('exposes the newest included message id via lastMessageId()', function () {
    $ticket = Ticket::factory()->create();
    TicketMessage::factory()->for($ticket)->create();
    $last = TicketMessage::factory()->for($ticket)->create();

    $this->transcript->forSummary($ticket, 'en');

    expect($this->transcript->lastMessageId())->toBe($last->id);
});

it('returns null from lastMessageId() when the ticket has no messages', function () {
    $ticket = Ticket::factory()->create();

    $this->transcript->forReply($ticket, 'en');

    expect($this->transcript->lastMessageId())->toBeNull();
});
