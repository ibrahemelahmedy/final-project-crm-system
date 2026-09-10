<?php

namespace App\Http\Middleware;

use App\Models\ChatSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Story 26 (WIS-22), Decision 11. PortalAuth with ChatSession substituted —
 * a fourth audience, neither staff nor a portal customer. Deliberately
 * NEVER calls Auth::login() and never binds a customer as $request->user().
 * Every failure (missing, unknown, revoked, expired) renders the same 401.
 */
class ChatWidgetAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->bearerToken();

        if ($plain === null) {
            return $this->unauthorized();
        }

        $session = ChatSession::query()
            ->where('token_hash', ChatSession::hashToken($plain))
            ->first();

        if ($session === null || ! $session->isLive()) {
            return $this->unauthorized();
        }

        $session->forceFill(['last_used_at' => now()])->saveQuietly();

        $request->attributes->set('chat_session', $session);

        return $next($request);
    }

    private function unauthorized(): Response
    {
        return response()->json(['message' => __('channels.widget_session_invalid')], 401);
    }
}
