<?php

use App\Http\Middleware\ActiveUserOnly;
use App\Http\Middleware\EnsureAdministrator;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetLocale;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            RateLimiter::for('login', fn (Request $request) => [
                Limit::perMinute(5)->by(Str::lower((string) $request->input('email')).'|'.$request->ip()),
                Limit::perMinute(20)->by($request->ip()),
            ]);

            // Story 13: the public CSAT survey limiter. Keyed on IP and
            // entirely separate from the agent-facing API's limiter, so a
            // flood of survey traffic can never lock out agents.
            RateLimiter::for('csat', fn (Request $request) => Limit::perMinute(20)->by($request->ip()));
        }
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SecurityHeaders::class);

        // Story 15 (WIS-11): resolve server-side messages in the locale the SPA
        // requests via Accept-Language. Global, following SecurityHeaders.
        $middleware->append(SetLocale::class);

        // Story 08's two shared gates. `active` sits on the whole
        // auth:sanctum group in api.php; `administrator` sits on
        // /api/admin/* and on /api/dashboard/admin/*.
        $middleware->alias([
            'active' => ActiveUserOnly::class,
            'administrator' => EnsureAdministrator::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Story 13: a tampered or missing signature on a public CSAT link must
        // render the SAME calm invalid state as an expired or unknown one —
        // never a 403 stack trace — so the link space stays non-enumerable.
        $exceptions->render(function (\Illuminate\Routing\Exceptions\InvalidSignatureException $e, Request $request) {
            if ($request->is('api/csat/*')) {
                return response()->json([
                    'state' => 'expired',
                    'ticket' => null,
                    'rating' => null,
                    'comment' => null,
                    'responded_at' => null,
                ]);
            }
        });
    })->create();
