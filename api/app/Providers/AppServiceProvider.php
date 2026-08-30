<?php

namespace App\Providers;

use App\Models\CustomerAttachment;
use App\Models\Ticket;
use App\Observers\TicketResolutionObserver;
use App\Policies\CustomerPolicy;
use App\Policies\ReportPolicy;
use App\Services\Kb\ArticleSearch;
use App\Services\SlaClock;
use App\Services\Kb\LikeArticleSearch;
use App\Services\Kb\PostgresArticleSearch;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Story 09: one ArticleSearch contract, picked by the live driver.
        // Resolved lazily (a closure, not a conditional at register time) so
        // no database connection is opened while the container boots — which
        // would break `artisan config:cache` and every console command.
        // Story 06: one SLA clock per request. The $rules memo makes the
        // engine's per-tier lookup happen four times per run instead of once
        // per ticket.
        $this->app->singleton(SlaClock::class);

        $this->app->bind(ArticleSearch::class, function () {
            return DB::connection()->getDriverName() === 'pgsql'
                ? new PostgresArticleSearch
                : new LikeArticleSearch;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Password::defaults(fn () => Password::min(8)
            ->letters()
            ->mixedCase()
            ->numbers()
            ->uncompromised());

        // Story 12: the management Reports dashboard gate. Denied to Agents.
        Gate::define('view-reports', [ReportPolicy::class, 'view']);

        // Story 03: `deleteAttachment` lives on CustomerPolicy but is called
        // with a CustomerAttachment instance, which Laravel would otherwise
        // resolve to a non-existent CustomerAttachmentPolicy and deny outright
        // — including for the uploader. One mapping, no second policy class.
        Gate::policy(CustomerAttachment::class, CustomerPolicy::class);

        // Story 13: create exactly one CSAT survey when a ticket transitions
        // to Resolved. Story 04 transitions inline with no event, so this is a
        // model observer, not an event subscriber.
        Ticket::observe(TicketResolutionObserver::class);
    }
}
