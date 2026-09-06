<?php

use App\Enums\UserRole;
use App\Models\Integration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('creates the row as connected on a passing test, with secret_last_four from the typed secret', function () {
    bindIntegrationTester(true);

    $response = $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => 'sk_test_ABCDEFGH12345678',
    ])->assertOk();

    expect($response->json('data.status'))->toBe('connected');
    expect($response->json('data.secret_last_four'))->toBe('5678');
    expect($response->json('test.ok'))->toBeTrue();

    $row = Integration::where('type', 'erp')->first();
    expect($row->last_checked_at)->not->toBeNull();
    expect($row->secret)->toBe('sk_test_ABCDEFGH12345678');
});

it('keeps the stored secret when a subsequent PUT omits it, and updates the endpoint', function () {
    bindIntegrationTester(true);

    $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => 'sk_test_ABCDEFGH12345678',
    ])->assertOk();

    $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v2',
    ])->assertOk();

    $row = Integration::where('type', 'erp')->first();
    expect($row->endpoint_url)->toBe('https://api.example-erp.test/v2');
    expect($row->secret)->toBe('sk_test_ABCDEFGH12345678');
    expect($row->secret_last_four)->toBe('5678');
});

it('persists the row with status error when the test fails, so Reconnect has something to act on', function () {
    bindIntegrationTester(false, 'integrations.error.unreachable');

    $response = $this->asUser($this->admin)->putJson('/api/admin/integrations/erp', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => 'sk_test_ABCDEFGH12345678',
    ])->assertOk();

    expect($response->json('data.status'))->toBe('error');
    expect($response->json('test.ok'))->toBeFalse();

    $row = Integration::where('type', 'erp')->first();
    expect($row->status)->toBe('error');
    expect($row->last_error)->toBe('integrations.error.unreachable');
    expect($row->last_check_failed_at)->not->toBeNull();
});
