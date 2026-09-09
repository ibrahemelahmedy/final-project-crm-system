<?php

namespace App\Providers;

use Anthropic\Client;
use App\Models\CustomerAttachment;
use App\Models\Ticket;
use App\Observers\TicketClassificationObserver;
use App\Observers\TicketResolutionObserver;
use App\Policies\CustomerPolicy;
use App\Policies\ReportPolicy;
use App\Services\Ai\AnthropicAssistGenerator;
use App\Services\Ai\AssistGenerator;
use App\Services\Ai\OpenAiCompatibleAssistGenerator;
use App\Services\Ai\UnavailableAssistGenerator;
use App\Services\HttpIntegrationTester;
use App\Services\IntegrationConnectionTester;
use App\Services\Kb\ArticleSearch;
use App\Services\Kb\LikeArticleSearch;
use App\Services\Kb\PostgresArticleSearch;
use App\Services\MailPortalCodeNotifier;
use App\Services\PortalCodeNotifier;
use App\Services\SlaClock;
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

        // Story 17 (WIS-16): the OTP delivery seam. Mail-only per Decision 4
        // in the story plan — Category 11 (SMS/WhatsApp) is out of scope.
        $this->app->bind(PortalCodeNotifier::class, MailPortalCodeNotifier::class);

        // Story 18 (WIS-19): the "Test connection" seam. Bound to the real
        // outbound HTTP prober here; every test in the suite binds a fake
        // instead, so no test ever makes a real outbound request.
        $this->app->bind(IntegrationConnectionTester::class, HttpIntegrationTester::class);

        // Story 19 (WIS-18) / Story 22 (WIS-26): the AI provider seam, now
        // selected by `AI_PROVIDER`. Bound to the unavailable implementation
        // when no key is configured OR the provider name is unknown, so a
        // misconfigured deployment degrades to "no cards" instead of a 500 on
        // every ticket open. Resolved lazily, like ArticleSearch above —
        // nothing may read config or open a connection while the container boots.
        $this->app->singleton(Client::class, fn () => new Client(apiKey: (string) config('ai.key')));

        $this->app->bind(AssistGenerator::class, function ($app) {
            if (! config('ai.enabled')) {
                return $app->make(UnavailableAssistGenerator::class);
            }

            $name = (string) config('ai.provider');
            $config = config('ai.providers.'.$name);

            return match ($name) {
                'anthropic' => $app->make(AnthropicAssistGenerator::class),
                'groq', 'gemini' => new OpenAiCompatibleAssistGenerator(
                    provider: $name,
                    baseUrl: (string) ($config['base_url'] ?? ''),
                    apiKey: (string) ($config['key'] ?? ''),
                    model: (string) ($config['model'] ?? ''),
                ),
                // Unreachable while `enabled` is derived from the same map
                // (config/ai.php), but a runtime config() override in a test
                // can reach it. Never throw here.
                default => $app->make(UnavailableAssistGenerator::class),
            };
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

        // Story 24 (WIS-23): propose category + priority on create. Writes ONLY
        // the ai_suggested_* columns — never category/priority (Decision 4).
        Ticket::observe(TicketClassificationObserver::class);
    }
}
