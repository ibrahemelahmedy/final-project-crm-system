<?php

/*
|--------------------------------------------------------------------------
| System Settings display copy (Story 28 / WIS-29)
|--------------------------------------------------------------------------
|
| Label + help text for each key in App\Services\SystemSettings::definitions().
| The rules, types and defaults stay in the service — only the display copy
| is localised here. English values are byte-identical to the strings
| definitions() previously hard-coded.
|
*/

return [
    'password_min_length' => [
        'label' => 'Minimum password length',
        'help' => 'Characters required in an internal user password. Cannot be lower than 8.',
    ],
    'password_expiry_days' => [
        'label' => 'Password expiry (days)',
        'help' => 'Days before a password must be changed. 0 disables expiry.',
    ],
    'session_timeout_minutes' => [
        'label' => 'Session timeout (minutes)',
        'help' => 'Idle minutes before a signed-in user is asked to sign in again.',
    ],
    'max_login_attempts' => [
        'label' => 'Maximum failed sign-in attempts',
        'help' => 'Failed attempts per minute before an account is throttled.',
    ],
    'audit_log_retention_days' => [
        'label' => 'Audit log retention (days)',
        'help' => 'How long audit entries are kept. Never lower than 30 days.',
    ],
];
