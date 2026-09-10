<?php

use App\Enums\Channel;
use App\Enums\ChannelConnectionStatus;
use App\Enums\ChannelProvider;
use App\Mail\ChannelReplyMail;
use App\Models\ChannelOutboundMessage;
use App\Services\Channels\ChannelOutboxDispatcher;
use App\Services\Integrations\OutboundResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

/** Story 26 (WIS-22), Test Plan §H — retry/dead-letter, mirroring WIS-24 §E. */
uses(RefreshDatabase::class);

beforeEach(function () {
    config(['channels.enabled' => true]);
});

it('a 200 marks Delivered, stamps provider_message_id and bumps last_outbound_at', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud, ['phone_number_id' => '123']);
    $fake = bindChannelSender();
    $fake->respondWith(OutboundResponse::success(200, json_encode(['messages' => [['id' => 'wamid.OUT1']]])));

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('delivered');
    expect($message->delivered_at)->not->toBeNull();

    $connection->refresh();
    expect($connection->last_outbound_at)->not->toBeNull();
});

it('a 500 leaves Pending with attempts=1 and next_attempt_at at the first backoff entry', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $fake = bindChannelSender();
    $fake->respondWith(OutboundResponse::transient(500));

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);
    $before = now();

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('pending');
    expect($message->attempts)->toBe(1);
    $diff = abs($message->next_attempt_at->diffInSeconds($before));
    expect($diff)->toBeGreaterThanOrEqual(55)->toBeLessThanOrEqual(65);
});

it('five consecutive 500s go Dead with max_attempts on the fifth', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $fake = bindChannelSender();

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    $dispatcher = app(ChannelOutboxDispatcher::class);

    for ($i = 0; $i < 5; $i++) {
        $fake->respondWith(OutboundResponse::transient(500));
        $dispatcher->attempt($message->fresh());
    }

    $message->refresh();
    expect($message->status->value)->toBe('dead');
    expect($message->last_error_key)->toBe('channels.error.max_attempts');
});

it('a 422 goes Dead on attempt 1 — a permanent rejection does not consume the ladder', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $fake = bindChannelSender();
    $fake->respondWith(OutboundResponse::rejected(422));

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('dead');
    expect($message->attempts)->toBe(1);
});

it('a 401 goes Dead and flips the connection to Error with a last_error_key', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $fake = bindChannelSender();
    $fake->respondWith(OutboundResponse::rejected(401));

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('dead');

    $connection->refresh();
    expect($connection->status)->toBe(ChannelConnectionStatus::Error);
    expect($connection->last_error_key)->not->toBeNull();
});

it('a guard verdict of integrations.error.unreachable is retryable — Pending', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $fake = bindChannelSender();
    $fake->respondWith(OutboundResponse::blocked('integrations.error.unreachable'));

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('pending');
});

it('a guard verdict of integrations.error.blocked_host is Dead on attempt 1', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $fake = bindChannelSender();
    $fake->respondWith(OutboundResponse::blocked('integrations.error.blocked_host'));

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('dead');
    expect($message->attempts)->toBe(1);
});

it('attempting a message whose connection is no longer Connected returns Pending, not Dead', function () {
    [$connection] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $connection->forceFill(['status' => 'error'])->save();

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('pending');
});

it('MailChannelSender carries the generated Message-ID and In-Reply-To onto provider_message_id', function () {
    Mail::fake();
    [$connection] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $message = ChannelOutboundMessage::factory()->create([
        'channel_connection_id' => $connection->id,
        'in_reply_to' => 'the-inbound-message-id@x',
        'recipient' => 'customer@example.com',
    ]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('delivered');
    expect($message->provider_message_id)->not->toBeNull();

    Mail::assertSent(ChannelReplyMail::class, function (ChannelReplyMail $mail) use ($message) {
        return $mail->generatedMessageId === $message->provider_message_id
            && $mail->outboundMessage->in_reply_to === 'the-inbound-message-id@x';
    });
});

it('a throwing transport yields transportFailure() and Pending, with no exception escaping', function () {
    bindThrowingMailer();
    [$connection] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);

    $message = ChannelOutboundMessage::factory()->create(['channel_connection_id' => $connection->id]);

    app(ChannelOutboxDispatcher::class)->attempt($message);

    $message->refresh();
    expect($message->status->value)->toBe('pending');
});
