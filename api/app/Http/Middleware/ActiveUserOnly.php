<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * 401 for an authenticated user whose `is_active` is false (Story 08).
 *
 * Applied to the whole auth:sanctum group, so every authenticated endpoint in
 * the app inherits it. This is the SECOND of the two layers that make
 * deactivation bite on the next request: UserAdminService deletes the user's
 * tokens in the same transaction as the flag, but token deletion alone does
 * not cover a cookie-mode Sanctum session, and a token issued between the two
 * would otherwise survive.
 *
 * The token is destroyed on the way out too — a request that reaches here with
 * a live token belonging to a deactivated user means the token outlived the
 * transaction, and leaving it in place invites the same request again.
 */
class ActiveUserOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            $user->tokens()->delete();

            return response()->json([
                'message' => 'This account has been deactivated. Contact your administrator.',
            ], 401);
        }

        return $next($request);
    }
}
