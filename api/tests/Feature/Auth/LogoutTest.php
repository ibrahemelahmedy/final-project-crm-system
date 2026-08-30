<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

it('revokes access token on logout and returns 401 on subsequent requests', function () {
    $user = User::factory()->create([
        'email' => 'user@wisal.test',
        'password' => Hash::make('Password123!'),
        'is_active' => true,
    ]);

    $token = $user->createToken('spa')->plainTextToken;

    // Logout call
    $response = $this->asToken($token)
        ->postJson('/api/logout');

    $response->assertNoContent();

    // Verify database token row is deleted
    expect(DB::table('personal_access_tokens')->count())->toBe(0);

    // Forget cached auth guards in test application
    $this->app->make('auth')->forgetGuards();

    // Call protected endpoint with same token -> expect 401
    $userRequest = $this->asToken($token)
        ->getJson('/api/user');

    $userRequest->assertStatus(401);
});
