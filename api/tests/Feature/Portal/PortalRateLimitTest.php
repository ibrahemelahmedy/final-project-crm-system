<?php

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

it('returns 429 on the sixth access request for one identifier inside a minute', function () {
    Mail::fake();
    Customer::factory()->create(['email' => 'ratelimited@example.com']);

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/portal/access/request', ['identifier' => 'ratelimited@example.com'])
            ->assertStatus(202);
    }

    $this->postJson('/api/portal/access/request', ['identifier' => 'ratelimited@example.com'])
        ->assertStatus(429);
});

it('keeps the login limiter independent of portal traffic', function () {
    Mail::fake();
    Customer::factory()->create(['email' => 'independent@example.com']);

    for ($i = 0; $i < 6; $i++) {
        $this->postJson('/api/portal/access/request', ['identifier' => 'independent@example.com']);
    }

    // The login endpoint must still accept requests (a validation failure,
    // not a 429) — the two limiters share no bucket.
    $this->postJson('/api/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
        ->assertStatus(422);
});
