<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('public');
});

it('uploads a logo with a randomised on-disk name', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $file = UploadedFile::fake()->image('logo.png');

    $response = $this->asUser($admin)->postJson('/api/admin/branding/logo', ['logo' => $file])
        ->assertOk();

    expect($response->json('data.logo_url'))->not->toBeNull();

    $stored = Storage::disk('public')->allFiles('branding');
    expect($stored)->toHaveCount(1);
    expect(basename($stored[0]))->not->toBe('logo.png');
});

it('deletes the previous file when a second logo is uploaded', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->postJson('/api/admin/branding/logo', ['logo' => UploadedFile::fake()->image('first.png')])
        ->assertOk();
    $firstPath = Storage::disk('public')->allFiles('branding')[0];

    $this->asUser($admin)->postJson('/api/admin/branding/logo', ['logo' => UploadedFile::fake()->image('second.png')])
        ->assertOk();

    Storage::disk('public')->assertMissing($firstPath);
    expect(Storage::disk('public')->allFiles('branding'))->toHaveCount(1);
});

it('clears the logo on delete', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);

    $this->asUser($admin)->postJson('/api/admin/branding/logo', ['logo' => UploadedFile::fake()->image('logo.png')])
        ->assertOk();

    $this->asUser($admin)->deleteJson('/api/admin/branding/logo')
        ->assertOk()
        ->assertJsonPath('data.logo_url', null);
});

it('rejects an SVG upload with 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $file = UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml');

    $this->asUser($admin)->postJson('/api/admin/branding/logo', ['logo' => $file])
        ->assertStatus(422);
});

it('rejects an oversized file with 422', function () {
    $admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $file = UploadedFile::fake()->image('logo.png')->size(600);

    $this->asUser($admin)->postJson('/api/admin/branding/logo', ['logo' => $file])
        ->assertStatus(422);
});
