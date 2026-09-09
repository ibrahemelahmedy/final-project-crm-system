<?php

namespace App\Enums;

/**
 * Story 24 (WIS-23), Decision 10. The `state` key of every chat response.
 * `RateLimited` is never emitted by the controller — the throttle middleware
 * answers 429 first and the SPA maps that status to this value — but it lives
 * here so both paths render one component.
 */
enum ChatReplyState: string
{
    case Ok = 'ok';
    case Refused = 'refused';
    case Unavailable = 'unavailable';
    case Ended = 'ended';
    case RateLimited = 'rate_limited';
}
