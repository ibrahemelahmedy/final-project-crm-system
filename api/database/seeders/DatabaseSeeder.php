<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $password = Hash::make('Password123!');

        $agent1 = User::create([
            'name' => 'Sarah Ahmed',
            'email' => 'agent@wisal.test',
            'role' => UserRole::Agent,
            'is_active' => true,
            'password' => $password,
        ]);

        $agent2 = User::create([
            'name' => 'Tarek Mansour',
            'email' => 'agent2@wisal.test',
            'role' => UserRole::Agent,
            'is_active' => true,
            'password' => $password,
        ]);

        User::create([
            'name' => 'Mona Zaki',
            'email' => 'lead@wisal.test',
            'role' => UserRole::TeamLead,
            'is_active' => true,
            'password' => $password,
        ]);

        User::create([
            'name' => 'System Admin',
            'email' => 'admin@wisal.test',
            'role' => UserRole::Administrator,
            'is_active' => true,
            'password' => $password,
        ]);

        User::create([
            'name' => 'Disabled User',
            'email' => 'disabled@wisal.test',
            'role' => UserRole::Agent,
            'is_active' => false,
            'password' => $password,
        ]);

        // Seed tickets for agent1
        Ticket::create([
            'subject' => 'Cannot access email integration',
            'status' => 'open',
            'priority' => 'high',
            'assigned_to' => $agent1->id,
        ]);

        Ticket::create([
            'subject' => 'Billing inquiry for subscription upgrade',
            'status' => 'pending',
            'priority' => 'normal',
            'assigned_to' => $agent1->id,
        ]);

        // Seed tickets for agent2
        Ticket::create([
            'subject' => 'Password reset issue on mobile app',
            'status' => 'open',
            'priority' => 'urgent',
            'assigned_to' => $agent2->id,
        ]);

        Ticket::create([
            'subject' => 'Feature request: Export reports to CSV',
            'status' => 'closed',
            'priority' => 'low',
            'assigned_to' => $agent2->id,
        ]);
    }
}
