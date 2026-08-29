<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function () {
    RateLimiter::clear('login');
});

it('returns an Arabic validation message with an Arabic attribute name', function () {
    // An empty email triggers the `required` rule — the message interpolates
    // :attribute, so this proves the attributes map is wired, not just the
    // top-level message.
    $response = $this->withHeaders(['Accept-Language' => 'ar'])
        ->postJson('/api/login', ['email' => '', 'password' => '']);

    $response->assertStatus(422);
    $message = $response->json('errors.email.0');

    expect($message)->toContain('البريد الإلكتروني');
    expect($message)->not->toContain('email');
});

it('returns an Arabic auth.failed message on bad credentials with Accept-Language: ar', function () {
    User::factory()->create([
        'email' => 'known@wisal.test',
        'password' => Hash::make('Password123!'),
        'is_active' => true,
    ]);

    $response = $this->withHeaders(['Accept-Language' => 'ar'])
        ->postJson('/api/login', ['email' => 'known@wisal.test', 'password' => 'WrongPassword123!']);

    $response->assertStatus(422);
    expect($response->json('errors.email.0'))->toBe('بيانات الاعتماد هذه لا تطابق سجلاتنا.');
});

it('returns English for en, no header, and an unsupported header', function () {
    foreach ([['Accept-Language' => 'en'], [], ['Accept-Language' => 'de-DE']] as $headers) {
        RateLimiter::clear('login');

        $response = $this->withHeaders($headers)
            ->postJson('/api/login', ['email' => '', 'password' => '']);

        $response->assertStatus(422);
        expect($response->json('errors.email.0'))->toContain('email address');
    }
});
