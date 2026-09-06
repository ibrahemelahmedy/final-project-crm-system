<?php

namespace App\Services;

use App\Models\CsatSurvey;
use Illuminate\Support\Facades\URL;

/**
 * Story 13 (CSAT Collection) extracted this in Story 17 (WIS-16, Customer
 * Portal) so the agent-facing ticket panel and the Customer Portal mint the
 * SAME signed link — Decision 2 in the portal story plan (coexist with, not
 * supersede, CSAT). Behaviour-preserving extraction of what was
 * CsatSurveyController::shareUrl(): the signed output is byte-identical.
 *
 * The customer-facing link points at the SPA route `/feedback/{uuid}`; the
 * SPA forwards the `expires` + `signature` query params to `GET
 * /api/csat/{uuid}`. Keyed on route names `csat.show` / `csat.store` —
 * renaming either invalidates every outstanding link.
 */
class CsatShareLink
{
    public function for(CsatSurvey $survey): string
    {
        $signed = URL::temporarySignedRoute(
            'csat.show',
            $survey->expires_at,
            ['uuid' => $survey->uuid]
        );

        $query = parse_url($signed, PHP_URL_QUERY);
        $frontend = trim(explode(',', (string) env('FRONTEND_URL', 'http://localhost:5173'))[0]);

        return rtrim($frontend, '/')."/feedback/{$survey->uuid}?{$query}";
    }
}
