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

    // Only Laravel's published placeholder key is exempt. Story 28 (WIS-29)
    // narrowed this from a blanket `custom.*` skip: `validation.custom` now
    // holds 20+ real user-facing strings that must be genuinely translated,
    // not copy-pasted from English. The flattened key carries the file prefix.
    $identical = [];
    foreach ($en as $key => $value) {
        if ($key === 'validation.custom.attribute-name.rule-name') {
            continue;
        }
        if (isset($ar[$key]) && is_string($value) && $ar[$key] === $value) {
            $identical[] = $key;
        }
    }

    expect($identical)->toBe([], 'Copy-paste stubs: '.implode(', ', $identical));
});
