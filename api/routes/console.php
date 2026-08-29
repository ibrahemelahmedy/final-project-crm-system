<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Story 10. Story 06's SLA breach schedule entry (not yet built) belongs
// alongside this one — same queued-job pattern, same file.
Schedule::command('tasks:dispatch-due-reminders')
    ->everyFiveMinutes()
    ->withoutOverlapping();
