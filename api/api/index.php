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

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->useStoragePath($storageDir);

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
)->send();

$kernel->terminate($request, $response);
