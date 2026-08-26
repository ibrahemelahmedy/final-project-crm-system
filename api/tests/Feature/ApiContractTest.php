<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns json 401 for an unauthenticated protected request without Accept header', function () {
    // Calling endpoint without headers or Accept: application/json
    $response = $this->call('GET', '/api/user');

    $response->assertStatus(401)
        ->assertHeader('Content-Type', 'application/json');

    expect($response->headers->has('Location'))->toBeFalse();
});

it('exposes the Retry-After header to cross-origin callers', function () {
    // A real cross-origin request, not just the config array — this is the
    // only way to catch the browser-visible behaviour Task 7 depends on.
    $response = $this->withHeaders([
        'Origin' => config('cors.allowed_origins')[0],
    ])->getJson('/api/user');

    $response->assertHeader('Access-Control-Expose-Headers');
    expect($response->headers->get('Access-Control-Expose-Headers'))->toContain('Retry-After');
});

it('sets security headers on every API response', function () {
    $response = $this->getJson('/api/user');

    $response->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
});
