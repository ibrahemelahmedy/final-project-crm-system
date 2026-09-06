<?php

use App\Enums\UserRole;
use App\Models\Integration;
use App\Models\User;
use App\Services\IntegrationConnectionTester;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('writes nothing — no row created, no timestamp touched', function () {
    bindIntegrationTester(true);

    $this->asUser($this->admin)->postJson('/api/admin/integrations/erp/test', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
        'secret' => 'sk_test_ABCDEFGH12345678',
    ])->assertOk()->assertJson(['ok' => true, 'error_key' => null]);

    expect(Integration::count())->toBe(0);
});

it('does not touch an existing row\'s updated_at', function () {
    bindIntegrationTester(true);
    $row = Integration::factory()->create(['type' => 'erp']);
    $updatedAt = $row->updated_at;

    $this->asUser($this->admin)->postJson('/api/admin/integrations/erp/test', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
    ])->assertOk();

    expect($row->fresh()->updated_at->eq($updatedAt))->toBeTrue();
});

it('falls back to the stored endpoint_url and secret when the body omits them', function () {
    $recorder = new class implements IntegrationConnectionTester
    {
        public array $calls = [];

        public function test(string $endpointUrl, ?string $secret): array
        {
            $this->calls[] = [$endpointUrl, $secret];

            return ['ok' => true, 'status' => 200, 'error' => null];
        }
    };
    app()->instance(IntegrationConnectionTester::class, $recorder);

    Integration::factory()->create([
        'type' => 'erp',
        'endpoint_url' => 'https://stored.example-erp.test/v1',
        'secret' => 'sk_stored_00000000',
    ]);

    $this->asUser($this->admin)->postJson('/api/admin/integrations/erp/test', [])->assertOk();

    expect($recorder->calls[0])->toBe(['https://stored.example-erp.test/v1', 'sk_stored_00000000']);
});

it('returns ok:false with the mapped error key on a failing test', function () {
    bindIntegrationTester(false, 'integrations.error.unreachable');

    $this->asUser($this->admin)->postJson('/api/admin/integrations/erp/test', [
        'endpoint_url' => 'https://api.example-erp.test/v1',
    ])->assertOk()->assertJson(['ok' => false, 'error_key' => 'integrations.error.unreachable']);
});
