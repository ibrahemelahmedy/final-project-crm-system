<?php

use App\Services\PortalAccess;

it('lower-cases and trims an email', function () {
    expect(PortalAccess::normalize('  Jane@Example.COM  '))->toBe('jane@example.com');
});

it('normalizes a phone with and without a leading plus', function () {
    expect(PortalAccess::normalize('+1 (415) 555-0148'))->toBe('+14155550148');
    expect(PortalAccess::normalize('4155550148'))->toBe('4155550148');
});

it('normalizes a phone with separators', function () {
    expect(PortalAccess::normalize('415.555.0148'))->toBe('4155550148');
});

it('returns null for an empty string', function () {
    expect(PortalAccess::normalize(''))->toBeNull();
    expect(PortalAccess::normalize('   '))->toBeNull();
});

it('returns null for a bare @', function () {
    expect(PortalAccess::normalize('@'))->toBeNull();
});

it('accepts a 191-character value without throwing', function () {
    $long = str_repeat('1', 191);
    expect(PortalAccess::normalize($long))->toBe($long);
});

it('masks an email revealing only the first local-part character', function () {
    $masked = PortalAccess::mask('jane@example.com');
    expect($masked)->toStartWith('j')->toContain('@example.com')->not->toContain('jane');
});

it('masks a phone revealing only the last two digits', function () {
    $masked = PortalAccess::mask('+14155550148');
    expect($masked)->toEndWith('48');
    expect($masked)->not->toContain('415555');
});

it('detects email vs phone', function () {
    expect(PortalAccess::isEmail('a@b.com'))->toBeTrue();
    expect(PortalAccess::isEmail('4155550148'))->toBeFalse();
});
