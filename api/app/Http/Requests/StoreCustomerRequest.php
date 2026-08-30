<?php

namespace App\Http\Requests;

use App\Enums\CustomerTier;
use App\Models\Customer;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
{
    public ?Customer $duplicateCustomer = null;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email:rfc', 'max:255',
                Rule::unique('customers', 'email')->whereNull('deleted_at')],
            'phone' => ['nullable', 'string', 'max:32'],
            'company' => ['nullable', 'string', 'max:255'],
            'tier' => ['nullable', Rule::in(CustomerTier::values())],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'A customer with this email already exists.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email') && $this->input('email') !== null) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }
    }

    public function withValidator(ValidatorContract $validator): void
    {
        $validator->after(function (ValidatorContract $validator) {
            $email = $this->input('email');
            $phone = $this->input('phone');

            // "Name plus at least one of email or phone" — attached to the
            // email field so react-hook-form's setError can render it inline.
            if (blank($email) && blank($phone)) {
                $validator->errors()->add('email', 'Add an email address or a phone number.');
            }

            // Resolve the record behind an email uniqueness failure so the
            // 422 payload can carry duplicate_customer_id / _name.
            if ($validator->errors()->has('email') && filled($email)) {
                $this->duplicateCustomer ??= Customer::whereNull('deleted_at')->where('email', $email)->first();
            }

            // Phone uniqueness can't be a plain unique() rule — the stored
            // column is the display form. Check the normalized value here.
            if (! $this->duplicateCustomer && filled($phone)) {
                $candidates = Customer::phoneMatchCandidates($phone);

                if ($candidates) {
                    $existing = Customer::whereNull('deleted_at')->whereIn('phone_normalized', $candidates)->first();

                    if ($existing) {
                        $validator->errors()->add('phone', 'A customer with this phone number already exists.');
                        $this->duplicateCustomer = $existing;
                    }
                }
            }
        });
    }

    protected function failedValidation(ValidatorContract $validator)
    {
        $errors = $validator->errors();

        $payload = [
            'message' => $errors->first() ?: 'The given data was invalid.',
            'errors' => $errors->toArray(),
        ];

        if ($this->duplicateCustomer) {
            $payload['duplicate_customer_id'] = $this->duplicateCustomer->id;
            $payload['duplicate_customer_name'] = $this->duplicateCustomer->name;
        }

        throw new HttpResponseException(response()->json($payload, 422));
    }
}
