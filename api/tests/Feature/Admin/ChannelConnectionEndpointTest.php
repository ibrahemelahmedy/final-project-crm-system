<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\ChannelConnection;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

/** Story 26 (WIS-22), Test Plan §L. */
uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

function adminAuth(User $user): array
{
    return ['Authorization' => 'Bearer '.$user->createToken('spa')->plainTextToken];
}

it('PUT creates the row, stores secret_last_four, and the response has no secret/verify_token', function () {
    $response = $this->withHeaders(adminAuth($this->admin))
        ->putJson('/api/admin/channels/whatsapp', [
            'provider' => 'whatsapp_cloud',
            'secret' => 'super-secret-value-1234',
            'config' => ['phone_number_id' => '1234567890'],
        ]);

    $response->assertOk();
    expect($response->json('data.secret_last_four'))->toBe('1234');
    $response->assertJsonMissingPath('data.secret');
    $response->assertJsonMissingPath('data.verify_token');

    $connection = ChannelConnection::where('channel', 'whatsapp')->firstOrFail();
    expect($connection->secret)->toBe('super-secret-value-1234');
});

it('a second PUT omitting secret keeps the stored one; an empty string clears it', function () {
    $this->withHeaders(adminAuth($this->admin))->putJson('/api/admin/channels/whatsapp', [
        'provider' => 'whatsapp_cloud',
        'secret' => 'original-secret-value',
        'config' => ['phone_number_id' => '1'],
    ])->assertOk();

    $this->withHeaders(adminAuth($this->admin))->putJson('/api/admin/channels/whatsapp', [
        'provider' => 'whatsapp_cloud',
        'config' => ['phone_number_id' => '2'],
    ])->assertOk();

    $connection = ChannelConnection::where('channel', 'whatsapp')->firstOrFail();
    expect($connection->secret)->toBe('original-secret-value');

    $this->withHeaders(adminAuth($this->admin))->putJson('/api/admin/channels/whatsapp', [
        'provider' => 'whatsapp_cloud',
        'secret' => '',
        'config' => ['phone_number_id' => '2'],
    ])->assertOk();

    expect($connection->fresh()->secret)->toBeNull();
});

it('a config key outside the allowlist is dropped and never persisted', function () {
    $response = $this->withHeaders(adminAuth($this->admin))->putJson('/api/admin/channels/whatsapp', [
        'provider' => 'whatsapp_cloud',
        'config' => ['phone_number_id' => '1', 'not_an_allowed_key' => 'sneaky-secret'],
    ]);

    // No wildcard rule for `config.*` means an unlisted key is simply absent
    // from validated() — dropped silently, not rejected (Edge Case 33).
    $response->assertOk();
    $response->assertJsonMissingPath('data.config.not_an_allowed_key');

    $connection = ChannelConnection::where('channel', 'whatsapp')->firstOrFail();
    expect($connection->config)->not->toHaveKey('not_an_allowed_key');
});

it('a provider whose channel() mismatches the route {channel} returns 422', function () {
    $response = $this->withHeaders(adminAuth($this->admin))->putJson('/api/admin/channels/whatsapp', [
        'provider' => 'twilio_sms',
        'config' => [],
    ]);

    $response->assertStatus(422);
});

it('PUT /api/admin/channels/web_form is 404', function () {
    $this->withHeaders(adminAuth($this->admin))->putJson('/api/admin/channels/web_form', [
        'provider' => 'email_webhook',
        'config' => [],
    ])->assertStatus(404);
});

it('POST .../test failure sets status=Error+last_error_key; success clears both', function () {
    bindOutboundUrlGuard(true);
    $connection = ChannelConnection::factory()->whatsapp()->errored()->create();
    // Http::fake() merges stub maps rather than replacing them, and the
    // first-registered wildcard always wins — a single fakeSequence for
    // BOTH calls is the reliable way to vary the response across them.
    Http::fakeSequence()->push([], 401)->push(['ok' => true], 200);

    $this->withHeaders(adminAuth($this->admin))->postJson('/api/admin/channels/whatsapp/test')->assertOk();
    expect($connection->fresh()->status->value)->toBe('error');
    expect($connection->fresh()->last_error_key)->not->toBeNull();

    $this->withHeaders(adminAuth($this->admin))->postJson('/api/admin/channels/whatsapp/test')->assertOk();

    expect($connection->fresh()->status->value)->toBe('connected');
    expect($connection->fresh()->last_error_key)->toBeNull();
});

it('DELETE removes the row, and the overview reports not_connected again', function () {
    ChannelConnection::factory()->whatsapp()->create();

    $this->withHeaders(adminAuth($this->admin))->deleteJson('/api/admin/channels/whatsapp')->assertStatus(204);

    expect(ChannelConnection::where('channel', 'whatsapp')->count())->toBe(0);

    $res = $this->withHeaders(adminAuth($this->admin))->getJson('/api/channels/overview')->assertOk();
    $whatsapp = collect($res->json('data'))->firstWhere('value', 'whatsapp');
    expect($whatsapp['status'])->toBe('not_connected');
});

it('every action writes one AuditTrail::CHANNEL_CONNECTION_CHANGED row whose context names the verb and never the secret', function () {
    bindOutboundUrlGuard(true);
    $this->withHeaders(adminAuth($this->admin))->putJson('/api/admin/channels/whatsapp', [
        'provider' => 'whatsapp_cloud',
        'secret' => 'a-very-secret-value',
        'config' => ['phone_number_id' => '1'],
    ])->assertOk();

    $log = AuditLog::where('event', AuditTrail::CHANNEL_CONNECTION_CHANGED)->latest('id')->first();
    expect($log)->not->toBeNull();
    expect($log->context['verb'])->toBe('connected');
    expect(json_encode($log->context))->not->toContain('a-very-secret-value');

    Http::fake(['*' => Http::response(['ok' => true], 200)]);
    $this->withHeaders(adminAuth($this->admin))->postJson('/api/admin/channels/whatsapp/test')->assertOk();
    $log2 = AuditLog::where('event', AuditTrail::CHANNEL_CONNECTION_CHANGED)->latest('id')->first();
    expect($log2->context['verb'])->toBe('tested');

    $this->withHeaders(adminAuth($this->admin))->deleteJson('/api/admin/channels/whatsapp')->assertStatus(204);
    $log3 = AuditLog::where('event', AuditTrail::CHANNEL_CONNECTION_CHANGED)->latest('id')->first();
    expect($log3->context['verb'])->toBe('disconnected');
});
