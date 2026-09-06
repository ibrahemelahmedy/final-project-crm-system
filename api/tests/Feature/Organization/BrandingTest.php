<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns null primary_color and logo_url with nothing stored', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->getJson('/api/admin/branding')
        ->assertOk()
        ->assertJsonPath('data.primary_color', null)
        ->assertJsonPath('data.logo_url', null);
});

it('persists a primary color and reads it back', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->patchJson('/api/admin/branding', ['primary_color' => '#0E7490'])
        ->assertOk()
        ->assertJsonPath('data.primary_color', '#0E7490');

    $this->asUser($admin)->getJson('/api/admin/branding')
        ->assertOk()
        ->assertJsonPath('data.primary_color', '#0E7490');
});

it('clears the primary color when set to null', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->patchJson('/api/admin/branding', ['primary_color' => '#0E7490'])->assertOk();
    $this->asUser($admin)->patchJson('/api/admin/branding', ['primary_color' => null])
        ->assertOk()
        ->assertJsonPath('data.primary_color', null);
});

it('rejects a malformed hex color', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->patchJson('/api/admin/branding', ['primary_color' => '#GGGGGG'])->assertStatus(422);
    $this->asUser($admin)->patchJson('/api/admin/branding', ['primary_color' => '4F46E5'])->assertStatus(422);
});

it('writes exactly one audit row per real change and none for a repeat', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->patchJson('/api/admin/branding', ['primary_color' => '#0E7490'])->assertOk();
    $this->asUser($admin)->patchJson('/api/admin/branding', ['primary_color' => '#0E7490'])->assertOk();

    expect(AuditLog::where('event', 'branding.changed')->count())->toBe(1);
});

it('never returns a logo_path key', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $response = $this->asUser($admin)->getJson('/api/admin/branding')->assertOk();

    expect($response->json('data'))->not->toHaveKey('logo_path');
});
