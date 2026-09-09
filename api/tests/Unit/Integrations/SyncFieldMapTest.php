<?php

use App\Models\Customer;
use App\Services\Integrations\SyncFieldMap;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('reads a dot path', function () {
    expect(SyncFieldMap::read(['a' => ['b' => 'value']], 'a.b'))->toBe('value');
});

it('returns null for a missing path', function () {
    expect(SyncFieldMap::read(['a' => 'x'], 'a.b.c'))->toBeNull();
});

it('treats an array value as absent', function () {
    expect(SyncFieldMap::read(['a' => ['b' => ['nested']]], 'a'))->toBeNull();
});

it('casts a numeric value to string', function () {
    expect(SyncFieldMap::read(['n' => 42], 'n'))->toBe('42');
});

it('treats a whitespace-only value as absent', function () {
    expect(SyncFieldMap::read(['s' => '   '], 's'))->toBeNull();
});

it('caps an over-long value at 191 chars', function () {
    $long = str_repeat('x', 300);
    expect(strlen(SyncFieldMap::read(['s' => $long], 's')))->toBe(191);
});

it('attributesFor: create path includes every present mapped field regardless of rule', function () {
    $record = ['id' => '1', 'name' => 'Jane', 'email' => 'jane@example.com'];
    $map = ['external_id' => 'id', 'name' => 'name', 'email' => 'email'];
    $rules = ['name' => 'wisal_wins', 'email' => 'wisal_wins'];

    $result = SyncFieldMap::attributesFor($record, $map, $rules, null);

    expect($result['attributes'])->toBe(['name' => 'Jane', 'email' => 'jane@example.com']);
});

it('attributesFor: remote_wins overwrites an existing non-empty value', function () {
    $existing = Customer::factory()->make(['name' => 'Old Name']);
    $record = ['name' => 'New Name'];
    $result = SyncFieldMap::attributesFor($record, ['name' => 'name'], ['name' => 'remote_wins'], $existing);

    expect($result['attributes'])->toBe(['name' => 'New Name']);
});

it('attributesFor: wisal_wins skips an existing non-empty value', function () {
    $existing = Customer::factory()->make(['company' => 'Existing Co']);
    $record = ['company' => 'New Co'];
    $result = SyncFieldMap::attributesFor($record, ['company' => 'company'], ['company' => 'wisal_wins'], $existing);

    expect($result['attributes'])->toBe([]);
});

it('attributesFor: wisal_wins fills a null existing value', function () {
    $existing = Customer::factory()->make(['company' => null]);
    $record = ['company' => 'New Co'];
    $result = SyncFieldMap::attributesFor($record, ['company' => 'company'], ['company' => 'wisal_wins'], $existing);

    expect($result['attributes'])->toBe(['company' => 'New Co']);
});
