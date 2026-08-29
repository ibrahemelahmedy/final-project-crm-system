<?php

namespace App\Console\Commands;

use App\Enums\NotificationType;
use App\Models\TicketTask;
use App\Services\NotificationDispatcher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * `tasks:dispatch-due-reminders` — Story 10's scheduled reminder job.
 * Selects `ticket_tasks` where status=open, due_at<=now(), reminded_at IS
 * NULL, dispatches ONE `task_due` notification per task, and stamps
 * `reminded_at` in the SAME transaction as the dispatch — that stamp is the
 * idempotency guard a second/overlapping run relies on.
 */
class DispatchDueTaskReminders extends Command
{
    protected $signature = 'tasks:dispatch-due-reminders';

    protected $description = 'Dispatch an in-app reminder for every open ticket task that has reached its due time.';

    public function handle(NotificationDispatcher $dispatcher): int
    {
        $dueTasks = TicketTask::query()
            ->dueForReminder()
            ->with(['assignee', 'ticket:id,subject'])
            ->get();

        $dispatched = 0;

        foreach ($dueTasks as $task) {
            DB::transaction(function () use ($task, $dispatcher, &$dispatched) {
                // Re-check inside the transaction — a concurrent complete/cancel/
                // reassign between the SELECT above and here must not fire.
                $locked = TicketTask::query()->whereKey($task->id)->lockForUpdate()->first();

                if (! $locked || $locked->status->value !== 'open' || $locked->reminded_at !== null) {
                    return;
                }

                $locked->update(['reminded_at' => now()]);

                if ($task->assignee) {
                    $dispatcher->dispatch(
                        $task->assignee,
                        NotificationType::TaskDue,
                        "Task due: {$task->title}",
                        $task->ticket ? "On ticket #{$task->ticket_id} — {$task->ticket->subject}" : null,
                        $task,
                        "/tickets/{$task->ticket_id}"
                    );
                }

                $dispatched++;
            });
        }

        $this->info("Dispatched {$dispatched} task reminder(s).");

        return self::SUCCESS;
    }
}
