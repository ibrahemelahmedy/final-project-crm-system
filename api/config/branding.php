<?php

return [
    // The validator's max: rule is in kilobytes.
    'max_kb' => (int) env('BRANDING_LOGO_MAX_KB', 512),

    // SVG is deliberately absent. The logo is served from the `public`
    // disk (Story 20, Decision 5), i.e. by the web server rather than
    // through SecurityHeaders middleware, so an uploaded SVG opened at
    // its own URL would execute its own scripts on this origin.
    'allowed_extensions' => ['png', 'jpg', 'jpeg', 'webp'],

    // Public on purpose — a bearer-token <img> cannot authenticate, so a
    // private-disk streamed route (the customer-attachment pattern) cannot
    // render in the sidebar. A company logo is not confidential.
    'disk' => 'public',
];
