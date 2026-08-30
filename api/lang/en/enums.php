<?php

/**
 * Story 15 (WIS-11). Display copy for the backed enums that reach the SPA as
 * `*_label` fields on a resource.
 *
 * These live server-side rather than in the React catalogues because the label
 * travels WITH the value: every resource in this API sends `priority` and
 * `priority_label` together, and Story 04's contract has components render the
 * label the server sent. Duplicating the map in TypeScript is how the two
 * drift. SetLocale resolves the caller's language from Accept-Language.
 *
 * The English values are byte-identical to the strings these enums previously
 * hard-coded, so no existing consumer or test changes.
 */
return [
    'priority' => [
        'low' => 'Low',
        'normal' => 'Normal',
        'high' => 'High',
        'urgent' => 'Urgent',
    ],

    'ticket_status' => [
        'open' => 'Open',
        'pending' => 'Pending',
        'resolved' => 'Resolved',
        'closed' => 'Closed',
    ],

    'channel' => [
        'email' => 'Email',
        'whatsapp' => 'WhatsApp',
        'chat' => 'Live chat',
        'sms' => 'SMS',
        'web_form' => 'Web form',
    ],

    'user_role' => [
        'agent' => 'Agent',
        'team_lead' => 'Team Lead',
        'administrator' => 'Administrator',
    ],
];
