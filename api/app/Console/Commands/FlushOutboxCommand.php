<?php

namespace App\Console\Commands;

use App\Enums\OutboxStatus;
use App\Enums\SyncDirection;
use App\Enums\SyncRunStatus;
use App\Enums\SyncRunTrigger;
use App\Models\IntegrationOutboxMessage;
use App\Models\SyncRun;
use App\Services\Integrations\OutboxDispatcher;
use Illuminate\Console\Command;

/**
 * Story 25 (WIS-24). The real delivery guarantee (Decision 2). Scheduled
 * every five minutes from routes/console.php.
 */
class FlushOutboxCommand extends Command
{
    protected $signature = 'sync:flush-outbox {--limit= : Override the configured batch size}';

    protected $description = 'Attempt delivery of every due outbox message, one SyncRun per integration.';

    public function handle(OutboxDispatcher $dispatcher): int
    {
        $limit = $this->option('limit') !== null
            ? (int) $this->option('limit')
            : (int) config('integrations.sync.outbound.batch_size');

        $due = IntegrationOutboxMessage::query()->due()->limit($limit)->get();

        if ($due->isEmpty()) {
            $this->info('Outbox empty.');

            return self::SUCCESS;
        }

        $byIntegration = $due->groupBy('integration_id');

        foreach ($byIntegration as $integrationId => $messages) {
            $run = SyncRun::create([
                'integration_id' => $integrationId,
                'direction' => SyncDirection::Outbound->value,
                'trigger' => SyncRunTrigger::Scheduled->value,
                'status' => SyncRunStatus::Running->value,
                'started_at' => now(),
                'records_read' => 0,
                'records_created' => 0,
                'records_updated' => 0,
                'records_skipped' => 0,
                'records_failed' => 0,
            ]);

            foreach ($messages as $message) {
                $run->records_read++;

                $status = $dispatcher->attempt($message);

                match ($status) {
                    OutboxStatus::Delivered => $run->records_created++,
                    OutboxStatus::Dead => (function () use ($run, $message) {
                        $run->records_failed++;
                        $run->addError([
                            'external_id' => $message->event_id,
                            'field' => null,
                            'reason_key' => $message->last_error_key,
                            'detail' => null,
                        ]);
                    })(),
                    OutboxStatus::Pending => $run->records_skipped++,
                };
            }

            $run->status = $run->records_failed > 0 ? SyncRunStatus::Partial : SyncRunStatus::Success;
            $run->finished_at = now();
            $run->save();

            $type = $run->integration?->type?->value ?? (string) $integrationId;

            $this->info(sprintf(
                'outbox %s: read %d delivered %d deferred %d dead %d',
                $type,
                $run->records_read,
                $run->records_created,
                $run->records_skipped,
                $run->records_failed,
            ));
        }

        return self::SUCCESS;
    }
}
