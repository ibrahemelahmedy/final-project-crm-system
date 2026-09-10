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
 *
 * `category` is a `Ticket::CATEGORIES` string, not a backed enum. It lives here
 * because it is rendered exactly the same way — `category_label` travels with
 * `category` on every ticket resource — and `Ticket::categoryLabel()` resolves
 * it through this array.
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

    'customer_tier' => [
        'standard' => 'Standard',
        'premium' => 'Premium',
        'enterprise' => 'Enterprise',
    ],

    'article_status' => [
        'draft' => 'Draft',
        'published' => 'Published',
        'archived' => 'Archived',
    ],

    'notification_type' => [
        'sla_at_risk' => 'SLA at risk',
        'sla_breached' => 'SLA breached',
        'mention' => 'Mention',
        'task_due' => 'Task due',
        'customer_replied' => 'Customer replied',
    ],

    'quick_reply_status' => [
        'active' => 'Active',
        'archived' => 'Archived',
    ],

    'task_status' => [
        'open' => 'Open',
        'completed' => 'Completed',
        'cancelled' => 'Cancelled',
    ],

    'message_visibility' => [
        'public' => 'Reply to customer',
        'internal' => 'Internal note',
    ],

    'category' => [
        'general' => 'General',
        'billing' => 'Billing',
        'technical' => 'Technical',
        'account' => 'Account',
        'feature_request' => 'Feature request',
    ],
];
