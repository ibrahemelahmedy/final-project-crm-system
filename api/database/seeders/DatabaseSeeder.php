<?php

namespace Database\Seeders;

use App\Enums\Channel;
use App\Enums\CustomerTier;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Models\CsatSurvey;
use App\Models\Customer;
use App\Models\SlaRule;
use App\Models\Ticket;
use App\Models\TicketMessage;
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

        // One SLA rule per priority tier (Story 06 owns this data long-term;
        // seeded here so the Agent/Team dashboards show real SLA risk).
        foreach ([
            ['priority' => Priority::Urgent->value, 'first_response_minutes' => 30, 'resolution_minutes' => 240],
            ['priority' => Priority::High->value, 'first_response_minutes' => 60, 'resolution_minutes' => 480],
            ['priority' => Priority::Normal->value, 'first_response_minutes' => 240, 'resolution_minutes' => 1440],
            ['priority' => Priority::Low->value, 'first_response_minutes' => 480, 'resolution_minutes' => 2880],
        ] as $rule) {
            SlaRule::updateOrCreate(
                ['priority' => $rule['priority']],
                $rule + [
                    'at_risk_threshold_pct' => 80,
                    'notify_on_breach' => true,
                    'escalation_enabled' => false,
                    'auto_close_after_days' => 5,
                    'is_active' => true,
                ]
            );
        }

        $agent1 = User::create([
            'name' => 'Sarah Ahmed',
            'email' => 'agent@wisal.test',
            'role' => UserRole::Agent,
            'department' => 'Support Ops',
            'is_active' => true,
            'password' => $password,
        ]);

        $agent2 = User::create([
            'name' => 'Tarek Mansour',
            'email' => 'agent2@wisal.test',
            'role' => UserRole::Agent,
            'department' => 'Billing Support',
            'is_active' => true,
            'password' => $password,
        ]);

        User::create([
            'name' => 'Mona Zaki',
            'email' => 'lead@wisal.test',
            'role' => UserRole::TeamLead,
            'department' => 'Support Ops',
            'is_active' => true,
            'password' => $password,
        ]);

        User::create([
            'name' => 'System Admin',
            'email' => 'admin@wisal.test',
            'role' => UserRole::Administrator,
            'department' => 'Platform',
            'is_active' => true,
            'password' => $password,
        ]);

        User::create([
            'name' => 'Disabled User',
            'email' => 'disabled@wisal.test',
            'role' => UserRole::Agent,
            'department' => 'Technical Support',
            'is_active' => false,
            'password' => $password,
        ]);

        // Story 08 — the remaining internal users, so /users shows the
        // design's "14 internal users" across exactly 4 departments
        // (WisalUsers-LightLTR.dc.html). The named rows match the design
        // export; last_login_at drives its relative LAST ACTIVE column, so
        // each one is offset differently to exercise every bucket
        // (Just now / 12m ago / 1h ago / 2d ago / 14d ago / Never).
        foreach ([
            ['James Rodriguez', 'james.r@wisal.io', UserRole::Agent, 'Support Ops', true, 12],
            ['Lena Torres', 'lena.torres@wisal.io', UserRole::Agent, 'Billing Support', true, 60],
            ['Kenji Matsuda', 'kenji.m@wisal.io', UserRole::Administrator, 'Platform', true, 180],
            ['Riya Patel', 'riya.patel@wisal.io', UserRole::Agent, 'Technical Support', true, 2880],
            ['Tom Becker', 'tom.becker@wisal.io', UserRole::Agent, 'Technical Support', false, 20160],
            ['Amina Farouk', 'amina.farouk@wisal.io', UserRole::TeamLead, 'Billing Support', true, 5],
            ['Diego Alvarez', 'diego.alvarez@wisal.io', UserRole::Agent, 'Support Ops', true, 45],
            ['Sofia Marino', 'sofia.marino@wisal.io', UserRole::Agent, 'Platform', true, 720],
            // A never-signed-in invitee — last_login_at stays null, which the
            // LAST ACTIVE column must render as "Never", not a blank cell.
            ['Noor Haddad', 'noor.haddad@wisal.io', UserRole::Agent, 'Technical Support', true, null],
        ] as [$name, $email, $role, $department, $isActive, $minutesAgo]) {
            User::create([
                'name' => $name,
                'email' => $email,
                'role' => $role,
                'department' => $department,
                'is_active' => $isActive,
                'last_login_at' => $minutesAgo === null ? null : now()->subMinutes($minutesAgo),
                'password' => $password,
            ]);
        }

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
        $threadedTicket = Ticket::create([
            'subject' => 'Cannot access email integration',
            'customer_id' => $namedCustomers[0]->id,
            'status' => TicketStatus::Open->value,
            'priority' => Priority::High->value,
            'category' => 'technical',
            'channel' => Channel::Email->value,
            'assigned_to' => $agent1->id,
            'created_by' => $agent1->id,
        ]);

        $mixedChannelTicket = Ticket::create([
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

        // Story 05 — seeded conversation threads. Mixed author types AND
        // channels so GET /api/tickets/{id}/messages demonstrably returns one
        // continuous multi-channel list, and the "Load earlier messages" path
        // is reachable on at least one ticket.
        $this->seedThread($threadedTicket, $agent1, [
            [Channel::Email, false], [Channel::Email, true],
        ], extra: 32);

        $this->seedThread($mixedChannelTicket, $agent1, [
            [Channel::Email, false],
            [Channel::Whatsapp, false],
            [Channel::Email, true],
        ]);

        // agent2's closed CSV ticket stays with zero messages — the Empty state.

        // Story 09 — Knowledge Base categories and articles, including the
        // draft, Arabic, and scripted-body rows the manual verification steps
        // depend on.
        $this->call(KnowledgeBaseSeeder::class);

        // Story 13 — CSAT surveys so the Reports CSAT widget shows a real
        // average and the agent ticket-detail panel has something to render.
        // One outstanding, the rest answered across a spread of ratings and
        // both seeded agents.
        $resolvedTickets = Ticket::query()->whereIn('assigned_to', [$agent1->id, $agent2->id])->take(9)->get();
        $ratings = [5, 4, 4, 3, 5, 2, 4, 5, null];
        foreach ($resolvedTickets as $i => $ticket) {
            $rating = $ratings[$i] ?? 4;
            CsatSurvey::create([
                'ticket_id' => $ticket->id,
                'resolution_cycle' => 1,
                'resolved_by' => $ticket->assigned_to,
                'resolved_at' => now()->subDays($i + 1),
                'rating' => $rating,
                'comment' => $rating !== null && $i % 2 === 0 ? 'The agent was helpful and quick to respond.' : null,
                'responded_at' => $rating === null ? null : now()->subDays($i),
                'expires_at' => now()->subDays($i + 1)->addDays(30),
            ]);
        }

        // Reconcile every customer's last_contact_at with the threads seeded above.
        foreach (Customer::all() as $customer) {
            $latest = TicketMessage::query()
                ->whereIn('ticket_id', Ticket::where('customer_id', $customer->id)->pluck('id'))
                ->max('created_at');

            if ($latest !== null) {
                $customer->forceFill(['last_contact_at' => $latest])->save();
            }
        }
    }

    /**
     * @param  array<int, array{0: Channel, 1: bool}>  $turns  [channel, isAgent]
     */
    private function seedThread(Ticket $ticket, User $agent, array $turns, int $extra = 0): void
    {
        $at = now()->subDays(3);

        $write = function (Channel $channel, bool $isAgent) use ($ticket, $agent, &$at) {
            $at = $at->copy()->addMinutes(fake()->numberBetween(7, 90));

            TicketMessage::create([
                'ticket_id' => $ticket->id,
                'author_type' => $isAgent ? TicketMessage::AUTHOR_AGENT : TicketMessage::AUTHOR_CUSTOMER,
                'user_id' => $isAgent ? $agent->id : null,
                'customer_id' => $isAgent ? null : $ticket->customer_id,
                'channel' => $channel->value,
                'body' => fake()->paragraph(),
                'created_at' => $at,
                'updated_at' => $at,
            ]);
        };

        for ($i = 0; $i < $extra; $i++) {
            $write(Channel::Email, $i % 2 === 1);
        }

        foreach ($turns as [$channel, $isAgent]) {
            $write($channel, $isAgent);
        }
    }
}
