<?php

namespace App\Enums;

/**
 * Story 18 (WIS-19). The three states an integration card can render.
 *
 * `NotConnected` is never persisted — it is what IntegrationResource reports
 * for a type with no `integrations` row. Keeping it in the enum expresses the
 * API's three-value contract in one place instead of a string literal in the
 * Resource.
 */
enum IntegrationStatus: string
{
    case NotConnected = 'not_connected';
    case Connected = 'connected';
    case Error = 'error';
}
