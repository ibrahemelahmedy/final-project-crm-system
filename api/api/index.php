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

// The bootstrap cache is generated locally, where require-dev packages (Pail,
// Collision, Pest) are installed, but Vercel builds vendor with --no-dev. A
// shipped packages.php therefore lists providers whose classes do not exist and
// kills the app on boot. Point every cache file at /tmp so Laravel always
// rebuilds them from the vendor that is actually deployed.
$cacheDir = $storageDir . '/bootstrap-cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0777, true);
}
foreach ([
    'APP_PACKAGES_CACHE' => 'packages.php',
    'APP_SERVICES_CACHE' => 'services.php',
    'APP_CONFIG_CACHE' => 'config.php',
    'APP_ROUTES_CACHE' => 'routes.php',
    'APP_EVENTS_CACHE' => 'events.php',
] as $var => $file) {
    putenv("{$var}={$cacheDir}/{$file}");
    $_ENV[$var] = $_SERVER[$var] = "{$cacheDir}/{$file}";
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
