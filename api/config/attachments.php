<?php

return [
    // Per-file cap. The validator's max: rule is in kilobytes.
    'max_kb' => (int) env('ATTACHMENT_MAX_KB', 10240), // 10 MB

    // Extensions accepted on a customer attachment.
    'allowed_extensions' => ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx'],

    // Disk from config/filesystems.php. MUST stay private — see the local disk,
    // root storage_path('app/private'). Never 'public'.
    'disk' => env('ATTACHMENT_DISK', 'local'),
];
