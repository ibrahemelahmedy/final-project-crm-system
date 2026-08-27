<?php

namespace Database\Seeders;

use App\Enums\Channel;
use App\Enums\CustomerTier;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\Customer;
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

        // Seed customers — the eight named rows match the design export
        // (WisalCustomers-LightLTR.dc.html lines 84-120) so a running app
        // matches the reference screenshot.
        $customerRows = [
            ['name' => 'Amelia Chen', 'email' => 'amelia.chen@northwind.io', 'company' => 'Northwind Retail', 'tier' => CustomerTier::Enterprise, 'last_contact_at' => '2026-08-22'],
            ['name' => 'Marcus Webb', 'email' => 'marcus.webb@vertex.com', 'company' => 'Vertex Solutions', 'tier' => CustomerTier::Standard, 'last_contact_at' => '2026-08-22'],
            ['name' => 'Priya Nair', 'email' => 'priya.nair@cloudscape.dev', 'company' => 'Cloudscape Inc.', 'tier' => CustomerTier::Enterprise, 'last_contact_at' => '2026-08-21'],
            ['name' => 'Daniel Osei', 'email' => 'd.osei@brightpath.org', 'company' => 'BrightPath Foundation', 'tier' => CustomerTier::Standard, 'last_contact_at' => '2026-08-20'],
            ['name' => 'Laura Kim', 'email' => 'laura.kim@stackforge.io', 'company' => 'StackForge', 'tier' => CustomerTier::Premium, 'last_contact_at' => '2026-08-18'],
            ['name' => 'Nina Fischer', 'email' => 'nina.fischer@globex.eu', 'company' => 'Globex Europe', 'tier' => CustomerTier::Enterprise, 'last_contact_at' => '2026-08-15'],
            ['name' => 'Omar Haddad', 'email' => 'omar.h@medisync.sa', 'company' => 'MediSync', 'tier' => CustomerTier::Standard, 'last_contact_at' => '2026-08-14'],
            ['name' => 'Grace Lin', 'email' => 'grace.lin@paperlane.co', 'company' => 'Paperlane Co.', 'tier' => CustomerTier::Premium, 'last_contact_at' => '2026-08-12'],
        ];

        $namedCustomers = collect($customerRows)->map(fn ($data) => Customer::create($data));

        // One phone-only and one email-only customer, proving the "at least
        // one contact method" path both ways.
        Customer::create([
            'name' => 'Yusuf Al-Rashid',
            'phone' => '+971 50 123 4567',
            'company' => 'Falcon Logistics',
            'tier' => CustomerTier::Standard,
        ]);

        Customer::create([
            'name' => 'Hana Suzuki',
            'email' => 'hana.suzuki@keystone.jp',
            'company' => 'Keystone Partners',
            'tier' => CustomerTier::Premium,
        ]);

        // Enough rows to genuinely exercise pagination (three pages at 25/page).
        Customer::factory()->count(40)->create();

        // Seed tickets for agent1
        Ticket::create([
            'subject' => 'Cannot access email integration',
            'customer_id' => $namedCustomers[0]->id,
            'status' => TicketStatus::Open->value,
            'priority' => Priority::High->value,
            'category' => 'technical',
            'channel' => Channel::Email->value,
            'assigned_to' => $agent1->id,
            'created_by' => $agent1->id,
        ]);

        Ticket::create([
            'subject' => 'Billing inquiry for subscription upgrade',
            'customer_id' => $namedCustomers[1]->id,
            'status' => TicketStatus::Pending->value,
            'priority' => Priority::Normal->value,
            'category' => 'billing',
            'channel' => Channel::Email->value,
            'assigned_to' => $agent1->id,
            'created_by' => $agent1->id,
        ]);

        // Seed tickets for agent2
        Ticket::create([
            'subject' => 'Password reset issue on mobile app',
            'customer_id' => $namedCustomers[2]->id,
            'status' => TicketStatus::Open->value,
            'priority' => Priority::Urgent->value,
            'category' => 'account',
            'channel' => Channel::Chat->value,
            'assigned_to' => $agent2->id,
            'created_by' => $agent2->id,
        ]);

        Ticket::create([
            'subject' => 'Feature request: Export reports to CSV',
            'customer_id' => $namedCustomers[3]->id,
            'status' => TicketStatus::Closed->value,
            'priority' => Priority::Low->value,
            'category' => 'feature_request',
            'channel' => Channel::WebForm->value,
            'assigned_to' => $agent2->id,
            'created_by' => $agent2->id,
        ]);

        // Enough further tickets to make server-side pagination visibly real
        // at 25/page and exercise the "..." in the pagination footer.
        Ticket::factory()->count(20)->assignedTo($agent1)->create();
        Ticket::factory()->count(20)->assignedTo($agent2)->create();
        Ticket::factory()->count(20)->unassigned()->create();
    }
}
