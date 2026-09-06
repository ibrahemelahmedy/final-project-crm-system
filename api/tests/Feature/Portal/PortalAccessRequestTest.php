<?php

use App\Mail\PortalAccessCodeMail;
use App\Models\Customer;
use App\Models\PortalAccessCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

it('issues exactly one code and sends exactly one mail for a matching email', function () {
    Mail::fake();
    $customer = Customer::factory()->create(['email' => 'jane@example.com']);

    $this->postJson('/api/portal/access/request', ['identifier' => 'Jane@Example.com'])
        ->assertStatus(202)
        ->assertJsonPath('sent', true);

    expect(PortalAccessCode::where('customer_id', $customer->id)->count())->toBe(1);
    Mail::assertSent(PortalAccessCodeMail::class, 1);
});

it('resolves a matching phone in either stored form', function () {
    Mail::fake();
    $customer = Customer::factory()->create(['phone' => '+1 (415) 555-0148']);

    $this->postJson('/api/portal/access/request', ['identifier' => '14155550148'])
        ->assertStatus(202);

    expect(PortalAccessCode::where('customer_id', $customer->id)->count())->toBe(1);
});

it('rejects an unparseable identifier with 422', function () {
    $this->postJson('/api/portal/access/request', ['identifier' => 'not-an-identifier!!'])
        ->assertStatus(422);
});

it('returns 202 and writes zero rows for a valid-format unmatched identifier', function () {
    Mail::fake();

    $this->postJson('/api/portal/access/request', ['identifier' => 'nobody@example.com'])
        ->assertStatus(202)
        ->assertJsonPath('sent', true);

    expect(PortalAccessCode::count())->toBe(0);
    Mail::assertNothingSent();
});

it('writes no new row on a second request inside the cooldown', function () {
    Mail::fake();
    Customer::factory()->create(['email' => 'cooldown@example.com']);

    $this->postJson('/api/portal/access/request', ['identifier' => 'cooldown@example.com'])->assertStatus(202);
    $this->postJson('/api/portal/access/request', ['identifier' => 'cooldown@example.com'])->assertStatus(202);

    expect(PortalAccessCode::count())->toBe(1);
    Mail::assertSent(PortalAccessCodeMail::class, 1);
});

it('supersedes the prior code when a request lands outside the cooldown', function () {
    Mail::fake();
    Customer::factory()->create(['email' => 'resend@example.com']);

    $this->postJson('/api/portal/access/request', ['identifier' => 'resend@example.com'])->assertStatus(202);
    $first = PortalAccessCode::first();

    $this->travel(61)->seconds();

    $this->postJson('/api/portal/access/request', ['identifier' => 'resend@example.com'])->assertStatus(202);

    expect(PortalAccessCode::count())->toBe(2);
    expect($first->fresh()->consumed_at)->not->toBeNull();
    Mail::assertSent(PortalAccessCodeMail::class, 2);
});
