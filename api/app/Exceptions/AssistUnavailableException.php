<?php

namespace App\Exceptions;

/**
 * Story 19 (WIS-18). Thrown by any AssistGenerator implementation on ANY
 * provider failure — timeout, rate limit, 5xx, refusal, empty completion, or
 * the feature being unconfigured. The controller converts this to a 503 and
 * NEVER lets it reach the composer; see TicketAssistController::run().
 */
class AssistUnavailableException extends \RuntimeException {}
