<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('persists a locale change and reflects it on GET /api/user', function () {
    $user = User::factory()->create(['is_active' => true, 'locale' => 'en']);

    $this->actingAs($user)
        ->patchJson('/api/user/preferences', ['locale' => 'ar'])
        ->assertOk()
        ->assertJsonPath('locale', 'ar');

    $this->actingAs($user->fresh())
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('locale', 'ar');

    expect($user->fresh()->locale)->toBe('ar');
});

it('rejects an unsupported locale with 422', function () {
    $user = User::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->patchJson('/api/user/preferences', ['locale' => 'fr'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('locale');
});

it('requires authentication', function () {
    $this->patchJson('/api/user/preferences', ['locale' => 'ar'])
        ->assertStatus(401);
});

it('writes only the calling user row', function () {
    $caller = User::factory()->create(['is_active' => true, 'locale' => 'en']);
    $other = User::factory()->create(['is_active' => true, 'locale' => 'en']);

    $this->actingAs($caller)
        ->patchJson('/api/user/preferences', ['locale' => 'ar'])
        ->assertOk();

    expect($caller->fresh()->locale)->toBe('ar');
    expect($other->fresh()->locale)->toBe('en');
});
