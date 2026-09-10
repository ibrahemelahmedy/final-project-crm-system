<?php

namespace App\Http\Requests;

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Story 26 (WIS-22), Task 38. `secret` / `verify_token` are three-state
 * (absent = keep stored value, empty string = clear, non-empty = replace) —
 * the same contract SaveIntegrationRequest uses. `config` has NO wildcard:
 * an unlisted key is dropped by validated(), which is what keeps a
 * credential out of the config blob (Edge Case 33).
 */
class SaveChannelConnectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (! ($this->user()?->can('update', ChannelConnection::class) ?? false)) {
            return false;
        }

        // A validation failure (Edge Case 29) is a 422, but web_form — and
        // any value outside Channel::connectable() — must 404 like every
        // other {channel}/{type}-shaped admin route, and this check must run
        // BEFORE rules()/withValidator() or the provider/channel mismatch
        // rule below fires first (every provider "mismatches" web_form,
        // since none serves it) and masks the 404 with a 422.
        $channel = Channel::tryFrom((string) $this->route('channel'));

        if ($channel === null || ! in_array($channel, Channel::connectable(), true)) {
            abort(404);
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'provider' => ['required', Rule::in(ChannelProvider::values())],
            'secret' => ['nullable', 'string', 'max:500'],
            'verify_token' => ['nullable', 'string', 'max:255'],
            'config' => ['array'],
            'config.phone_number_id' => ['nullable', 'string', 'max:64'],
            'config.from_number' => ['nullable', 'string', 'max:32'],
            'config.account_sid' => ['nullable', 'string', 'max:64'],
            'config.inbound_address' => ['nullable', 'string', 'max:191'],
            'config.allowed_origins' => ['nullable', 'array', 'max:10'],
            'config.allowed_origins.*' => ['url'],
            'config.site_key' => ['nullable', 'string', 'max:191'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $provider = ChannelProvider::tryFrom((string) $this->input('provider'));
            $channel = $this->route('channel');

            if ($provider !== null && $channel !== null && $provider->channel()->value !== $channel) {
                $validator->errors()->add('provider', 'The selected provider does not serve this channel.');
            }
        });
    }
}
