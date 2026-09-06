<?php

use App\Http\Middleware\ActiveUserOnly;
use App\Http\Middleware\EnsureAdministrator;
use App\Http\Middleware\PortalAuth;
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

            // Story 17 (WIS-16): the public portal access-code REQUEST limiter,
            // keyed two ways like `login` — per-identifier so one target cannot
            // be spammed, and per-IP so one caller cannot spray many
            // identifiers. This is the resend guardrail.
            RateLimiter::for('portal-access', fn (Request $request) => [
                Limit::perMinute(5)->by(Str::lower((string) $request->input('identifier')).'|'.$request->ip()),
                Limit::perMinute(20)->by($request->ip()),
            ]);

            // Story 17: a SEPARATE limiter for code VERIFICATION. Brute force
            // against one code is already hard-capped at PortalAccess::MAX_ATTEMPTS
            // (5) in the service, after which every attempt is a cheap 410 — so
            // this limiter only needs to stop verify being hammered across many
            // codes. A shared 5/min limiter with `portal-access` turned the
            // 6th (exhaustion → 410) attempt into a 429.
            RateLimiter::for('portal-verify', fn (Request $request) => [
                Limit::perMinute(10)->by(Str::lower((string) $request->input('identifier')).'|'.$request->ip()),
                Limit::perMinute(30)->by($request->ip()),
            ]);

            // Story 17: the portal-authenticated limiter, keyed on the bearer
            // token itself (falling back to IP) so it is independent of the
            // staff-facing API's throttling entirely.
            RateLimiter::for('portal', fn (Request $request) => Limit::perMinute(60)
                ->by($request->bearerToken() ?? $request->ip()));

            // Story 19 (WIS-18): AI generation is the only paid-per-call
            // endpoint in the app. Keyed on the USER, not the IP — a shared
            // office NAT must not let one agent's regenerate loop lock out
            // the floor. Separate from every other limiter, so exhausting it
            // never touches the rest of the API.
            RateLimiter::for('ai-assist', fn (Request $request) => [
                Limit::perMinute(6)->by('ai-user:'.($request->user()?->id ?? $request->ip())),
                Limit::perDay(200)->by('ai-user:'.($request->user()?->id ?? $request->ip())),
            ]);
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
            // Story 17 (WIS-16): resolves a portal_sessions bearer token.
            // Never auth:sanctum — see PortalAuth's docblock.
            'portal' => PortalAuth::class,
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
