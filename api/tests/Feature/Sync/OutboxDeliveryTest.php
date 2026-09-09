<?php

use App\Enums\OutboxStatus;
use App\Enums\UserRole;
use App\Models\Integration;
use App\Models\IntegrationOutboxMessage;
use App\Models\SyncRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['integrations.sync.enabled' => true]);
    bindOutboundUrlGuard(true);
});

it('retries five 500s honouring the configured backoff, then dead-letters', function () {
    $integration = Integration::factory()->outbound()->create();
    $message = IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fakeSequence()->push('', 500)->push('', 500)->push('', 500)->push('', 500)->push('', 500);

    $backoff = config('integrations.sync.outbound.backoff');

    foreach (range(1, 5) as $n) {
        Artisan::call('sync:flush-outbox');
        $message->refresh();

        if ($n < 5) {
            expect($message->status)->toBe(OutboxStatus::Pending);
            expect($message->attempts)->toBe($n);
            $expected = now()->addSeconds($backoff[$n - 1]);
            expect($message->next_attempt_at->diffInSeconds($expected))->toBeLessThan(5);
            $this->travelTo(now()->addSeconds($backoff[$n - 1] + 1));
        } else {
            expect($message->status)->toBe(OutboxStatus::Dead);
            expect($message->failed_at)->not->toBeNull();
            expect($message->last_error_key)->toBe('integrations.sync.error.max_attempts');
        }
    }
});

it('delivers on the second attempt after one 500', function () {
    $integration = Integration::factory()->outbound()->create();
    $message = IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fakeSequence()->push('', 500)->push(['ok' => true], 200);

    Artisan::call('sync:flush-outbox');
    $message->refresh();
    expect($message->status)->toBe(OutboxStatus::Pending);

    $this->travelTo(now()->addMinutes(2));
    Artisan::call('sync:flush-outbox');
    $message->refresh();

    expect($message->status)->toBe(OutboxStatus::Delivered);
    expect($message->delivered_at)->not->toBeNull();
    expect($message->last_error_key)->toBeNull();
});

it('dead-letters a 400 immediately as rejected', function () {
    $integration = Integration::factory()->outbound()->create();
    $message = IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fake(['*' => Http::response('', 400)]);

    Artisan::call('sync:flush-outbox');
    $message->refresh();

    expect($message->status)->toBe(OutboxStatus::Dead);
    expect($message->attempts)->toBe(1);
    expect($message->last_error_key)->toBe('integrations.sync.error.rejected');
});

it('dead-letters a 301 immediately — no redirect followed', function () {
    $integration = Integration::factory()->outbound()->create();
    $message = IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fake(['*' => Http::response('', 301, ['Location' => 'https://example.com/elsewhere'])]);

    Artisan::call('sync:flush-outbox');
    $message->refresh();

    expect($message->status)->toBe(OutboxStatus::Dead);
    Http::assertSentCount(1);
});

it('treats a 429 as retryable', function () {
    $integration = Integration::factory()->outbound()->create();
    $message = IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fake(['*' => Http::response('', 429)]);

    Artisan::call('sync:flush-outbox');
    $message->refresh();

    expect($message->status)->toBe(OutboxStatus::Pending);
    expect($message->attempts)->toBe(1);
});

it('treats a connection exception as retryable and stores no exception message anywhere', function () {
    $integration = Integration::factory()->outbound()->create();
    $message = IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fake(function () {
        throw new ConnectionException('simulated DNS failure with a secret token abc123');
    });

    Artisan::call('sync:flush-outbox');
    $message->refresh();

    expect($message->status)->toBe(OutboxStatus::Pending);
    expect($message->last_error_key)->toBe('integrations.sync.error.unreachable');
    expect($message->last_error_key)->not->toContain('secret');
    expect($message->getAttributes())->not->toHaveKey('message');
});

it('does not pick up a message whose next_attempt_at is in the future', function () {
    $integration = Integration::factory()->outbound()->create();
    IntegrationOutboxMessage::factory()->for($integration)->notDue()->create();

    Http::fake();

    Artisan::call('sync:flush-outbox');

    Http::assertNothingSent();
});

it('signs the POST with the event headers and a verifying HMAC', function () {
    $integration = Integration::factory()->outbound()->create();
    $message = IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    Artisan::call('sync:flush-outbox');

    Http::assertSent(function ($request) use ($message, $integration) {
        $body = $request->body();
        $expectedSignature = 'sha256='.hash_hmac('sha256', $body, $integration->secret);

        return $request->hasHeader('X-Wisal-Event', $message->event->value)
            && $request->hasHeader('X-Wisal-Event-Id', $message->event_id)
            && $request->hasHeader('Authorization', 'Bearer '.$integration->secret)
            && $request->header('X-Wisal-Signature')[0] === $expectedSignature;
    });
});

it('creates no SyncRun when the outbox is empty', function () {
    Http::fake();

    Artisan::call('sync:flush-outbox');

    expect(SyncRun::count())->toBe(0);
});

it('a drain of 3 messages (2 delivered, 1 deferred) records one outbound SyncRun', function () {
    $integration = Integration::factory()->outbound()->create();
    IntegrationOutboxMessage::factory()->for($integration)->create();
    IntegrationOutboxMessage::factory()->for($integration)->create();
    IntegrationOutboxMessage::factory()->for($integration)->create();

    Http::fakeSequence()
        ->push(['ok' => true], 200)
        ->push(['ok' => true], 200)
        ->push('', 500);

    Artisan::call('sync:flush-outbox');

    $run = SyncRun::where('direction', 'outbound')->first();
    expect($run->records_read)->toBe(3);
    expect($run->records_created)->toBe(2);
    expect($run->records_skipped)->toBe(1);
    expect($run->records_failed)->toBe(0);
});

it('POST /outbox/retry resets dead rows to pending and returns requeued', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $integration = Integration::factory()->outbound()->create();
    IntegrationOutboxMessage::factory()->for($integration)->dead()->count(3)->create();

    $response = $this->asUser($admin)->postJson('/api/admin/integrations/erp/outbox/retry')->assertOk();

    expect($response->json('requeued'))->toBe(3);
    expect(IntegrationOutboxMessage::where('status', 'pending')->where('attempts', 0)->count())->toBe(3);
});
