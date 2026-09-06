<?php

namespace App\Http\Requests;

use App\Models\Department;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveDepartmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // required + exists: against an empty `branches` table this can
            // never pass — that IS the "no branch exists yet" boundary.
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'name' => ['required', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'branch_id.required' => 'Choose a branch.',
            'branch_id.exists' => 'Choose a valid branch.',
            'name.required' => 'Enter a department name.',
        ];
    }

    /**
     * A bare Rule::unique('departments', 'name') would wrongly reject two
     * departments of the same name in DIFFERENT branches. The composite
     * (branch_id, name) uniqueness the schema enforces is checked here by
     * hand, ignoring the row being updated.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $branchId = $this->input('branch_id');
            $name = $this->input('name');

            if (! $branchId || ! $name) {
                return;
            }

            $query = Department::query()
                ->where('branch_id', $branchId)
                ->where('name', $name);

            if ($department = $this->route('department')) {
                $query->whereKeyNot($department);
            }

            if ($query->exists()) {
                $validator->errors()->add('name', 'A department with that name already exists in this branch.');
            }
        });
    }
}
