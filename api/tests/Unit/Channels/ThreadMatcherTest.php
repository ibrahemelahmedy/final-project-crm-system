<?php

use App\Enums\Channel;
use App\Models\Customer;
use App\Models\Ticket;
use App\Services\Channels\InboundMessage;
use App\Services\Channels\ThreadMatcher;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

/** Story 26 (WIS-22), Test Plan §P — the window boundary and closed-status exclusion, no HTTP. */
uses(RefreshDatabase::class);

function whatsappMessageFrom(string $phone): InboundMessage
{
    return new InboundMessage(
        providerMessageId: 'x-'.uniqid(),
        channel: Channel::Whatsapp,
        fromEmail: null,
        fromPhone: $phone,
        fromName: null,
        subject: '',
        body: 'hello',
        threadRefs: [],
        hadAttachment: false,
        occurredAt: CarbonImmutable::now(),
    );
}

it('matches a ticket exactly at the thread_window_hours boundary', function () {
    config(['channels.inbound.thread_window_hours' => 72]);
    $now = CarbonImmutable::now();
    CarbonImmutable::setTestNow($now);
    Carbon::setTestNow($now);

    $customer = Customer::factory()->create(['phone' => '+15005550006']);
    $ticket = Ticket::factory()->create([
        'customer_id' => $customer->id,
        'channel' => Channel::Whatsapp->value,
        'status' => 'open',
        'updated_at' => $now->subHours(72),
    ]);

    $match = (new ThreadMatcher)->match(whatsappMessageFrom('+15005550006'), $customer);

    expect($match?->id)->toBe($ticket->id);

    CarbonImmutable::setTestNow();
    Carbon::setTestNow();
});

it('does not match a ticket one second past the thread_window_hours boundary', function () {
    config(['channels.inbound.thread_window_hours' => 72]);
    $now = CarbonImmutable::now();
    CarbonImmutable::setTestNow($now);
    Carbon::setTestNow($now);

    $customer = Customer::factory()->create(['phone' => '+15005550006']);
    Ticket::factory()->create([
        'customer_id' => $customer->id,
        'channel' => Channel::Whatsapp->value,
        'status' => 'open',
        'updated_at' => $now->subHours(72)->subSecond(),
    ]);

    $match = (new ThreadMatcher)->match(whatsappMessageFrom('+15005550006'), $customer);

    expect($match)->toBeNull();

    CarbonImmutable::setTestNow();
    Carbon::setTestNow();
});

it('excludes a Closed ticket even inside the window', function () {
    $customer = Customer::factory()->create(['phone' => '+15005550006']);
    Ticket::factory()->create([
        'customer_id' => $customer->id,
        'channel' => Channel::Whatsapp->value,
        'status' => 'closed',
        'updated_at' => now(),
    ]);

    $match = (new ThreadMatcher)->match(whatsappMessageFrom('+15005550006'), $customer);

    expect($match)->toBeNull();
});

it('returns null unconditionally when the customer is null', function () {
    $match = (new ThreadMatcher)->match(whatsappMessageFrom('+15005550006'), null);

    expect($match)->toBeNull();
});
