<?php

namespace App\Console\Commands;

use App\Enums\IntegrationStatus;
use App\Enums\IntegrationType;
use App\Enums\SyncRunTrigger;
use App\Models\Integration;
use App\Services\Integrations\CustomerPuller;
use Illuminate\Console\Command;

/**
 * Story 25 (WIS-24). Auto-discovered from app/Console/Commands (this project
 * has no app/Console/Kernel.php and one must not be created). Runs
 * synchronously because no queue worker exists. Scheduled hourly from
 * routes/console.php.
 */
class PullCustomersCommand extends Command
{
    protected $signature = 'sync:pull-customers
                            {--type=erp : Integration type to pull}
                            {--dry-run : Fetch and report without writing}';

    protected $description = 'Pull customer records from every inbound-enabled, connected integration of the given type.';

    public function handle(CustomerPuller $puller): int
    {
        $type = IntegrationType::tryFrom((string) $this->option('type'));

        if ($type === null) {
            $this->error('Unknown integration type: '.$this->option('type'));

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');

        $integrations = Integration::query()
            ->where('type', $type->value)
            ->where('inbound_enabled', true)
            ->where('status', IntegrationStatus::Connected->value)
            ->get();

        if ($integrations->isEmpty()) {
            $this->info('No inbound-enabled integrations.');

            return self::SUCCESS;
        }

        foreach ($integrations as $integration) {
            $run = $puller->pull($integration, SyncRunTrigger::Scheduled, $dryRun);

            $this->info(sprintf(
                '%s: read %d created %d updated %d skipped %d failed %d',
                $type->value,
                $run->records_read,
                $run->records_created,
                $run->records_updated,
                $run->records_skipped,
                $run->records_failed,
            ));
        }

        return self::SUCCESS;
    }
}
