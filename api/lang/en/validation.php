<?php

/*
|--------------------------------------------------------------------------
| Validation Language Lines (Story 15 / WIS-11)
|--------------------------------------------------------------------------
|
| The standard Laravel set, published so the Arabic counterpart in
| lang/ar/validation.php has a key-for-key parity target. `attributes` holds
| the human names that interpolate into `:attribute`; the Arabic file fills
| the same keys with Arabic names so messages read fully in Arabic.
|
*/

return [
    'accepted' => 'The :attribute field must be accepted.',
    'accepted_if' => 'The :attribute field must be accepted when :other is :value.',
    'active_url' => 'The :attribute field must be a valid URL.',
    'after' => 'The :attribute field must be a date after :date.',
    'after_or_equal' => 'The :attribute field must be a date after or equal to :date.',
    'alpha' => 'The :attribute field must only contain letters.',
    'alpha_dash' => 'The :attribute field must only contain letters, numbers, dashes, and underscores.',
    'alpha_num' => 'The :attribute field must only contain letters and numbers.',
    'array' => 'The :attribute field must be an array.',
    'ascii' => 'The :attribute field must only contain single-byte alphanumeric characters and symbols.',
    'before' => 'The :attribute field must be a date before :date.',
    'before_or_equal' => 'The :attribute field must be a date before or equal to :date.',
    'between' => [
        'array' => 'The :attribute field must have between :min and :max items.',
        'file' => 'The :attribute field must be between :min and :max kilobytes.',
        'numeric' => 'The :attribute field must be between :min and :max.',
        'string' => 'The :attribute field must be between :min and :max characters.',
    ],
    'boolean' => 'The :attribute field must be true or false.',
    'can' => 'The :attribute field contains an unauthorized value.',
    'confirmed' => 'The :attribute field confirmation does not match.',
    'contains' => 'The :attribute field is missing a required value.',
    'current_password' => 'The password is incorrect.',
    'date' => 'The :attribute field must be a valid date.',
    'date_equals' => 'The :attribute field must be a date equal to :date.',
    'date_format' => 'The :attribute field must match the format :format.',
    'decimal' => 'The :attribute field must have :decimal decimal places.',
    'declined' => 'The :attribute field must be declined.',
    'declined_if' => 'The :attribute field must be declined when :other is :value.',
    'different' => 'The :attribute field and :other must be different.',
    'digits' => 'The :attribute field must be :digits digits.',
    'digits_between' => 'The :attribute field must be between :min and :max digits.',
    'dimensions' => 'The :attribute field has invalid image dimensions.',
    'distinct' => 'The :attribute field has a duplicate value.',
    'doesnt_end_with' => 'The :attribute field must not end with one of the following: :values.',
    'doesnt_start_with' => 'The :attribute field must not start with one of the following: :values.',
    'email' => 'The :attribute field must be a valid email address.',
    'ends_with' => 'The :attribute field must end with one of the following: :values.',
    'enum' => 'The selected :attribute is invalid.',
    'exists' => 'The selected :attribute is invalid.',
    'extensions' => 'The :attribute field must have one of the following extensions: :values.',
    'file' => 'The :attribute field must be a file.',
    'filled' => 'The :attribute field must have a value.',
    'gt' => [
        'array' => 'The :attribute field must have more than :value items.',
        'file' => 'The :attribute field must be greater than :value kilobytes.',
        'numeric' => 'The :attribute field must be greater than :value.',
        'string' => 'The :attribute field must be greater than :value characters.',
    ],
    'gte' => [
        'array' => 'The :attribute field must have :value items or more.',
        'file' => 'The :attribute field must be greater than or equal to :value kilobytes.',
        'numeric' => 'The :attribute field must be greater than or equal to :value.',
        'string' => 'The :attribute field must be greater than or equal to :value characters.',
    ],
    'hex_color' => 'The :attribute field must be a valid hexadecimal color.',
    'image' => 'The :attribute field must be an image.',
    'in' => 'The selected :attribute is invalid.',
    'in_array' => 'The :attribute field must exist in :other.',
    'integer' => 'The :attribute field must be an integer.',
    'ip' => 'The :attribute field must be a valid IP address.',
    'ipv4' => 'The :attribute field must be a valid IPv4 address.',
    'ipv6' => 'The :attribute field must be a valid IPv6 address.',
    'json' => 'The :attribute field must be a valid JSON string.',
    'lowercase' => 'The :attribute field must be lowercase.',
    'lt' => [
        'array' => 'The :attribute field must have less than :value items.',
        'file' => 'The :attribute field must be less than :value kilobytes.',
        'numeric' => 'The :attribute field must be less than :value.',
        'string' => 'The :attribute field must be less than :value characters.',
    ],
    'lte' => [
        'array' => 'The :attribute field must not have more than :value items.',
        'file' => 'The :attribute field must be less than or equal to :value kilobytes.',
        'numeric' => 'The :attribute field must be less than or equal to :value.',
        'string' => 'The :attribute field must be less than or equal to :value characters.',
    ],
    'mac_address' => 'The :attribute field must be a valid MAC address.',
    'max' => [
        'array' => 'The :attribute field must not have more than :max items.',
        'file' => 'The :attribute field must not be greater than :max kilobytes.',
        'numeric' => 'The :attribute field must not be greater than :max.',
        'string' => 'The :attribute field must not be greater than :max characters.',
    ],
    'max_digits' => 'The :attribute field must not have more than :max digits.',
    'mimes' => 'The :attribute field must be a file of type: :values.',
    'mimetypes' => 'The :attribute field must be a file of type: :values.',
    'min' => [
        'array' => 'The :attribute field must have at least :min items.',
        'file' => 'The :attribute field must be at least :min kilobytes.',
        'numeric' => 'The :attribute field must be at least :min.',
        'string' => 'The :attribute field must be at least :min characters.',
    ],
    'min_digits' => 'The :attribute field must have at least :min digits.',
    'missing' => 'The :attribute field must be missing.',
    'missing_if' => 'The :attribute field must be missing when :other is :value.',
    'missing_unless' => 'The :attribute field must be missing unless :other is :value.',
    'missing_with' => 'The :attribute field must be missing when :values is present.',
    'missing_with_all' => 'The :attribute field must be missing when :values are present.',
    'multiple_of' => 'The :attribute field must be a multiple of :value.',
    'not_in' => 'The selected :attribute is invalid.',
    'not_regex' => 'The :attribute field format is invalid.',
    'numeric' => 'The :attribute field must be a number.',
    'password' => [
        'letters' => 'The :attribute field must contain at least one letter.',
        'mixed' => 'The :attribute field must contain at least one uppercase and one lowercase letter.',
        'numbers' => 'The :attribute field must contain at least one number.',
        'symbols' => 'The :attribute field must contain at least one symbol.',
        'uncompromised' => 'The given :attribute has appeared in a data leak. Please choose a different :attribute.',
    ],
    'present' => 'The :attribute field must be present.',
    'present_if' => 'The :attribute field must be present when :other is :value.',
    'present_unless' => 'The :attribute field must be present unless :other is :value.',
    'present_with' => 'The :attribute field must be present when :values is present.',
    'present_with_all' => 'The :attribute field must be present when :values are present.',
    'prohibited' => 'The :attribute field is prohibited.',
    'prohibited_if' => 'The :attribute field is prohibited when :other is :value.',
    'prohibited_unless' => 'The :attribute field is prohibited unless :other is in :values.',
    'prohibits' => 'The :attribute field prohibits :other from being present.',
    'regex' => 'The :attribute field format is invalid.',
    'required' => 'The :attribute field is required.',
    'required_array_keys' => 'The :attribute field must contain entries for: :values.',
    'required_if' => 'The :attribute field is required when :other is :value.',
    'required_if_accepted' => 'The :attribute field is required when :other is accepted.',
    'required_if_declined' => 'The :attribute field is required when :other is declined.',
    'required_unless' => 'The :attribute field is required unless :other is in :values.',
    'required_with' => 'The :attribute field is required when :values is present.',
    'required_with_all' => 'The :attribute field is required when :values are present.',
    'required_without' => 'The :attribute field is required when :values is not present.',
    'required_without_all' => 'The :attribute field is required when none of :values are present.',
    'same' => 'The :attribute field must match :other.',
    'size' => [
        'array' => 'The :attribute field must contain :size items.',
        'file' => 'The :attribute field must be :size kilobytes.',
        'numeric' => 'The :attribute field must be :size.',
        'string' => 'The :attribute field must be :size characters.',
    ],
    'starts_with' => 'The :attribute field must start with one of the following: :values.',
    'string' => 'The :attribute field must be a string.',
    'timezone' => 'The :attribute field must be a valid timezone.',
    'unique' => 'The :attribute has already been taken.',
    'uploaded' => 'The :attribute failed to upload.',
    'uppercase' => 'The :attribute field must be uppercase.',
    'url' => 'The :attribute field must be a valid URL.',
    'ulid' => 'The :attribute field must be a valid ULID.',
    'uuid' => 'The :attribute field must be a valid UUID.',

    /*
    | Story 28 (WIS-29). Form Request messages() overrides moved here so they
    | resolve through the catalogue. `validation.custom` keys are GLOBAL across
    | every Form Request, so a message that must not leak onto a same-named
    | field of another form is keyed under a form-specific prefix and its
    | Form Request keeps a one-line messages() that points here explicitly.
    | English values are byte-identical to the strings that were deleted,
    | except `mimes` (now the framework's :values placeholder) and the two
    | `max` messages (now a :mb replacement), per plan Task 9.
    */
    'custom' => [
        'per_page' => [
            'max' => 'The audit log returns at most :max entries per page.',
        ],
        'branch' => [
            'name_required' => 'Enter a branch name.',
            'name_unique' => 'A branch with that name already exists.',
        ],
        'timezone' => [
            'timezone' => 'Choose a valid timezone.',
        ],
        'primary_color' => [
            'regex' => 'Enter a valid 6-digit hex color, e.g. #4F46E5.',
        ],
        'branch_id' => [
            'required' => 'Choose a branch.',
            'exists' => 'Choose a valid branch.',
        ],
        'department' => [
            'name_required' => 'Enter a department name.',
        ],
        'file' => [
            'max' => 'That file is too large. The limit is :mb MB.',
            'mimes' => 'That file type is not accepted. Allowed types: :types.',
            'required' => 'Choose a file to attach.',
        ],
        'logo' => [
            'max' => 'That file is too large. The limit is :mb MB.',
            'mimes' => 'That file type is not accepted. Allowed types: :types.',
            'image' => 'Choose an image file.',
            'required' => 'Choose a logo to upload.',
        ],
        'email' => [
            'unique' => 'A customer with this email already exists.',
            'duplicate_customer' => 'A customer with this email already exists.',
        ],
        'user_email' => [
            'unique' => 'A user with this email address already exists.',
        ],
        'role' => [
            'required' => 'Select a role. Every user has exactly one.',
        ],
        'ticket_message' => [
            'body_required' => 'Write a reply before sending.',
        ],
        'status' => [
            'invalid_transition' => 'Cannot move a :from ticket to :to.',
        ],
    ],

    'attributes' => [
        'email' => 'email address',
        'password' => 'password',
        'name' => 'name',
        'locale' => 'language',
        'role' => 'role',
        'department' => 'department',
        'subject' => 'subject',
        'body' => 'body',
        'title' => 'title',
        'comment' => 'comment',
        'rating' => 'rating',
        'status' => 'status',
        'priority' => 'priority',
        'customer_id' => 'customer',
        'assignee_id' => 'assignee',

        // Story 28 (WIS-29). The 19 in-scope form fields that had no entry, so
        // Laravel was humanising the raw snake_case identifier into an Arabic
        // sentence. Deliberately omitted: the ~30 query-string / internal
        // params never surfaced in a form error (page, per_page, sort, dir,
        // filter, q, from, to, period, ids, action, actor_id, event, config,
        // settings, conflict_rules, inbound_field_map, outbound_events,
        // verify_token, provider, mentions, is_active, visibility, assigned_to,
        // due_at, at_risk_threshold_pct, auto_close_after_days,
        // escalate_after_minutes, escalate_to_role, escalation_enabled,
        // first_response_minutes, notify_on_breach, resolution_minutes,
        // inbound_enabled, outbound_enabled) — intake §4.
        'phone' => 'phone number',
        'company' => 'company',
        'tier' => 'tier',
        'description' => 'description',
        'category' => 'category',
        'channel' => 'channel',
        'branch_id' => 'branch',
        'region' => 'region',
        'endpoint_url' => 'endpoint URL',
        'inbound_url' => 'inbound URL',
        'outbound_url' => 'outbound URL',
        'primary_color' => 'primary color',
        'logo' => 'logo',
        'file' => 'file',
        'code' => 'code',
        'identifier' => 'identifier',
        'secret' => 'secret',
        'excerpt' => 'excerpt',
        'kb_category_id' => 'category',
    ],
];
