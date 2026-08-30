<?php

namespace App\Console\Commands;

use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Ticket;
use App\Services\SlaClock;
use App\Services\SlaNotifier;
use App\Services\TicketAssigner;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Story 06 (WIS-6). The escalation, breach and auto-close engine.
 *
 * Auto-discovered from app/Console/Commands — this project has no
 * app/Console/Kernel.php and one must not be created. Scheduled every five
 * minutes from routes/console.php.
 *
 * It runs SYNCHRONOUSLY and dispatches no queued job: QUEUE_CONNECTION is the
 * database driver with no worker configured anywhere in this repo, so a
 * dispatched job would sit in `jobs` forever.
 *
 * Four passes, each idempotent via a nullable-timestamp guard. No pass keeps a
 * since-last-run cursor — every one is a state comparison against now() — so
 * after any outage the next run catches up completely and still emits at most
 * one at-risk and one breach notification per ticket.
 */
class EvaluateSlaCommand extends Command
{
    protected $signature = 'sla:evaluate
                            {--backfill : Stamp SLA targets on tickets that have none, then exit}
                            {--dry-run : Report what would change without writing}';

    protected $description = 'Evaluate SLA at-risk, breach, escalation and auto-close across all open tickets.';

    public function handle(SlaClock $clock, SlaNotifier $notifier, TicketAssigner $assigner): int
    {
        $now = Carbon::now();

        if ($this->option('backfill')) {
            return $this->backfill($clock);
        }

        if ($this->option('dry-run')) {
            return $this->dryRun($now);
        }

        $this->flagAtRisk($notifier, $now);
        $this->flagBreached($notifier, $now);
        $this->escalate($assigner, $notifier, $now);
        $this->autoClose($now);

        return self::SUCCESS;
    }

    private function flagAtRisk(SlaNotifier $notifier, Carbon $now): void
    {
        $count = 0;

        Ticket::query()
            ->slaAtRisk($now)
            ->whereNull('sla_at_risk_notified_at')
            ->with(['assignee:id,name,is_active'])
            ->chunkById(200, function ($tickets) use ($notifier, $now, &$count) {
                foreach ($tickets as $ticket) {
                    $notifier->slaAtRisk($ticket);
                    $ticket->forceFill(['sla_at_risk_notified_at' => $now])->save();
                    $count++;
                }
            });

        $this->info("at-risk: {$count}");
    }

    private function flagBreached(SlaNotifier $notifier, Carbon $now): void
    {
        $count = 0;

        Ticket::query()
            ->slaBreached($now)
            ->whereNull('sla_breached_notified_at')
            ->with(['assignee:id,name,is_active'])
            ->chunkById(200, function ($tickets) use ($notifier, $now, &$count) {
                foreach ($tickets as $ticket) {
                    $notifier->slaBreached($ticket);

                    // Close the at-risk guard too. A ticket that passed through
                    // its whole at-risk window while the engine was down must
                    // not fire a stale at-risk alert on the next run — two
                    // alerts at once is noise, and the breach is the actionable
                    // one.
                    $ticket->forceFill([
                        'sla_breached_notified_at' => $now,
                        'sla_at_risk_notified_at' => $ticket->sla_at_risk_notified_at ?? $now,
                    ])->save();
                    $count++;
                }
            });

        $this->info("breached: {$count}");
    }

    private function escalate(TicketAssigner $assigner, SlaNotifier $notifier, Carbon $now): void
    {
        $count = 0;

        Ticket::query()
            ->slaRunning()
            ->whereNotNull('escalate_at')
            ->where('escalate_at', '<=', $now)
            ->whereNull('escalated_at')
            // An answered ticket does not escalate: it has had its human
            // contact, and escalating it punishes the agent who responded.
            ->whereNull('first_response_at')
            ->with('slaRule')
            ->chunkById(200, function ($tickets) use ($assigner, $notifier, $now, &$count) {
                foreach ($tickets as $ticket) {
                    $role = UserRole::tryFrom((string) $ticket->slaRule?->escalate_to_role);
                    $target = $role ? $assigner->pickByRole($role) : null;

                    // Stamped, not retried. Without this a database with no
                    // Team Lead retries every ticket every five minutes forever.
                    if ($target === null || $target->id === $ticket->assigned_to) {
                        $ticket->forceFill(['escalated_at' => $now])->save();
                        $count++;

                        continue;
                    }

                    $from = $ticket->assigned_to;
                    $ticket->forceFill(['assigned_to' => $target->id, 'escalated_at' => $now])->save();
                    $ticket->recordEscalated($from, $target->id);
                    $notifier->escalated($ticket, $target);
                    $count++;
                }
            });

        $this->info("escalated: {$count}");
    }

    private function autoClose(Carbon $now): void
    {
        $count = 0;

        Ticket::query()
            ->where('status', TicketStatus::Resolved->value)
            // Story 04 clears resolved_at when a ticket leaves Resolved, so a
            // REOPENED ticket never satisfies this and never auto-closes.
            ->whereNotNull('resolved_at')
            ->whereNotNull('sla_rule_id')
            ->with('slaRule')
            ->chunkById(200, function ($tickets) use ($now, &$count) {
                foreach ($tickets as $ticket) {
                    $days = $ticket->slaRule?->auto_close_after_days;

                    if ($days === null || $ticket->resolved_at->copy()->addDays($days)->greaterThan($now)) {
                        continue;
                    }

                    // Called even though resolved → closed is legal in the
                    // shipped graph: TicketStatus is the single transition
                    // authority, and hard-coding that this edge exists is the
                    // parallel logic Story 04's contract forbids.
                    if (! $ticket->status->canTransitionTo(TicketStatus::Closed)) {
                        continue;
                    }

                    $ticket->update(['status' => TicketStatus::Closed, 'closed_at' => $now]);
                    $ticket->recordAutoClosed();
                    $count++;
                }
            });

        $this->info("auto-closed: {$count}");
    }

    /**
     * The ONLY way pre-existing tickets get SLA targets — the migration
     * deliberately does not backfill. Idempotent.
     */
    private function backfill(SlaClock $clock): int
    {
        $count = 0;

        Ticket::query()
            ->whereNull('resolution_due_at')
            ->whereNotIn('status', [TicketStatus::Resolved->value, TicketStatus::Closed->value])
            ->chunkById(200, function ($tickets) use ($clock, &$count) {
                foreach ($tickets as $ticket) {
                    $clock->applyTo($ticket);

                    // A ticket already sitting in Pending when its targets are
                    // first stamped must also be paused, or it inherits a
                    // running clock it never had. `sla_paused_at` is non-null
                    // ONLY while Pending — that invariant has to hold for
                    // backfilled rows too, and pause() is idempotent.
                    if ($ticket->status === TicketStatus::Pending) {
                        $clock->pause($ticket);
                    }

                    $ticket->save();
                    $count++;
                }
            });

        $this->info("backfilled: {$count}");

        return self::SUCCESS;
    }

    /** Every query, no writes. What an operator runs before the first real invocation. */
    private function dryRun(Carbon $now): int
    {
        $atRisk = Ticket::query()->slaAtRisk($now)->whereNull('sla_at_risk_notified_at')->count();
        $breached = Ticket::query()->slaBreached($now)->whereNull('sla_breached_notified_at')->count();
        $escalate = Ticket::query()
            ->slaRunning()
            ->whereNotNull('escalate_at')
            ->where('escalate_at', '<=', $now)
            ->whereNull('escalated_at')
            ->whereNull('first_response_at')
            ->count();

        $autoClose = Ticket::query()
            ->where('status', TicketStatus::Resolved->value)
            ->whereNotNull('resolved_at')
            ->whereNotNull('sla_rule_id')
            ->with('slaRule')
            ->get()
            ->filter(function (Ticket $ticket) use ($now) {
                $days = $ticket->slaRule?->auto_close_after_days;

                return $days !== null && $ticket->resolved_at->copy()->addDays($days)->lessThanOrEqualTo($now);
            })
            ->count();

        $this->info("at-risk: {$atRisk}");
        $this->info("breached: {$breached}");
        $this->info("escalated: {$escalate}");
        $this->info("auto-closed: {$autoClose}");
        $this->comment('dry run — nothing was written.');

        return self::SUCCESS;
    }
}
