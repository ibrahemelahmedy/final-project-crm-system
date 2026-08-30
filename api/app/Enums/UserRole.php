<?php

namespace App\Enums;

enum UserRole: string
{
    case Agent = 'agent';
    case TeamLead = 'team_lead';
    case Administrator = 'administrator';

    public function label(): string
    {
        return __('enums.user_role.'.$this->value);
    }

    /** Route the SPA redirects to immediately after login. */
    public function homeRoute(): string
    {
        return match ($this) {
            self::Agent => '/dashboard',
            self::TeamLead => '/dashboard/team',
            self::Administrator => '/dashboard/admin',
        };
    }
}
