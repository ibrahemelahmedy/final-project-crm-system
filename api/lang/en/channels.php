<?php

/*
 * Story 26 (WIS-22). Server-side strings that are genuinely server-side.
 * Connection and delivery ERRORS are NOT here — they are i18n keys resolved
 * in the SPA, following ChannelOverviewResource's label_key convention.
 */
return [
    'webhook_rejected' => 'The request could not be verified.',
    'widget_session_invalid' => 'This chat session is no longer valid.',

    'inbound' => [
        'default_subject' => 'New :channel message',
        'attachment_placeholder' => '[An attachment was sent but is not supported in this release.]',
        'unknown_customer' => 'Unknown customer',
    ],

    'mail' => [
        'reply_subject' => 'Re: :subject',
    ],

    'error' => [
        'chat_limit' => 'This conversation has reached its message limit.',
    ],
];
