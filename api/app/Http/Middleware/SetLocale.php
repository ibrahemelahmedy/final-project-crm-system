<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Story 15 (WIS-11). Reads the `Accept-Language` header the SPA sends on every
 * request (sourced from the user's stored preference — see the frontend
 * `lib/api.ts` interceptor), accepts only `en` / `ar`, and falls back to `en`
 * for anything else. Registered globally on the API in bootstrap/app.php,
 * following the SecurityHeaders precedent.
 *
 * The client is the authority on which locale the user chose; this middleware
 * only makes Laravel's `validation`/`auth`/`passwords` catalogues resolve in
 * that locale so server-side messages read in Arabic on an Arabic UI.
 */
class SetLocale
{
    private const SUPPORTED = ['en', 'ar'];

    public function handle(Request $request, Closure $next): Response
    {
        $requested = strtolower(substr((string) $request->header('Accept-Language', 'en'), 0, 2));

        App::setLocale(in_array($requested, self::SUPPORTED, true) ? $requested : 'en');

        return $next($request);
    }
}
