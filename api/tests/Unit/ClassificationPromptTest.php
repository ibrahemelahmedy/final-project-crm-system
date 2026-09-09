<?php

use App\Models\Customer;
use App\Models\Ticket;
use App\Services\Ai\ClassificationPrompt;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/** Story 24 (WIS-23), Test Plan D. */
it('names all five categories and all four priorities in the system prompt', function () {
    $ticket = Ticket::factory()->create();
    [$system] = app(ClassificationPrompt::class)->forTicket($ticket);

    foreach (['general', 'billing', 'technical', 'account', 'feature_request'] as $c) {
        expect($system)->toContain($c);
    }
    foreach (['low', 'normal', 'high', 'urgent'] as $p) {
        expect($system)->toContain($p);
    }
});

it('clamps the description to ai.classify.max_chars', function () {
    config(['ai.classify.max_chars' => 50]);
    $ticket = Ticket::factory()->create(['description' => str_repeat('x', 500)]);

    [, $prompt] = app(ClassificationPrompt::class)->forTicket($ticket);

    expect(strlen($prompt))->toBeLessThan(200);
});

it('renders (no description provided) for an empty description', function () {
    $ticket = Ticket::factory()->create(['description' => '']);
    [, $prompt] = app(ClassificationPrompt::class)->forTicket($ticket);

    expect($prompt)->toContain('(no description provided)');
});

it('carries the subject, channel value and customer tier', function () {
    $customer = Customer::factory()->create(['tier' => 'premium']);
    $ticket = Ticket::factory()->create([
        'subject' => 'Totally unique subject',
        'channel' => 'chat',
        'customer_id' => $customer->id,
    ]);

    [, $prompt] = app(ClassificationPrompt::class)->forTicket($ticket);

    expect($prompt)->toContain('Totally unique subject')
        ->and($prompt)->toContain('chat')
        ->and($prompt)->toContain('premium');
});
