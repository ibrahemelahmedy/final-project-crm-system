<?php

define('LARAVEL_START', microtime(true));

// Vercel's filesystem is read-only except /tmp, so Laravel writes there instead.
$storageDir = '/tmp/storage';
foreach ([
    $storageDir . '/app/public',
    $storageDir . '/framework/cache/data',
    $storageDir . '/framework/sessions',
    $storageDir . '/framework/views',
    $storageDir . '/logs',
] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

// The function lives at /api/index.php, so Symfony would treat "/api" as the script
// base and strip it from the path — hiding every /api/* route. Pin the script to root.
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';

try {
    require __DIR__ . '/../vendor/autoload.php';

    $app = require_once __DIR__ . '/../bootstrap/app.php';
    $app->useStoragePath($storageDir);

    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

    $response = $kernel->handle(
        $request = Illuminate\Http\Request::capture()
    )->send();

    $kernel->terminate($request, $response);
} catch (\Throwable $e) {
    // Boot-time failures happen before Laravel's handler exists — surface them.
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'boot_error' => $e->getMessage(),
        'file' => $e->getFile() . ':' . $e->getLine(),
        'trace' => array_slice(explode("\n", $e->getTraceAsString()), 0, 12),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}
