<?php

/*
|--------------------------------------------------------------------------
| Audit Trail event labels (Story 28 / WIS-29)
|--------------------------------------------------------------------------
|
| Keyed by the event-string constant VALUES owned by App\Services\AuditTrail
| (its events() list). AuditTrail::label() resolves through this file; an
| unknown event string still returns its raw slug (Lang::has() guard).
|
| English values are byte-identical to the strings AuditTrail::label()
| previously hard-coded, so no existing consumer or test changes.
|
*/

return [
    'user.created' => 'User created',
    'user.updated' => 'User updated',
    'user.role_changed' => 'Role changed',
    'user.deactivated' => 'User deactivated',
    'user.activated' => 'User activated',
    'setting.changed' => 'Setting changed',
    'sla_rule.changed' => 'SLA rule changed',
    'kb_article.published' => 'Article published',
    'kb_article.unpublished' => 'Article unpublished',
    'kb_article.archived' => 'Article archived',
    'integration.connected' => 'Integration connected',
    'integration.updated' => 'Integration updated',
    'integration.disconnected' => 'Integration disconnected',
    'integration.test_failed' => 'Integration test failed',
    'integration.sync_config_changed' => 'Integration sync configured',
    'channel_connection.changed' => 'Channel connection changed',
    'branch.changed' => 'Branch changed',
    'department.changed' => 'Department changed',
    'branding.changed' => 'Branding changed',
    'login.success' => 'Signed in',
    'login.failed' => 'Failed sign-in',
    'login.inactive' => 'Blocked sign-in (deactivated)',
    'logout' => 'Signed out',

    // Fallback actor name for a deleted user whose email is also blank.
    'unknown_actor' => 'Unknown',
];
