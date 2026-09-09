<?php

namespace App\Http\Requests;

use App\Enums\ConflictRule;
use App\Enums\IntegrationEvent;
use App\Services\Integrations\SyncFieldMap;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Story 25 (WIS-24). `authorize()` is `true` — the `administrator`
 * middleware plus the policy call are the gate, same reasoning as
 * SaveIntegrationRequest's docblock.
 */
class SaveIntegrationSyncRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'inbound_enabled' => ['required', 'boolean'],
            'inbound_url' => ['nullable', 'string', 'max:2048', 'url:https', 'required_if:inbound_enabled,true'],
            'inbound_field_map' => ['nullable', 'array'],
            'inbound_field_map.*' => ['nullable', 'string', 'max:191'],
            'inbound_field_map.external_id' => ['required_if:inbound_enabled,true', 'nullable', 'string', 'max:191'],
            'conflict_rules' => ['nullable', 'array'],

            'outbound_enabled' => ['required', 'boolean'],
            'outbound_url' => ['nullable', 'string', 'max:2048', 'url:https', 'required_if:outbound_enabled,true'],
            'outbound_events' => ['nullable', 'array'],
            'outbound_events.*' => [Rule::in(IntegrationEvent::values())],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        // The field map's KEYS are a closed set (Decision 5). Rule::in cannot
        // express "every key of this object"; do it here so an unknown key is a
        // 422 and never a silently-ignored stored value.
        $validator->after(function (Validator $v) {
            $allowed = [...SyncFieldMap::FIELDS, SyncFieldMap::EXTERNAL_ID];

            foreach (array_keys((array) $this->input('inbound_field_map', [])) as $key) {
                if (! in_array($key, $allowed, true)) {
                    $v->errors()->add('inbound_field_map', "Unknown field map key: {$key}.");
                }
            }

            foreach ((array) $this->input('conflict_rules', []) as $key => $rule) {
                if (! in_array($key, SyncFieldMap::FIELDS, true)) {
                    $v->errors()->add('conflict_rules', "Unknown conflict rule key: {$key}.");

                    continue;
                }

                if (ConflictRule::tryFrom((string) $rule) === null) {
                    $v->errors()->add('conflict_rules', "Unknown conflict rule value: {$rule}.");
                }
            }
        });
    }
}
