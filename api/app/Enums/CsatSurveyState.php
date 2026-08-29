<?php

namespace App\Enums;

/**
 * Story 13 — the single shared vocabulary for "which artboard to render".
 * Derived from the row, never stored. The API returns one of these strings
 * and the frontend maps it to a rendered state.
 */
enum CsatSurveyState: string
{
    case Outstanding = 'outstanding';
    case Answered = 'answered';
    case Expired = 'expired';
}
