<?php

namespace App\Console\Commands;

use App\Enums\Channel;
use App\Enums\ChannelConnectionStatus;
use App\Enums\MessageVisibility;
use App\Models\ChannelConnection;
use App\Models\ChannelOutboundMessage;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Services\Channels\ChannelOutbox;
use App\Services\Channels\ChannelOutboxDispatcher;
use Illuminate\Console\Command;

/**
 * Story 26 (WIS-22), Decision 13. The discharge path for Done Criteria 1 and
 * 2 once credentials are pasted. Enqueues one reply and immediately attempts
 * delivery. Never fails — warns and exits 0, matching MailTestCommand's
 * MAIL_MAILER=log behaviour.
 */
class TestChannelSendCommand extends Command
{
    protected $signature = 'channels:test-send {channel} {ticket} {--body=Test message from channels:test-send.}';

    protected $description = 'Enqueue and immediately attempt one outbound channel reply.';

    public function handle(ChannelOutbox $outbox, ChannelOutboxDispatcher $dispatcher): int
    {
        $channelEnum = Channel::tryFrom((string) $this->argument('channel'));

        if ($channelEnum === null) {
            $this->error('Unknown channel: '.$this->argument('channel'));

            return self::SUCCESS;
        }

        if (! config('channels.enabled')) {
            $this->warn('channels.enabled is false — nothing sent.');

            return self::SUCCESS;
        }

        $connection = ChannelConnection::query()->where('channel', $channelEnum->value)->first();

        if ($connection === null || $connection->status !== ChannelConnectionStatus::Connected) {
            $this->warn("Channel {$channelEnum->value} is not connected — nothing sent.");

            return self::SUCCESS;
        }

        $ticket = Ticket::find((int) $this->argument('ticket'));

        if ($ticket === null) {
            $this->error('Ticket not found: '.$this->argument('ticket'));

            return self::SUCCESS;
        }

        $body = (string) $this->option('body');

        $message = $ticket->messages()->create([
            'author_type' => TicketMessage::AUTHOR_AGENT,
            'user_id' => null,
            'customer_id' => null,
            'channel' => $ticket->channel,
            'body' => $body,
            'visibility' => MessageVisibility::Public->value,
        ]);

        $outbox->enqueue($message, fn () => ChannelOutbox::replyPayload($message, $ticket));

        $outboundMessage = ChannelOutboundMessage::query()
            ->where('ticket_message_id', $message->id)
            ->first();

        if ($outboundMessage === null) {
            $this->warn('Enqueue produced no row — check the recipient is resolvable from the customer.');

            return self::SUCCESS;
        }

        $status = $dispatcher->attempt($outboundMessage);

        $this->info("status: {$status->value}");
        $this->info('last_status: '.($outboundMessage->last_status ?? 'null'));
        $this->info('last_error_key: '.($outboundMessage->last_error_key ?? 'null'));

        return self::SUCCESS;
    }
}
