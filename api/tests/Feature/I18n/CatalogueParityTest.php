<?php

use Illuminate\Support\Arr;

function flattenLang(string $locale): array
{
    $base = base_path("lang/$locale");
    $out = [];

    foreach (glob("$base/*.php") as $file) {
        $name = basename($file, '.php');
        $out += Arr::dot([$name => require $file]);
    }

    return $out;
}

it('has every English key present in Arabic', function () {
    $en = flattenLang('en');
    $ar = flattenLang('ar');

    $missing = array_diff(array_keys($en), array_keys($ar));

    expect($missing)->toBe([], 'Missing Arabic keys: '.implode(', ', $missing));
});

it('has no Arabic value byte-identical to its English counterpart', function () {
    $en = flattenLang('en');
    $ar = flattenLang('ar');

    // The placeholder `custom.*` scaffold is exempt — it ships identical in
    // Laravel's own published files and is never rendered.
    $identical = [];
    foreach ($en as $key => $value) {
        if (str_starts_with($key, 'custom.')) {
            continue;
        }
        if (isset($ar[$key]) && is_string($value) && $ar[$key] === $value) {
            $identical[] = $key;
        }
    }

    expect($identical)->toBe([], 'Copy-paste stubs: '.implode(', ', $identical));
});
