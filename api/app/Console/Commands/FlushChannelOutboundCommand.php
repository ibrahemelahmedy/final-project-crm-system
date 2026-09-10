<?php

namespace App\Console\Commands;

use App\Enums\ChannelDeliveryStatus;
use App\Models\ChannelOutboundMessage;
use App\Services\Channels\ChannelOutboxDispatcher;
use Illuminate\Console\Command;

/**
 * Story 26 (WIS-22), Decision 13. The real delivery guarantee. Copies
 * FlushOutboxCommand's shape. Scheduled every five minutes.
 */
class FlushChannelOutboundCommand extends Command
{
    protected $signature = 'channels:flush-outbound {--limit= : Override the configured batch size}';

    protected $description = 'Attempt delivery of every due channel outbound message.';

    public function handle(ChannelOutboxDispatcher $dispatcher): int
    {
        $limit = $this->option('limit') !== null
            ? (int) $this->option('limit')
            : (int) config('channels.outbound.batch_size');

        $due = ChannelOutboundMessage::query()->due()->limit($limit)->get();

        if ($due->isEmpty()) {
            $this->info('Channel outbound queue empty.');

            return self::SUCCESS;
        }

        $tally = ['delivered' => 0, 'pending' => 0, 'dead' => 0];

        foreach ($due as $message) {
            $status = $dispatcher->attempt($message);

            match ($status) {
                ChannelDeliveryStatus::Delivered => $tally['delivered']++,
                ChannelDeliveryStatus::Pending => $tally['pending']++,
                ChannelDeliveryStatus::Dead => $tally['dead']++,
            };
        }

        $this->info(sprintf(
            'channels outbound: delivered %d pending %d dead %d',
            $tally['delivered'], $tally['pending'], $tally['dead'],
        ));

        return self::SUCCESS;
    }
}
