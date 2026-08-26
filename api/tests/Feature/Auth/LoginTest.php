<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function () {
    RateLimiter::clear('login');
});

it('authenticates an active user and returns their role and home route', function () {
    $user = User::factory()->create([
        'email' => 'agent@wisal.test',
        'password' => Hash::make('Password123!'),
        'role' => UserRole::Agent,
        'is_active' => true,
    ]);

    $response = $this->postJson('/api/login', [
        'email' => 'agent@wisal.test',
        'password' => 'Password123!',
    ]);

    $response->assertOk()
        ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role', 'role_label', 'home_route', 'is_active']])
        ->assertJsonPath('user.role', 'agent')
        ->assertJsonPath('user.home_route', '/dashboard');
});

it('returns an identical message for a wrong password and an unknown email', function () {
    User::factory()->create([
        'email' => 'known@wisal.test',
        'password' => Hash::make('Password123!'),
        'is_active' => true,
    ]);

    $resUnknown = $this->postJson('/api/login', [
        'email' => 'unknown@wisal.test',
        'password' => 'Password123!',
    ]);

    RateLimiter::clear('login');

    $resWrongPassword = $this->postJson('/api/login', [
        'email' => 'known@wisal.test',
        'password' => 'WrongPassword123!',
    ]);

    $resUnknown->assertStatus(422);
    $resWrongPassword->assertStatus(422);
    expect($resUnknown->content())->toBe($resWrongPassword->content());
});

it('reveals deactivation only after the correct password', function () {
    $user = User::factory()->create([
        'email' => 'disabled@wisal.test',
        'password' => Hash::make('Password123!'),
        'is_active' => false,
    ]);

    // Wrong password -> generic message (matches non-enumeration response)
    $resWrong = $this->postJson('/api/login', [
        'email' => 'disabled@wisal.test',
        'password' => 'WrongPassword123!',
    ]);

    RateLimiter::clear('login');

    // Right password -> clear deactivated account message
    $resRight = $this->postJson('/api/login', [
        'email' => 'disabled@wisal.test',
        'password' => 'Password123!',
    ]);

    $resWrong->assertStatus(422)
        ->assertJsonPath('errors.email.0', 'These credentials do not match our records.');

    $resRight->assertStatus(422)
        ->assertJsonPath('errors.email.0', 'This account has been deactivated. Contact your administrator.');
});

it('records a deactivated login attempt in the audit log', function () {
    $user = User::factory()->create([
        'email' => 'disabled@wisal.test',
        'password' => Hash::make('Password123!'),
        'is_active' => false,
    ]);

    $this->postJson('/api/login', [
        'email' => 'disabled@wisal.test',
        'password' => 'Password123!',
    ]);

    expect(AuditLog::where('event', 'login.inactive')->where('email', 'disabled@wisal.test')->exists())->toBeTrue();
});

it('blocks the sixth failed attempt within a minute with 429', function () {
    for ($i = 1; $i <= 5; $i++) {
        $res = $this->postJson('/api/login', [
            'email' => 'user@wisal.test',
            'password' => 'WrongPassword!',
        ]);
        $res->assertStatus(422);
    }

    $sixth = $this->postJson('/api/login', [
        'email' => 'user@wisal.test',
        'password' => 'WrongPassword!',
    ]);

    $sixth->assertStatus(429)
        ->assertHeader('Retry-After');
});

it('does not let one email exhaust another emails throttle budget', function () {
    for ($i = 1; $i <= 5; $i++) {
        $this->postJson('/api/login', [
            'email' => 'userA@wisal.test',
            'password' => 'WrongPassword!',
        ]);
    }

    $attemptUserB = $this->postJson('/api/login', [
        'email' => 'userB@wisal.test',
        'password' => 'WrongPassword!',
    ]);

    expect($attemptUserB->status())->toBe(422);
});

it('never writes the submitted password into the audit log', function () {
    $secretPassword = 'SuperSecretUniquePassword999!';

    $this->postJson('/api/login', [
        'email' => 'someone@wisal.test',
        'password' => $secretPassword,
    ]);

    $logs = AuditLog::all();
    foreach ($logs as $log) {
        expect(json_encode($log->toArray()))->not()->toContain($secretPassword);
    }
});
