<?php

namespace App\Enums;

/**
 * Story 26 (WIS-22). No `NotConnected` case — that state is the ABSENT row
 * (Decision 1, reusing WIS-19's Decision 3). The *resource* still reports
 * `not_connected`; the enum does not carry it, so nothing can persist it.
 */
enum ChannelConnectionStatus: string
{
    case Connected = 'connected';
    case Error = 'error';
}
