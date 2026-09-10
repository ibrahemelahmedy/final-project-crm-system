<?php

namespace App\Http;

use App\Models\ChatSession;
use Illuminate\Http\Request;

/**
 * Story 26 (WIS-22), Decision 11. Mirrors App\Http\PortalRequest — the
 * single place a controller reaches for the widget identity ChatWidgetAuth
 * bound onto the request.
 */
final class ChatWidgetRequest
{
    public static function session(Request $request): ChatSession
    {
        $session = $request->attributes->get('chat_session');

        abort_unless($session instanceof ChatSession, 401);

        return $session;
    }
}
