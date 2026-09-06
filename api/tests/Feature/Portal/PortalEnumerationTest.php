<?php

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

it('answers a matched and an unmatched identifier identically apart from masked_identifier', function () {
    Mail::fake();
    Customer::factory()->create(['email' => 'known@example.com']);

    $matched = $this->postJson('/api/portal/access/request', ['identifier' => 'known@example.com'])
        ->assertStatus(202);
    $unmatched = $this->postJson('/api/portal/access/request', ['identifier' => 'unknown@example.com'])
        ->assertStatus(202);

    expect($matched->json('sent'))->toBe($unmatched->json('sent'));
    expect($matched->json('resend_after_seconds'))->toBe($unmatched->json('resend_after_seconds'));
    expect($matched->json('masked_identifier'))->not->toBe($unmatched->json('masked_identifier'));
});

it('treats a soft-deleted customer exactly like an unknown identifier', function () {
    Mail::fake();
    $customer = Customer::factory()->create(['email' => 'gone@example.com']);
    $customer->delete();

    $this->postJson('/api/portal/access/request', ['identifier' => 'gone@example.com'])
        ->assertStatus(202);

    Mail::assertNothingSent();
    expect(\App\Models\PortalAccessCode::count())->toBe(0);
});
