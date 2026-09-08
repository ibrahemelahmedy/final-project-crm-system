<?php

namespace Database\Seeders;

use App\Enums\CustomerTier;
use App\Enums\Priority;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Department;
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
        // Every minute value is read straight off the design artboard
        // (WisalSLARules-LightLTR.dc.html). The Urgent 30-minute escalation is
        // the intake's own worked example.
        foreach ([
            [
                'priority' => Priority::Urgent->value,
                'first_response_minutes' => 15, 'resolution_minutes' => 240,
                'notify_on_breach' => true, 'escalation_enabled' => true,
                'escalate_after_minutes' => 30, 'escalate_to_role' => UserRole::Administrator->value,
            ],
            [
                'priority' => Priority::High->value,
                'first_response_minutes' => 60, 'resolution_minutes' => 480,
                'notify_on_breach' => true, 'escalation_enabled' => false,
                'escalate_after_minutes' => null, 'escalate_to_role' => null,
            ],
            [
                'priority' => Priority::Normal->value,
                'first_response_minutes' => 240, 'resolution_minutes' => 1440,
                'notify_on_breach' => false, 'escalation_enabled' => false,
                'escalate_after_minutes' => null, 'escalate_to_role' => null,
            ],
            [
                'priority' => Priority::Low->value,
                'first_response_minutes' => 1440, 'resolution_minutes' => 7200,
                'notify_on_breach' => false, 'escalation_enabled' => false,
                'escalate_after_minutes' => null, 'escalate_to_role' => null,
            ],
        ] as $rule) {
            SlaRule::updateOrCreate(
                ['priority' => $rule['priority']],
                $rule + [
                    'at_risk_threshold_pct' => 80,
                    'auto_close_after_days' => 5,
                    'is_active' => true,
                ]
            );
        }

        // Story 20 (WIS-20) — the four branches and four departments the
        // Organization Settings artboards show. This seeder, not the
        // backfill migration, owns fresh-install branch/department data:
        // migrate:fresh --seed runs migrations before seeders, so the
        // backfill sees zero users at that point and correctly no-ops.
        // `branch_id` / `department_id` below are a SEPARATE taxonomy from
        // the free-text `department` string already used throughout this
        // file (Decision 3) — they need not match 1:1.
        $branchDowntown = Branch::create(['name' => 'Downtown HQ', 'region' => 'Riyadh, SA', 'timezone' => 'Asia/Riyadh', 'is_active' => true]);
        $branchNorth = Branch::create(['name' => 'North Branch', 'region' => 'Jeddah, SA', 'timezone' => 'Asia/Riyadh', 'is_active' => true]);
        $branchEast = Branch::create(['name' => 'East Support Center', 'region' => 'Dammam, SA', 'timezone' => 'Asia/Riyadh', 'is_active' => true]);
        Branch::create(['name' => 'Remote Team', 'region' => null, 'timezone' => 'UTC', 'is_active' => false]);

        $deptTechnical = Department::create(['branch_id' => $branchDowntown->id, 'name' => 'Technical Support', 'is_active' => true]);
        $deptBilling = Department::create(['branch_id' => $branchDowntown->id, 'name' => 'Billing', 'is_active' => true]);
        $deptSuccess = Department::create(['branch_id' => $branchNorth->id, 'name' => 'Customer Success', 'is_active' => true]);
        $deptEscalations = Department::create(['branch_id' => $branchEast->id, 'name' => 'Escalations', 'is_active' => true]);

        // Maps each existing free-text `department` string onto one of the
        // four org-structure departments above, so every seeded user's
        // branch_id/department_id is set and the AGENTS column reads real
        // numbers rather than four zeros.
        $orgAssignment = fn (string $freeTextDepartment) => match ($freeTextDepartment) {
            'Support Ops' => [$branchDowntown, $deptTechnical],
            'Billing Support' => [$branchDowntown, $deptBilling],
            'Platform' => [$branchNorth, $deptSuccess],
            'Technical Support' => [$branchEast, $deptEscalations],
            default => [$branchDowntown, $deptTechnical],
        };

        [$branch, $dept] = $orgAssignment('Support Ops');
        $agent1 = User::create([
            'name' => 'Sarah Ahmed',
            'email' => 'agent@wisal.test',
            'role' => UserRole::Agent,
            'department' => 'Support Ops',
            'branch_id' => $branch->id,
            'department_id' => $dept->id,
            'is_active' => true,
            'password' => $password,
        ]);

        [$branch, $dept] = $orgAssignment('Billing Support');
        $agent2 = User::create([
            'name' => 'Tarek Mansour',
            'email' => 'agent2@wisal.test',
            'role' => UserRole::Agent,
            'department' => 'Billing Support',
            'branch_id' => $branch->id,
            'department_id' => $dept->id,
            'is_active' => true,
            'password' => $password,
        ]);

        [$branch, $dept] = $orgAssignment('Support Ops');
        User::create([
            'name' => 'Mona Zaki',
            'email' => 'lead@wisal.test',
            'role' => UserRole::TeamLead,
            'department' => 'Support Ops',
            'branch_id' => $branch->id,
            'department_id' => $dept->id,
            'is_active' => true,
            'password' => $password,
        ]);

        [$branch, $dept] = $orgAssignment('Platform');
        User::create([
            'name' => 'System Admin',
            'email' => 'admin@wisal.test',
            'role' => UserRole::Administrator,
            'department' => 'Platform',
            'branch_id' => $branch->id,
            'department_id' => $dept->id,
            'is_active' => true,
            'password' => $password,
        ]);

        [$branch, $dept] = $orgAssignment('Technical Support');
        User::create([
            'name' => 'Disabled User',
            'email' => 'disabled@wisal.test',
            'role' => UserRole::Agent,
            'department' => 'Technical Support',
            'branch_id' => $branch->id,
            'department_id' => $dept->id,
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
            [$branch, $dept] = $orgAssignment($department);

            User::create([
                'name' => $name,
                'email' => $email,
                'role' => $role,
                'department' => $department,
                'branch_id' => $branch->id,
                'department_id' => $dept->id,
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

        // Story 09 — Knowledge Base categories and articles, including the
        // draft, Arabic, and scripted-body rows the manual verification steps
        // depend on.
        $this->call(KnowledgeBaseSeeder::class);

        // Story 21 (WIS-25) — 64 realistic tickets with coherent threads, a
        // six-week timeline and SLA state recomputed from the real created date.
        // See TicketScenarioSeeder's docblock for what is deliberately seeded.
        $this->call(TicketScenarioSeeder::class);

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
}
