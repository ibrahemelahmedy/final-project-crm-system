<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Story 10.
Schedule::command('tasks:dispatch-due-reminders')
    ->everyFiveMinutes()
    ->withoutOverlapping();

// WIS-6: the SLA engine. Runs synchronously — no queue worker is configured in
// this project (config/queue.php defaults to the `database` driver and nothing
// drains the jobs table), so a dispatched job would never execute.
//
// Five minutes is the granularity the tightest seeded rule needs: Urgent's
// response target is 15 minutes. `withoutOverlapping(10)` stops a slow run on a
// large table having a second run start behind it and double-process a chunk;
// the 10-minute expiry releases a stuck lock automatically.
Schedule::command('sla:evaluate')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->runInBackground();

// WIS-24: the integration sync engine. Same constraints as sla:evaluate above
// — synchronous, no queue worker exists to hand work to.
//
// The outbox drain is the DELIVERY GUARANTEE, not an optimisation: the inline
// attempt registered by IntegrationEvents is best-effort and capped. Five
// minutes matches the shortest configured backoff (60s) closely enough that a
// transient 5xx recovers within two cycles.
Schedule::command('sync:flush-outbox')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->runInBackground();

// Hourly, not every five minutes: a customer master pulled from an ERP does
// not change on a five-minute cadence, and each run can read up to
// config('integrations.sync.inbound.max_records_per_run') rows.
Schedule::command('sync:pull-customers')
    ->hourly()
    ->withoutOverlapping(30)
    ->runInBackground();
