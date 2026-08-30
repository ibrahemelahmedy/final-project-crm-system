<?php

/**
 * Story 06 (WIS-6). The ON BREACH sentence is derived from four booleans on
 * the rule, so it cannot be assembled client-side — it is translated here and
 * returned ready to render by SlaRuleResource.
 */
return [
    'breach_notify_and_escalate' => 'Notify Team Lead + escalate to :role',
    'breach_escalate' => 'Escalate to :role',
    'breach_notify' => 'Notify Team Lead',
    'breach_none' => 'No escalation',

    'role_team_lead' => 'Team Lead',
    'role_administrator' => 'Administrator',
];
