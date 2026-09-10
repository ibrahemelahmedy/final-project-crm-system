<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Mailer
    |--------------------------------------------------------------------------
    |
    | This option controls the default mailer that is used to send all email
    | messages unless another mailer is explicitly specified when sending
    | the message. All additional mailers can be configured within the
    | "mailers" array. Examples of each type of mailer are provided.
    |
    */

    'default' => env('MAIL_MAILER', 'log'),

    /*
    |--------------------------------------------------------------------------
    | Mailer Configurations
    |--------------------------------------------------------------------------
    |
    | Here you may configure all of the mailers used by your application plus
    | their respective settings. Several examples have been configured for
    | you and you are free to add your own as your application requires.
    |
    | Laravel supports a variety of mail "transport" drivers that can be used
    | when delivering an email. You may specify which one you're using for
    | your mailers below. You may also add additional mailers if needed.
    |
    | Supported: "smtp", "sendmail", "mailgun", "ses", "ses-v2",
    |            "postmark", "resend", "log", "array",
    |            "failover", "roundrobin"
    |
    */

    'mailers' => [

        'smtp' => [
            'transport' => 'smtp',
            'scheme' => env('MAIL_SCHEME'),
            'url' => env('MAIL_URL'),
            'host' => env('MAIL_HOST', '127.0.0.1'),
            'port' => env('MAIL_PORT', 2525),
            'username' => env('MAIL_USERNAME'),
            'password' => env('MAIL_PASSWORD'),
            'timeout' => null,
            'local_domain' => env('MAIL_EHLO_DOMAIN', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST)),
        ],

        'ses' => [
            'transport' => 'ses',
        ],

        'postmark' => [
            'transport' => 'postmark',
            // 'message_stream_id' => env('POSTMARK_MESSAGE_STREAM_ID'),
            // 'client' => [
            //     'timeout' => 5,
            // ],
        ],

        'resend' => [
            'transport' => 'resend',
        ],

        'sendmail' => [
            'transport' => 'sendmail',
            'path' => env('MAIL_SENDMAIL_PATH', '/usr/sbin/sendmail -bs -i'),
        ],

        'log' => [
            'transport' => 'log',
            'channel' => env('MAIL_LOG_CHANNEL'),
        ],

        'array' => [
            'transport' => 'array',
        ],

        'failover' => [
            'transport' => 'failover',
            'mailers' => [
                'smtp',
                'log',
            ],
            'retry_after' => 60,
        ],

        'roundrobin' => [
            'transport' => 'roundrobin',
            'mailers' => [
                'ses',
                'postmark',
            ],
            'retry_after' => 60,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Global "From" Address
    |--------------------------------------------------------------------------
    |
    | You may wish for all emails sent by your application to be sent from
    | the same address. Here you may specify a name and address that is
    | used globally for all emails that are sent by your application.
    |
    */

    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),
        'name' => env('MAIL_FROM_NAME', env('APP_NAME', 'Laravel')),
    ],

    /*
    |--------------------------------------------------------------------------
    | Customer-Facing Locale (Story 23 / WIS-27, Decision 6)
    |--------------------------------------------------------------------------
    |
    | `customers` has no locale column, so a mail sent outside a customer's own
    | request — the CSAT invitation, fired when an AGENT resolves a ticket —
    | has no honest per-recipient locale to read. It renders in this one
    | instead. The portal access code does NOT use this: that mail is sent
    | inside the customer's own portal request, where App::getLocale() is
    | their own choice.
    |
    | Story 28 (WIS-29) Decision 6: this is now a FALLBACK only. A ticket whose
    | subject or description contains Arabic renders its customer email in
    | Arabic — see App\Services\CustomerLocale::forTicket(). The
    | `customers.locale` column remains the right long-term fix and a later story.
    |
    */

    'customer_locale' => env('MAIL_CUSTOMER_LOCALE', env('APP_LOCALE', 'en')),

    /*
    |--------------------------------------------------------------------------
    | CSAT Invitation (Story 23 / WIS-27, Decision 5)
    |--------------------------------------------------------------------------
    |
    | POST /api/tickets/bulk resolves up to 100 tickets in ONE transaction and
    | every one of them mints a survey. Mail here is synchronous — there is no
    | queue worker in this repository — so an uncapped bulk resolve would put
    | 100 sequential SMTP round-trips inside one HTTP request. Past this cap
    | the survey is still created and the agent-facing share link still works;
    | only the email is skipped, and the skip is logged.
    |
    */

    'csat' => [
        'max_per_request' => (int) env('MAIL_CSAT_MAX_PER_REQUEST', 10),
    ],

];
