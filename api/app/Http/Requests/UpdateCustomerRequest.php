<?php

namespace App\Http\Requests;

use App\Enums\CustomerTier;
use App\Models\Customer;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateCustomerRequest extends FormRequest
{
    public ?Customer $duplicateCustomer = null;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var Customer $customer */
        $customer = $this->route('customer');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email:rfc', 'max:255',
                Rule::unique('customers', 'email')->whereNull('deleted_at')->ignore($customer)],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'company' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tier' => ['sometimes', 'nullable', Rule::in(CustomerTier::values())],
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
            /** @var Customer $customer */
            $customer = $this->route('customer');

            // Merged result — the existing value, patched by whatever the
            // request actually sent — not the patch alone.
            $email = $this->has('email') ? $this->input('email') : $customer->email;
            $phone = $this->has('phone') ? $this->input('phone') : $customer->phone;

            if (blank($email) && blank($phone)) {
                $validator->errors()->add('email', 'Add an email address or a phone number.');
            }

            if ($validator->errors()->has('email') && filled($email)) {
                $this->duplicateCustomer ??= Customer::whereNull('deleted_at')
                    ->where('email', $email)
                    ->where('id', '!=', $customer->id)
                    ->first();
            }

            if (! $this->duplicateCustomer && filled($phone)) {
                $candidates = Customer::phoneMatchCandidates($phone);

                if ($candidates) {
                    $existing = Customer::whereNull('deleted_at')
                        ->whereIn('phone_normalized', $candidates)
                        ->where('id', '!=', $customer->id)
                        ->first();

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
