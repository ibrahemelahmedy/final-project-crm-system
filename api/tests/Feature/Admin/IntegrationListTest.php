<?php

use App\Enums\IntegrationType;
use App\Enums\UserRole;
use App\Models\Integration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
});

it('returns all five integration types, in declaration order, as not_connected on a fresh database', function () {
    $response = $this->asUser($this->admin)->getJson('/api/admin/integrations')->assertOk();

    $types = collect($response->json('data'))->pluck('type')->all();

    expect($types)->toBe(['erp', 'email', 'sms', 'whatsapp', 'api_webhook']);

    foreach ($response->json('data') as $row) {
        expect($row['status'])->toBe('not_connected');
    }
});

it('reports a connected type as connected without disturbing the other four', function () {
    Integration::factory()->create(['type' => IntegrationType::Erp->value]);

    $response = $this->asUser($this->admin)->getJson('/api/admin/integrations')->assertOk();

    $byType = collect($response->json('data'))->keyBy('type');

    expect($byType['erp']['status'])->toBe('connected');
    expect($byType['email']['status'])->toBe('not_connected');
    expect($byType['sms']['status'])->toBe('not_connected');
    expect($byType['whatsapp']['status'])->toBe('not_connected');
    expect($byType['api_webhook']['status'])->toBe('not_connected');
    expect($response->json('data.0.type'))->toBe('erp');
});
