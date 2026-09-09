<?php

namespace App\Enums;

/**
 * Story 24 (WIS-23), Decision 6. The lifecycle of one portal chatbot
 * conversation row.
 */
enum PortalChatState: string
{
    case Active = 'active';
    case Ended = 'ended';         // a ceiling was reached
    case Escalated = 'escalated'; // "talk to a person" created a ticket
}
