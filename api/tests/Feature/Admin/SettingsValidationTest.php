<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Setting;
use App\Models\User;
use App\Services\AuditTrail;
use App\Services\SystemSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->create([
        'name' => 'System Admin',
        'role' => UserRole::Administrator,
        'is_active' => true,
    ]);

    $this->token = $this->admin->createToken('spa')->plainTextToken;
    $this->asToken($this->token);
});

it('returns every setting with its default until one is stored', function () {
    $response = $this->getJson('/api/admin/settings')->assertOk();

    $keys = collect($response->json('data'))->pluck('key');
    expect($keys)->toContain('password_min_length', 'session_timeout_minutes', 'audit_log_retention_days');

    $minLength = collect($response->json('data'))->firstWhere('key', 'password_min_length');
    expect($minLength['value'])->toBe(8);
    expect($minLength['default'])->toBe(8);
    expect($minLength['min'])->toBe(8);
});

it('rejects a password minimum length of 0', function () {
    $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 0]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings.password_min_length');

    expect(Setting::where('key', 'password_min_length')->exists())->toBeFalse();
});

it('rejects a negative password minimum length', function () {
    $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => -5]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings.password_min_length');
});

it('rejects a non-numeric password minimum length', function () {
    $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 'eight']])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings.password_min_length');
});

it('rejects a value above the ceiling', function () {
    $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 500]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings.password_min_length');
});

it('rejects an unknown setting key rather than silently ignoring it', function () {
    $this->patchJson('/api/admin/settings', ['settings' => ['allow_everything' => true]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings.allow_everything');
});

it('persists a valid change and emits exactly one setting.changed row', function () {
    $response = $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 14]])
        ->assertOk()
        ->assertJsonPath('changed', ['password_min_length']);

    $minLength = collect($response->json('data'))->firstWhere('key', 'password_min_length');
    expect($minLength['value'])->toBe(14);

    expect(app(SystemSettings::class)->get('password_min_length'))->toBe(14);

    $row = AuditLog::where('event', AuditTrail::SETTING_CHANGED)->sole();
    expect($row->user_id)->toBe($this->admin->id);
    expect($row->context['target_id'])->toBe('password_min_length');
    expect($row->context['from'])->toBe(8);
    expect($row->context['to'])->toBe(14);

    expect(Setting::where('key', 'password_min_length')->first()->updated_by)->toBe($this->admin->id);
});

it('writes no audit row when the submitted value is unchanged', function () {
    $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 14]])->assertOk();
    $this->patchJson('/api/admin/settings', ['settings' => ['password_min_length' => 14]])
        ->assertOk()
        ->assertJsonPath('changed', []);

    expect(AuditLog::where('event', AuditTrail::SETTING_CHANGED)->count())->toBe(1);
});

it('updates several settings in one request, one audit row each', function () {
    $this->patchJson('/api/admin/settings', ['settings' => [
        'password_min_length' => 12,
        'session_timeout_minutes' => 60,
        'max_login_attempts' => 3,
    ]])->assertOk();

    expect(AuditLog::where('event', AuditTrail::SETTING_CHANGED)->count())->toBe(3);
});

it('rejects an empty settings payload', function () {
    $this->patchJson('/api/admin/settings', ['settings' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings');
});

it('rejects an audit retention below the 30-day floor and a session timeout below 5 minutes', function () {
    $this->patchJson('/api/admin/settings', ['settings' => ['audit_log_retention_days' => 1]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings.audit_log_retention_days');

    $this->patchJson('/api/admin/settings', ['settings' => ['session_timeout_minutes' => 0]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('settings.session_timeout_minutes');
});
