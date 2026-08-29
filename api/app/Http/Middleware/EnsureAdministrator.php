<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * The one server-side administrator gate (Story 08).
 *
 * Registered as the `administrator` alias and applied to the whole
 * /api/admin/* group, so a new admin endpoint cannot be added without a
 * guard. The frontend nav and route guards are UX only — this is the
 * boundary, and AdminAuthorizationTest walks the real route list to prove
 * every route under the prefix carries it.
 */
class EnsureAdministrator
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isAdministrator()) {
            throw new AccessDeniedHttpException('This action requires an Administrator role.');
        }

        return $next($request);
    }
}
