# Story 06 — SLA Rules & Automation (Story: WIS-6)

## Prerequisites

- **Story 04 completed** — [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md). **Read its `## Shared contracts this story establishes` section (from line 1463) before writing a single line of this story.** Everything below binds to it:
  - `App\Enums\Priority` — cases `low`, `normal`, `high`, `urgent`. `Priority::weight()` / `Priority::sortExpression()` are the **only** ordering authority. This story does **not** write a parallel weight map.
  - `App\Enums\TicketStatus` — cases `open`, `pending`, `resolved`, `closed`. `TicketStatus::allowedTransitions()` / `canTransitionTo()` is the **sole** transition authority. The auto-close action in Task 7 goes through it; it does **not** write `status = 'closed'` directly.
  - `tickets` has `resolved_at` and `closed_at`, and **`resolved_at` is cleared when a ticket leaves `Resolved`**. The auto-close rule depends on that being true.
  - **`ticket_events` is the one append-only ticket-history table.** This story appends three new `event` values to it. It creates **no** second history table and writes **nothing** into Story 01's `audit_logs`.
  - **`TicketResource` already ships a fixed `sla: { due_at, minutes_left, risk }` block**, `sla.risk` one of `"breached" | "at_risk" | "ok" | null`, currently `null` for every ticket. **This story fills those three values and must not add, rename, or remove a key.** The queue's `SlaCell.tsx` is already written against all four `risk` cases.
  - Frontend: `ticketKeys` in `web/src/features/tickets/api/queryKeys.ts` is the one ticket keying scheme; **the `--sla-breached` / `--sla-at-risk` / `--sla-ok` / `--sla-none` and `--prio-*` tokens in `web/src/index.css` are reused, never redefined.**
- **Story 02 completed and committed** — [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md). It created the `/sla-rules` route rendering `PagePlaceholder`, which this story replaces.
  - **No `navItems.tsx` edit is required.** Verified: `web/src/app/navigation/navItems.tsx` already carries the `SLA Rules` entry (`labelKey: 'nav.slaRules'`, `to: '/sla-rules'`, `group: 'admin'`, `roles: ['administrator']`) with the shield-check icon. `src/app/navigation/navItems.test.ts` lines 12, 19 and 26 already assert Agent and Team Lead do not see it and Administrator does. **Do not touch either file.**
  - `web/src/App.tsx` already wraps `/sla-rules` in `<RequireAuth roles={['administrator']}>`. This story swaps only the `element` inside that wrapper.
- **Story 03 completed** — [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md), transitively, because `tickets.customer_id` is NOT NULL after Story 04.
- **Verified toolchain state** (checked at plan time — `STATUS.md` is stale on both the framework version and the database, do not repeat its errors):

  | Fact | Verified value | Source |
  |---|---|---|
  | Framework | **Laravel 13.17**, PHP `^8.3` | `api/composer.json` lines 9–10 |
  | Test runner (API) | **Pest 5.1** + `pest-plugin-laravel` 5.0 | `api/composer.json` lines 21–22 |
  | Runtime database | **PostgreSQL (Supabase)** — `DB_CONNECTION=pgsql` | `api/.env` line 23 |
  | Test database | **SQLite `:memory:`** | `api/phpunit.xml` (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`) |
  | Queue connection | **`database`** at runtime, **`sync`** under test | `api/.env` line 38; `api/phpunit.xml` |
  | Jobs table | Exists — `api/database/migrations/0001_01_01_000002_create_jobs_table.php` | `ls api/database/migrations` |
  | Scheduler | **Nothing is scheduled.** `api/routes/console.php` contains only the stock `inspire` command (lines 6–8) | `cat api/routes/console.php` |
  | `app/Console/` | **Does not exist.** Task 6 creates it | `ls api/app` → `Enums Http Models Policies Providers` |
  | Frontend | react 19.2.8 · react-router-dom 7.18.2 · @tanstack/react-query 5.102.3 · zod 4.4.3 · react-hook-form 7.86.0 · @hookform/resolvers 5.9.1 · vitest 4.1.11 · oxlint 1.79.0 | `web/package.json` |
  | Frontend test command | **`npx vitest run`** — there is **no `test` script** in `web/package.json` | `web/package.json` scripts block |

- **Every timestamp comparison this story runs in SQL is a plain `column <= ?` against a PHP-computed value.** No `INTERVAL`, no `DATE_ADD`, no `julianday()`, no `EXTRACT`, no `NOW()` inside SQL — none of those are portable across PostgreSQL and SQLite, and this story is built entirely on date arithmetic. **All arithmetic happens in PHP with Carbon; the database only compares.** That single rule is why Task 2 stores four precomputed timestamps instead of one target duration.

---

## Story Goal

Make the SLA-risk indicator real. Today `TicketResource` returns `sla: { due_at: null, minutes_left: null, risk: null }` for every ticket and the queue renders a dash. After this story, an Administrator configures a response and resolution target per priority tier; every ticket carries computed due dates; one backend service classifies risk; and a scheduled command escalates, notifies, and auto-closes without anyone opening a screen.

User-visible outcomes:

1. An **Administrator** opens `/sla-rules` and sees one card per priority tier — **URGENT · HIGH · NORMAL · LOW** — each showing **RESPOND WITHIN**, **RESOLVE WITHIN**, and **ON BREACH**, and edits any of them in a modal.
2. A **new ticket** with no explicit assignee is auto-assigned by a **least-open-load** rule, and the decision is written to `ticket_events`.
3. A ticket that has consumed its at-risk threshold (**80%** of the resolution target by default, configurable per tier) reports `sla.risk = "at_risk"` **everywhere** — Queue, Conversation Thread, Agent Dashboard — because all three read one service.
4. A ticket past its resolution target reports `sla.risk = "breached"`, and an in-app notification fires to the assigned agent and to every active Team Lead.
5. While a ticket is **Pending** (waiting on the customer), the SLA clock **pauses**; the paused interval is added back to the due dates when it leaves Pending, so pending time never counts against the agent.
6. An escalation rule fires **on a schedule**, not on a page view: an Urgent ticket unresponded past its escalation point is reassigned upward and stamped `escalated_at`.
7. A **Resolved** ticket with no further activity auto-closes after the configured number of days.
8. Editing an SLA rule **never** changes the risk state of an existing ticket. Structurally guaranteed by Task 2: every due date is an **absolute timestamp stored on the ticket at creation**, so nothing is re-derived from the rule at read time.

**In scope beyond the obvious:** the `sla_rules` table and its admin CRUD, eleven new `tickets` columns, one `SlaClock` service that is the only place threshold math exists, one Artisan command plus its schedule registration, the auto-assignment picker, and the `/sla-rules` screen with all four async states.

**Explicitly NOT in scope:**

- **The `tickets` table's core columns, the three enums, and the Ticket Queue UI** → Story 04. This story adds columns in **its own** migration and edits exactly one method of `TicketResource`.
- **The message timeline** → Story 05. This story ships `first_response_at` and the single method that stamps it; Story 05 adds the second, earlier caller.
- **Reports, charts and the compliance dashboard** → Story 12. This story ships the compliance figures as a service method; Story 12 renders them.
- **Real outbound delivery** (email/SMS/WhatsApp). An "alert" here is an in-app notification row. The notification table, enum and dispatcher are **Story 11's** — see Task 8 for the exact seam.
- **ML-based routing.** Auto-assignment is rule-based.
- **A working-hours / business-day calendar.** See the Product-rules table — this is a deliberate decision, not an omission.
- **Narrowing `Ticket::scopeVisibleTo()` to a real team.** That debt belongs to Story 08 and is untouched here.

---

## Context — Read These Files First

1. `docs/design/references/7.Admin Reports/WisalSLARules-LightLTR.dc.html` — **the primary reference. Build from it; do not invent UI.** 129 lines, one artboard. Read:
   - **Lines 72–75** — the page header: title `SLA Rules` at `font-size:22px; font-weight:700`; subtitle `4 active rules · applied by priority` at `13px` `#64748B` with `margin-top:2px`; the primary **Add Rule** button on the trailing side (`background:#4F46E5; color:#fff; border-radius:8px; padding:9px 16px; 13px/600`) with the plus glyph `M12 5v14 M5 12h14`.
   - **Line 71** — the content container: `padding:24px 28px; display:flex; flex-direction:column; gap:16px`.
   - **Line 77** — the card list: `flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px`.
   - **Lines 78–86 (URGENT), 88–96 (HIGH), 98–106 (NORMAL), 108–116 (LOW)** — the four rule cards. Every card is `background:#fff; border:1px solid <tint>; border-left:4px solid <tier>; border-radius:10px; padding:18px 20px; display:flex; align-items:center; gap:20px`.
   - **Line 79** — the tier badge: `11px/700`, `border-radius:6px`, `padding:5px 10px`, `flex-shrink:0`. Urgent is `#B91C1C` on `#FEF2F2`; High (line 89) `#B45309` on `#FFFBEB`; Normal (line 99) `#2563EB` on `#EFF6FF`; Low (line 109) `#64748B` on `#F1F5F9`. **These are Story 04's `--prio-*` badge values — reuse the token, do not re-enter the hex.**
   - **Lines 80–84** — the three fact columns inside `display:flex; gap:36px`. Each is a `11px/700 #94A3B8 letter-spacing:.04em` label over a `16px/700 #0F172A` value. The third column's value is `14px/600` and carries the pencil glyph `M4 20h4l11-11-4-4L4 16z M14.5 5.5l4 4`.
   - **Line 85** — the trailing edit button: `34px` square, `border-radius:8px`, `border:1px solid #E2E8F0`, same pencil glyph.
   - **The exact copy to ship**, verbatim: labels `RESPOND WITHIN` · `RESOLVE WITHIN` · `ON BREACH`; values `15 minutes` / `4 hours` (Urgent), `1 hour` / `8 hours` (High), `4 hours` / `24 hours` (Normal), `1 business day` / `5 business days` (Low — **see the Product-rules table, this renders as `1 day` / `5 days`**); breach actions `Notify Team Lead + escalate to Administrator`, `Notify Team Lead`, `Flag in queue, no escalation`, `No escalation`.
2. `docs/design/references/7.Admin Reports/WisalSLARules-DarkLTR.dc.html` — the dark palette, same 129-line structure. Read **lines 78, 88, 98, 108** (`background:#1C1D24; border:1px solid #2A2C33` — **the dark card's full border is the neutral card border, not a tinted one; only the `border-left` accent is tiered**), **line 79** (`rgba(248,113,113,0.14)` fill, `#F87171` text), **line 89** (`rgba(251,191,36,0.14)` / `#FBBF24`), **line 99** (`rgba(96,165,250,0.14)` / `#60A5FA`), **line 109** (`#202128` / `#94A3B8`), and the ON BREACH text colours **`#F87171` / `#FBBF24` / `#CBD5E1` / `#CBD5E1`**.
3. `docs/design/references/7.Admin Reports/WisalSLARules-LightRTL.dc.html` — read to learn **what mirroring means here, then implement it with logical properties.** Note **line 21** (`dir="rtl"`, font switches to `'IBM Plex Sans Arabic'`), **lines 69, 79, 89, 99** (the export hand-mirrors `border-left:4px` → `border-right:4px` — **ship `border-inline-start` instead of two rules**), and **line 64** (the count `4` is wrapped in `direction:ltr; display:inline-block` — a numeral inside Arabic copy does not mirror).
4. **Grep the export before porting any CSS.** `WisalSLARules-LightLTR.dc.html` line 14 defines `.fv:focus-visible` but the dark artboard uses `class="fvd"` with **no matching rule** — the recurring export defect named in `STATUS.md` lines 49–53. Every focus ring on this screen is new work.
5. [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md) — **`## Shared contracts this story establishes`, from line 1463, in full.** Also read **lines 933–968** (the `--sla-*` and `--prio-*` token table and the four `index.css` blocks they live in), **lines 969–1000** (`SlaRisk` / `TicketSla` TypeScript types — **already written for this story**), and **lines 1169–1179** (`SlaCell.tsx`, whose `breached` / `at_risk` / `ok` branches already exist and go live unchanged when this story returns non-null values).
6. `api/app/Models/Ticket.php` — the current file is the **Story 01 scaffold**: `$fillable` lines 14–19, `assignee()` lines 21–24, `scopeVisibleTo()` lines 26–32. **Story 04 has already rewritten this file** by the time this story executes; read the shipped version, not the scaffold. Confirm `casts()` returns `status => TicketStatus::class` and `priority => Priority::class` before writing Task 3.
7. `api/app/Models/User.php` — `casts()` **lines 31–40**, `isAdministrator()` **lines 42–45**, `canSeeTeamQueue()` **lines 47–50**. Task 4 adds one `hasMany` relation to this file and changes nothing else.
8. `api/app/Policies/TicketPolicy.php` — `viewAny()` **line 10**, `view()` **line 15**. Story 04 adds `create()`, `update()`, `assign()`. Task 5 calls `assign()`; it does not add a policy method to this file.
9. `api/routes/console.php` — **8 lines, the stock `inspire` command only.** Task 6 appends the schedule registration here. This is the file `bootstrap/app.php` names as `commands:` in its `withRouting()` call.
10. `api/routes/api.php` — the `auth:sanctum` group, **lines 14–18**. Story 04 expands it to seven ticket routes; this story appends four `/sla-rules` routes **inside the same group**. **Do not add a middleware group, a prefix, or a throttle** — `SecurityHeaders` and CORS already apply globally.
11. `api/database/migrations/` — Story 04's migrations are `2026_08_26_100000_expand_tickets_table.php`, `2026_08_26_100100_*`, `2026_08_26_100200_create_ticket_events_table.php`. **`ls` this directory before naming your migration files** and pick timestamps that sort after everything present, Story 05's included.
12. `api/database/seeders/DatabaseSeeder.php` — Story 04 rewrites it. Note the pre-existing shape: four users at lines 20–58 (`agent@wisal.test`, `agent2@wisal.test`, `lead@wisal.test`, `admin@wisal.test`, password `Password123!`) and four tickets at lines 61–87 including `'status' => 'pending'` and `'status' => 'closed'`. Task 9 appends the four SLA rules; it does not restructure what is there.
13. `api/tests/Pest.php` — **one line: `pest()->extend(TestCase::class)->in('Feature');`.** Only `tests/Feature` gets the Laravel `TestCase`. Any test that touches the container, the database, or `RefreshDatabase` **must live in `tests/Feature/`**. `tests/Unit/` is empty and gets no application bootstrap.
14. `api/tests/Feature/TicketScopeTest.php` — the existing fixture, `uses(RefreshDatabase::class)` at line 8, users created at lines 10–31. **Its assertions must stay green and unchanged**; the `sla` object gaining values must not break them.
15. `web/src/App.tsx` — the `/sla-rules` route and its `<RequireAuth roles={['administrator']}>` wrapper. Task 12 replaces `<PagePlaceholder title="SLA Rules" />` and **nothing else in this file**.
16. `web/src/app/navigation/navItems.tsx` — read only to **confirm no edit is needed**. The `nav.slaRules` entry is already there under `group: 'admin'` with `roles: ['administrator']`.
17. `web/src/app/navigation/navRoutes.test.tsx` — **line 57** builds its own local route tree from the manifest with `PagePlaceholder`; it does **not** import `App.tsx`. It stays green after Task 12 with no edit.
18. `web/src/lib/api.ts` — the shared Axios instance with its bearer interceptor. **Do not create a second client.**
19. `web/src/index.css` — the **four** token blocks: bare `:root` (light, from line 20), `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` (line 48), `:root[data-theme="dark"]` (line 76), `:root[data-theme="light"]` (line 100). **Any new token is declared in all four.**
20. [`../agent-dashboard/07-story-agent-dashboard.md`](../agent-dashboard/07-story-agent-dashboard.md) — **lines 107–113** (the endpoint table that consumes this story's computation), **lines 193–195** (null-SLA tickets are excluded, not counted compliant), **lines 207–209** (its *stated uncertainty* about where escalation lives — **this story resolves it**; see Shared contracts).
21. [`../notifications/11-story-notifications-centre.md`](../notifications/11-story-notifications-centre.md) — **lines 122–148** (the `NotificationType` enum, with `sla_at_risk` and `sla_breached` naming this story as producer, and the `NotificationDispatcher::dispatch()` signature). **Story 11 executes after this one**; Task 8 defines the seam that keeps both true.
22. [`../reports-dashboards/12-story-reports-dashboards.md`](../reports-dashboards/12-story-reports-dashboards.md) — **lines 155–161** (the `sla` block of its payload: `compliance_rate`, `target_rate`, `breach_rate`, `avg_resolution_minutes`) and **lines 277–284** (its stated uncertainty about this service's signature — Task 4's `complianceBetween()` resolves it).
23. `docs/design/brief.md` — **lines 96–110** (the `priority` and `badge_text_on_tint` token blocks, **binding**), **lines 181–187** (all four states required per view, plus a **Confirmation** state naming the specific record for destructive actions), **lines 189–197** (`outline: none` without a replacement is **forbidden**; `prefers-reduced-motion` respected; **colour is never the only signal**), **lines 199–206** (RTL mirrors layout and directional icons, not only text alignment), **line 217** (do not conflate priority and status).

---

## Product rules — where this plan resolves a conflict

Each row is a decision. Do not silently revert one.

| Source says | This plan does | Why |
|---|---|---|
| The design card reads **`1 business day`** / **`5 business days`** for Low | Store **minutes** (`1440` / `7200`) and render **`1 day`** / **`5 days`** | No working-hours calendar, holiday table, or timezone-per-agent model exists anywhere in this project. Rendering "business day" while the clock counts wall-clock minutes would make the card and the countdown disagree by up to 16 hours per day — the exact drift the intake's last acceptance criterion forbids. The word is dropped; the number is honest. A calendar model is a later story, and adding one changes only `SlaClock::dueFrom()`. |
| The design header reads **`4 active rules · applied by priority`** and offers **Add Rule** | `priority` is **`unique`** on `sla_rules`. **Add Rule** is `disabled` when all four tiers have a rule, with `title` / `aria-describedby` reading **"Every priority tier already has a rule"** | Four tiers, four cards, "applied by priority" — a fifth rule has no tier to apply to and a second Urgent rule creates an ambiguity with no tiebreak. The button ships and works whenever a tier is vacant (a deactivated rule, or a database seeded without `DatabaseSeeder`). A disabled control with a stated reason beats a control that produces a 422. |
| The intake names escalation as **"Urgent unresponded for 30 min → reassign to Team Lead"**; the design card names it as an **ON BREACH** action | **One** trigger column, `escalate_at`, computed at ticket creation: `first_response_due_at + escalate_after_minutes` when that value is set, otherwise `resolution_due_at` | Two independent trigger paths mean two queries, two idempotency guards, and two ways to double-escalate. One nullable rule field expresses both behaviours, and the engine runs one plain timestamp comparison. Seeded: Urgent escalates 30 minutes after its response target (the intake's own example); High has escalation off and notification on (the design's "Notify Team Lead"). |
| The intake: an at-risk threshold of **"e.g. 80%, configurable"** | `sla_rules.at_risk_threshold_pct`, `unsignedTinyInteger`, **default 80**, validated `1..99`; the resulting boundary is **precomputed into `tickets.sla_at_risk_at`** | A percentage is per-ticket arithmetic. Evaluating `now >= due - (1 - pct/100) * target` in SQL needs interval arithmetic that is written differently on PostgreSQL and SQLite — and the test suite runs one while production runs the other. Precomputing the boundary in PHP at creation turns the engine's hot query into `sla_at_risk_at <= ?`, identical on both. |
| Story 04's `store()` leaves `assigned_to` **null** when none is given, with a comment naming this story | Task 5 replaces that block: when `assigned_to` is absent, `TicketAssigner::pick()` chooses an agent and an **`auto_assigned`** `ticket_events` row records it | This is the intake's second acceptance criterion. The takeover is a **replacement of that one `if` block plus its comment**, not a new code path — Story 04 deliberately shaped `store()` so that this is a three-line change. |
| Story 07 states the escalation source is *"decided by Story 04"* and says **"do not add an `escalated_at` column here"** | **This story adds `tickets.escalated_at`** and writes an `escalated` row to `ticket_events` | Story 04's shipped schema has no escalation concept at all — its contract table (line 1480 onward) contains no such column and its `event` list has no such value. Story 07's instruction not to add the column in *its own* plan remains correct; the column belongs here, and Story 07 binds to it. See **Shared contracts**. |
| The intake: alerts go to *"the assigned agent and their Team Lead"* | Recipients are the assigned agent **plus every active `team_lead`** | There is no `teams` table. `Ticket::scopeVisibleTo()` still treats Team Lead as "all tickets" — a carried-forward debt owned by Story 08. Narrowing the recipient list requires the same team model; this story fans out and leaves one `// Story 08:` comment at the fan-out point. |
| `QUEUE_CONNECTION=database` and a `jobs` table exists | The engine is an **Artisan command that does its work synchronously**. It dispatches **no** queued jobs | No queue worker is configured, documented, or started anywhere in this repo — `routes/console.php` schedules nothing and no `queue:work` invocation exists. Dispatching to the `database` driver would write rows into `jobs` that nothing ever drains, so every escalation and notification would silently never happen. A synchronous chunked command is observable, testable under `sync`, and has no daemon prerequisite. |

---

## Backend Tasks

### 1 — `sla_rules`: the configuration table and its model

**Create file: `api/database/migrations/2026_08_27_100000_create_sla_rules_table.php`**

**`ls api/database/migrations` first.** The timestamp must sort after every Story 04 and Story 05 migration; if Story 05 used a later date, move this one past it.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_rules', function (Blueprint $table) {
            $table->id();

            // One rule per priority tier. The unique index is the product rule:
            // four tiers, four cards, no ambiguity about which rule applies.
            $table->string('priority', 16)->unique();

            $table->unsignedInteger('first_response_minutes');
            $table->unsignedInteger('resolution_minutes');

            // Percent of the resolution target consumed before a ticket reads
            // "at risk". Precomputed into tickets.sla_at_risk_at at creation.
            $table->unsignedTinyInteger('at_risk_threshold_pct')->default(80);

            $table->boolean('notify_on_breach')->default(true);
            $table->boolean('escalation_enabled')->default(false);

            // Minutes after first_response_due_at at which an unanswered ticket
            // escalates. NULL with escalation_enabled = true means "escalate on
            // breach" (the design card's ON BREACH action).
            $table->unsignedInteger('escalate_after_minutes')->nullable();

            // 'team_lead' or 'administrator'. Validated against UserRole.
            $table->string('escalate_to_role', 16)->nullable();

            // Days a Resolved ticket waits before auto-closing. NULL = never.
            $table->unsignedSmallInteger('auto_close_after_days')->nullable();

            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sla_rules');
    }
};
```

- **`priority` is `string(16)`, not an enum column**, cast to `App\Enums\Priority` on the model. This matches how `tickets.priority` is stored (Story 04 contract) and keeps a new tier a code change with no migration.
- **`unique()` on `priority`** is the constraint the "Add Rule" product rule leans on. It behaves identically on PostgreSQL and SQLite and surfaces as a 422 from the FormRequest's `Rule::unique` before it ever reaches the database.
- **No `deleted_at`.** There is no soft delete anywhere in this project; deactivation is `is_active = false`.

**Create file: `api/app/Models/SlaRule.php`** — `use HasFactory`, namespace `App\Models`:

```php
    protected $fillable = [
        'priority', 'first_response_minutes', 'resolution_minutes',
        'at_risk_threshold_pct', 'notify_on_breach', 'escalation_enabled',
        'escalate_after_minutes', 'escalate_to_role', 'auto_close_after_days',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'priority' => Priority::class,
            'notify_on_breach' => 'boolean',
            'escalation_enabled' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /** Human copy for the card's ON BREACH column, derived — never stored. */
    public function breachActionLabel(): string
    {
        if ($this->escalation_enabled && $this->escalate_to_role !== null) {
            $role = \App\Enums\UserRole::from($this->escalate_to_role)->label();

            return $this->notify_on_breach
                ? "Notify Team Lead + escalate to {$role}"
                : "Escalate to {$role}";
        }

        return $this->notify_on_breach ? 'Notify Team Lead' : 'No escalation';
    }
```

- **`breachActionLabel()` is derived, not a stored string.** Storing the sentence would let the copy drift from the behaviour the engine runs. The design's Normal card reads `Flag in queue, no escalation` and its Low card reads `No escalation`; **both are the same no-escalation state, so both ship as `No escalation`** — two stored strings for one behaviour is exactly the drift this method prevents. Recorded here rather than silently dropped.
- **`casts()` is the method form**, matching `User::casts()` (`api/app/Models/User.php` lines 31–40). Do not use a `$casts` property.

**Create file: `api/database/factories/SlaRuleFactory.php`** — mirrors the shape of Story 04's `TicketFactory`:

```php
public function definition(): array
{
    return [
        'priority' => Priority::Normal->value,
        'first_response_minutes' => 240,
        'resolution_minutes' => 1440,
        'at_risk_threshold_pct' => 80,
        'notify_on_breach' => true,
        'escalation_enabled' => false,
        'escalate_after_minutes' => null,
        'escalate_to_role' => null,
        'auto_close_after_days' => 5,
        'is_active' => true,
    ];
}
```

---

### 2 — Migration: the eleven SLA columns on `tickets`

**Create file: `api/database/migrations/2026_08_27_100100_add_sla_columns_to_tickets_table.php`**

**Never edit `2026_08_25_200001_create_tickets_table.php` and never edit a Story 04 migration.** Story 04's own Done Criteria requires the scaffold to stay byte-for-byte unchanged, and the same discipline applies one level up.

```php
public function up(): void
{
    Schema::table('tickets', function (Blueprint $table) {
        // Which rule produced the timestamps below. Kept for display and for
        // auto_close_after_days; the timestamps themselves never re-derive
        // from it, which is what makes a rule edit non-retroactive.
        $table->foreignId('sla_rule_id')->nullable()->constrained('sla_rules')->nullOnDelete();

        $table->timestamp('first_response_due_at')->nullable();
        $table->timestamp('first_response_at')->nullable();
        $table->timestamp('resolution_due_at')->nullable();

        // Precomputed at_risk boundary: resolution_due_at minus the unconsumed
        // share of the target. Stored so the engine compares, never calculates.
        $table->timestamp('sla_at_risk_at')->nullable();

        // Precomputed escalation moment. NULL = this ticket never escalates.
        $table->timestamp('escalate_at')->nullable();

        // Pending-clock pause. sla_paused_at is non-null ONLY while the ticket
        // is Pending; sla_paused_minutes is the running total already added
        // back into the four timestamps above.
        $table->timestamp('sla_paused_at')->nullable();
        $table->unsignedInteger('sla_paused_minutes')->default(0);

        // Once-only guards. The engine is idempotent because of these two.
        $table->timestamp('sla_at_risk_notified_at')->nullable();
        $table->timestamp('sla_breached_notified_at')->nullable();

        $table->timestamp('escalated_at')->nullable();

        // One index per engine query. Each leads with `status` because every
        // engine query excludes resolved/closed rows first.
        $table->index(['status', 'resolution_due_at'], 'tickets_sla_resolution_index');
        $table->index(['status', 'sla_at_risk_at'], 'tickets_sla_at_risk_index');
        $table->index(['status', 'escalate_at'], 'tickets_sla_escalate_index');
        $table->index(['status', 'resolved_at'], 'tickets_sla_autoclose_index');
    });
}

public function down(): void
{
    Schema::table('tickets', function (Blueprint $table) {
        $table->dropIndex('tickets_sla_resolution_index');
        $table->dropIndex('tickets_sla_at_risk_index');
        $table->dropIndex('tickets_sla_escalate_index');
        $table->dropIndex('tickets_sla_autoclose_index');
        $table->dropConstrainedForeignId('sla_rule_id');
        $table->dropColumn([
            'first_response_due_at', 'first_response_at', 'resolution_due_at',
            'sla_at_risk_at', 'escalate_at', 'sla_paused_at', 'sla_paused_minutes',
            'sla_at_risk_notified_at', 'sla_breached_notified_at', 'escalated_at',
        ]);
    });
}
```

Five details that are each a real failure if missed:

- **No `->after()` hints.** Story 04's plan already records that `after()` is a MySQL-only hint, silently ignored on both PostgreSQL and SQLite. Physical column order is not relied on anywhere.
- **`nullOnDelete()` on `sla_rule_id`.** Deleting a rule must not delete tickets, and must not reset a ticket's already-computed due dates — those are absolute timestamps that survive the FK going null. This is the mechanism behind outcome 8.
- **Four indexes, one per engine query.** Each engine pass filters `status NOT IN ('resolved','closed')` (or `= 'resolved'` for auto-close) and then compares exactly one timestamp. A composite leading with `status` serves each; without them, every five-minute run table-scans `tickets`.
- **Every new column is nullable or defaulted.** `php artisan migrate` on a populated database must not fail, and every pre-existing ticket lands with null due dates — which reads as `risk: null` and is excluded from every widget and every compliance figure. Story 07 lines 193–195 already assume exactly this.
- **`sla_paused_minutes` is `unsignedInteger`, not `smallInteger`.** A ticket parked in Pending for a month is 43,200 minutes; a `smallInteger` overflows at 32,767 and PostgreSQL raises rather than truncating.

**Backfill is not done in this migration.** Computing `created_at + N minutes` in SQL requires `INTERVAL` on PostgreSQL and `datetime(..., '+N minutes')` on SQLite — two different statements, and the test suite runs the one production does not. Backfill is a PHP pass behind `php artisan sla:evaluate --backfill` (Task 6).

---

### 3 — `Ticket` model additions

**File: `api/app/Models/Ticket.php` — extend the version Story 04 shipped. Do not replace it.**

Keep `assignee()`, `customer()`, `creator()`, `events()`, `scopeVisibleTo()`, `scopeFilter()`, `scopeSorted()`, `booted()`, `recordEvent()` and `CATEGORIES` exactly as they are.

**Change 1 — extend `$fillable`** with the eleven new columns (`sla_rule_id`, `first_response_due_at`, `first_response_at`, `resolution_due_at`, `sla_at_risk_at`, `escalate_at`, `sla_paused_at`, `sla_paused_minutes`, `sla_at_risk_notified_at`, `sla_breached_notified_at`, `escalated_at`).

**Change 2 — extend `casts()`** with `'datetime'` for all ten timestamp columns and `'integer'` for `sla_paused_minutes`. **Do not touch the `status`, `priority` or `channel` casts.**

**Add 1 — the rule relation:**

```php
public function slaRule(): BelongsTo
{
    return $this->belongsTo(SlaRule::class, 'sla_rule_id');
}
```

**Add 2 — four query scopes. These are the only correct way for Stories 07 and 12 to select by SLA state:**

```php
/** Tickets whose clock is running: has a target, not finished, not paused. */
public function scopeSlaRunning(Builder $query): Builder
{
    return $query
        ->whereNotNull('resolution_due_at')
        ->whereNotIn('status', [TicketStatus::Resolved->value, TicketStatus::Closed->value])
        ->whereNull('sla_paused_at');
}

public function scopeSlaBreached(Builder $query, ?CarbonInterface $now = null): Builder
{
    return $query->slaRunning()->where('resolution_due_at', '<=', $now ?? now());
}

public function scopeSlaAtRisk(Builder $query, ?CarbonInterface $now = null): Builder
{
    $now ??= now();

    return $query->slaRunning()
        ->where('sla_at_risk_at', '<=', $now)
        ->where('resolution_due_at', '>', $now);
}

/** Soonest-due first, tickets with no target last. Story 07's "SLA urgency". */
public function scopeSlaUrgencyOrder(Builder $query): Builder
{
    return $query
        ->orderByRaw('case when resolution_due_at is null then 1 else 0 end')
        ->orderBy('resolution_due_at');
}
```

- **`orderByRaw('case when … is null then 1 else 0 end')` rather than `NULLS LAST`.** `ORDER BY col NULLS LAST` is PostgreSQL syntax; SQLite accepts it only from 3.30 and the bundled version is not pinned anywhere in this repo. A `CASE` expression is ANSI SQL and behaves identically on both. **This is the ordering Story 07's `GET /api/dashboard/agent/queue` uses — it does not hand-roll one.**
- **`slaRunning()` excludes paused tickets**, so a Pending ticket is never breached and never at risk. That is the intake's pause criterion enforced at the query layer, not only in the display service.
- **The scopes compare, they do not calculate.** Every value on the right-hand side is a PHP `Carbon` bound as a parameter.

**Add 3 — history event helpers**, alongside Story 04's `recordEvent()`:

```php
public function recordAutoAssigned(int $userId): void
{
    $this->recordEvent('auto_assigned', 'assigned_to', null, (string) $userId);
}

public function recordEscalated(?int $fromUserId, int $toUserId): void
{
    $this->recordEvent('escalated', 'assigned_to', (string) $fromUserId, (string) $toUserId);
}

public function recordAutoClosed(): void
{
    $this->recordEvent('auto_closed', 'status', TicketStatus::Resolved->value, TicketStatus::Closed->value);
}
```

`recordEvent()` is `protected` in Story 04's shipped model. **Widen it to `public` only if these three helpers cannot reach it** — they are methods on the same class, so they can. Do not change its visibility.

**File: `api/app/Models/User.php` — add one relation and nothing else:**

```php
public function assignedTickets(): HasMany
{
    return $this->hasMany(Ticket::class, 'assigned_to');
}
```

This is what the auto-assignment picker counts against. Do not touch `casts()`, `isAdministrator()` or `canSeeTeamQueue()`.

---

### 4 — `SlaClock`: the one place threshold math exists

**Create file: `api/app/Services/SlaClock.php`** (namespace `App\Services`; imports `App\Enums\Priority`, `App\Enums\TicketStatus`, `App\Models\SlaRule`, `App\Models\Ticket`, `Carbon\CarbonInterface`, `Illuminate\Support\Carbon`). Every screen and every report reads risk through this class. **No controller, resource, widget, job, or test recomputes a threshold.**

```php
    /** @var array<string, ?SlaRule> Per-request memo — once per tier, not once per ticket. */
    private array $rules = [];

    public function ruleFor(Priority $priority): ?SlaRule
    {
        return $this->rules[$priority->value] ??= SlaRule::query()
            ->where('priority', $priority->value)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Stamp the four target timestamps from the ticket's current priority,
     * anchored on created_at plus whatever pause time has already accrued.
     * Idempotent: calling it twice with the same rule and the same pause
     * total produces the same timestamps.
     */
    public function applyTo(Ticket $ticket): void
    {
        $rule = $this->ruleFor($ticket->priority);

        if ($rule === null) {
            $ticket->forceFill([
                'sla_rule_id' => null,
                'first_response_due_at' => null,
                'resolution_due_at' => null,
                'sla_at_risk_at' => null,
                'escalate_at' => null,
            ]);

            return;
        }

        $anchor = ($ticket->created_at ?? Carbon::now())->copy()
            ->addMinutes($ticket->sla_paused_minutes);

        $responseDue = $anchor->copy()->addMinutes($rule->first_response_minutes);
        $resolutionDue = $anchor->copy()->addMinutes($rule->resolution_minutes);

        // The unconsumed share of the target, subtracted from the due date.
        $unconsumed = (int) round($rule->resolution_minutes * (100 - $rule->at_risk_threshold_pct) / 100);
        $atRisk = $resolutionDue->copy()->subMinutes($unconsumed);

        $escalateAt = null;
        if ($rule->escalation_enabled) {
            $escalateAt = $rule->escalate_after_minutes !== null
                ? $responseDue->copy()->addMinutes($rule->escalate_after_minutes)
                : $resolutionDue->copy();
        }

        $ticket->forceFill([
            'sla_rule_id' => $rule->id,
            'first_response_due_at' => $responseDue,
            'resolution_due_at' => $resolutionDue,
            'sla_at_risk_at' => $atRisk,
            'escalate_at' => $escalateAt,
        ]);
    }

    /** Called when a ticket enters Pending. Idempotent — a non-null sla_paused_at returns early. */
    public function pause(Ticket $ticket, ?CarbonInterface $at = null): void
    {
        if ($ticket->sla_paused_at === null) {
            $ticket->forceFill(['sla_paused_at' => $at ?? Carbon::now()]);
        }
    }

    /** Called when a ticket leaves Pending. Pushes every target forward by the paused span. */
    public function resume(Ticket $ticket, ?CarbonInterface $at = null): void
    {
        if ($ticket->sla_paused_at === null) {
            return;
        }

        $now = Carbon::instance($at ?? Carbon::now());
        $paused = max(0, $ticket->sla_paused_at->diffInMinutes($now, absolute: false));

        foreach (['first_response_due_at', 'resolution_due_at', 'sla_at_risk_at', 'escalate_at'] as $field) {
            if ($ticket->{$field} !== null) {
                $ticket->forceFill([$field => $ticket->{$field}->copy()->addMinutes($paused)]);
            }
        }

        $ticket->forceFill([
            'sla_paused_at' => null,
            'sla_paused_minutes' => $ticket->sla_paused_minutes + $paused,
        ]);
    }

    /** Idempotent — the FIRST caller wins, which is why Story 05's message hook is authoritative. */
    public function markFirstResponse(Ticket $ticket, ?CarbonInterface $at = null): void
    {
        if ($ticket->first_response_at === null) {
            $ticket->forceFill(['first_response_at' => $at ?? Carbon::now()]);
        }
    }

    /** @return 'breached'|'at_risk'|'ok'|null */
    public function riskFor(Ticket $ticket, ?CarbonInterface $now = null): ?string
    {
        if ($ticket->resolution_due_at === null) {
            return null;
        }

        if (in_array($ticket->status, [TicketStatus::Resolved, TicketStatus::Closed], true)) {
            return $this->wasMetOnClose($ticket) ? 'ok' : 'breached';
        }

        $at = Carbon::instance($now ?? Carbon::now());

        // A paused ticket's clock is frozen at the moment it paused.
        if ($ticket->sla_paused_at !== null) {
            $at = $ticket->sla_paused_at;
        }

        if ($ticket->resolution_due_at->lessThanOrEqualTo($at)) {
            return 'breached';
        }

        if ($ticket->sla_at_risk_at !== null && $ticket->sla_at_risk_at->lessThanOrEqualTo($at)) {
            return 'at_risk';
        }

        return 'ok';
    }

    /** Negative once breached. Frozen while paused. Null with no target. */
    public function minutesLeft(Ticket $ticket, ?CarbonInterface $now = null): ?int
    {
        if ($ticket->resolution_due_at === null) {
            return null;
        }

        $at = $ticket->sla_paused_at
            ?? ($ticket->finishedAt() ?? Carbon::instance($now ?? Carbon::now()));

        return (int) $at->diffInMinutes($ticket->resolution_due_at, absolute: false);
    }

    /** The exact array TicketResource's fixed `sla` block consumes. */
    public function snapshot(Ticket $ticket, ?CarbonInterface $now = null): array
    {
        return [
            'due_at' => $ticket->resolution_due_at?->toISOString(),
            'minutes_left' => $this->minutesLeft($ticket, $now),
            'risk' => $this->riskFor($ticket, $now),
        ];
    }

    private function wasMetOnClose(Ticket $ticket): bool
    {
        $finishedAt = $ticket->finishedAt();

        return $finishedAt !== null && $finishedAt->lessThanOrEqualTo($ticket->resolution_due_at);
    }
}
```

**Add `finishedAt()` to `Ticket`** — `resolved_at ?? closed_at`, the moment the clock stopped. Story 04's contract records that a ticket closed straight from Open has `closed_at` with a null `resolution_at`, so the fallback order matters and cannot be reversed.

Four properties this design buys, each of which a naive version loses:

- **`snapshot()` issues no query and needs no eager load.** Every input is a column on the ticket row already loaded by the queue. The queue's 25 rows cost zero extra queries — a rule lookup per row would be 25.
- **A rule edit is inert on existing tickets.** Nothing in `riskFor()`, `minutesLeft()` or `snapshot()` reads `SlaRule`. That satisfies the intake's "applies going forward" criterion structurally instead of by convention.
- **A resolved ticket reports `ok` or `breached`, never `at_risk`.** Its clock stopped; "approaching" is meaningless. `wasMetOnClose()` is also what the compliance figure counts.
- **`forceFill()` throughout, never `update()`.** These methods mutate the in-memory model; the **caller** saves. That keeps a single `$ticket->save()` per engine pass and stops Story 04's `booted()` observer firing a spurious history row for a due-date shift.

**Register it as a singleton.** Add to `api/app/Providers/AppServiceProvider.php`'s `register()`:

```php
$this->app->singleton(SlaClock::class);
```

The `$rules` memo is per-request; a singleton makes the engine's per-tier lookup happen four times per run instead of once per ticket.

**Add the compliance method — Story 12 (`../reports-dashboards/12-story-reports-dashboards.md` lines 155–161) binds to this exact return shape:**

```php
/**
 * @return array{compliance_rate: ?float, breach_rate: ?float, avg_resolution_minutes: ?int, resolved_count: int}
 */
public function complianceBetween(CarbonInterface $from, CarbonInterface $to): array
{
    $tickets = Ticket::query()
        ->whereNotNull('resolution_due_at')
        ->whereNotNull('resolved_at')
        ->whereBetween('resolved_at', [$from, $to])
        ->get(['id', 'created_at', 'resolved_at', 'closed_at', 'resolution_due_at', 'sla_paused_minutes', 'status']);

    $count = $tickets->count();

    if ($count === 0) {
        return ['compliance_rate' => null, 'breach_rate' => null, 'avg_resolution_minutes' => null, 'resolved_count' => 0];
    }

    $met = $tickets->filter(fn (Ticket $t) => $this->riskFor($t) === 'ok')->count();
    $minutes = $tickets->map(
        fn (Ticket $t) => $t->created_at->diffInMinutes($t->finishedAt(), absolute: true) - $t->sla_paused_minutes
    );

    return [
        'compliance_rate' => round($met / $count * 100, 1),
        'breach_rate' => round(($count - $met) / $count * 100, 1),
        'avg_resolution_minutes' => (int) round($minutes->avg()),
        'resolved_count' => $count,
    ];
}
```

- **`null`, never `0`, on an empty window.** Story 07 line 191 and Story 12 both render `—` for a null rate; a `0%` compliance figure on a quiet week is a false alarm.
- **Tickets with a null `resolution_due_at` are excluded from both the numerator and the denominator** — not counted as compliant. Story 07 lines 193–195 states this requirement; this is where it is enforced.
- **`avg_resolution_minutes` subtracts paused time**, so the average measures agent handling time, matching what the SLA clock actually counted.

---

### 5 — Auto-assignment, and taking it over from Story 04

**Create file: `api/app/Services/TicketAssigner.php`** (namespace `App\Services`).

```php
    private const LIVE = [TicketStatus::Open->value, TicketStatus::Pending->value];

    /**
     * Least-open-load with a round-robin tiebreak:
     *   1. active users with role Agent
     *   2. fewest tickets currently Open or Pending
     *   3. tie → whoever least recently received a ticket
     *   4. still tied (nobody ever assigned) → lowest user id
     * Returns null when no active agent exists — the ticket stays Unassigned.
     */
    public function pick(): ?User
    {
        return $this->candidates(UserRole::Agent)
            ->withMax('assignedTickets as last_assigned_at', 'created_at')
            ->get()
            ->sortBy([
                fn (User $a, User $b) => $a->open_load <=> $b->open_load,
                fn (User $a, User $b) => ($a->last_assigned_at ?? '') <=> ($b->last_assigned_at ?? ''),
                fn (User $a, User $b) => $a->id <=> $b->id,
            ])
            ->first();
    }

    /** The escalation target: least-loaded active user holding $role. */
    public function pickByRole(UserRole $role): ?User
    {
        return $this->candidates($role)->orderBy('open_load')->orderBy('id')->first();
    }

    private function candidates(UserRole $role): Builder
    {
        return User::query()
            ->where('is_active', true)
            ->where('role', $role->value)
            ->withCount(['assignedTickets as open_load' => fn ($q) => $q->whereIn('status', self::LIVE)]);
    }
```

- **The sort runs in PHP, not SQL.** The candidate set is the agent roster — tens of rows, not thousands. Ordering by a `withMax` alias with NULLs is written differently on PostgreSQL and SQLite; a PHP `sortBy` with an explicit `?? ''` fallback is identical on both and needs no raw expression.
- **`role = Agent` only.** A Team Lead is the escalation *target*; auto-assigning new work to them would defeat the escalation path.
- **`null` is a valid answer.** A database with no active agent (a fresh install, or every agent deactivated) leaves the ticket Unassigned — the exact behaviour Story 04 ships today. Nothing crashes and nothing is assigned to an inactive user.
- **The tiebreak makes this genuinely round-robin at equal load.** Without step 3, four agents at zero load always return the lowest id and the first four tickets of the day all land on one person.

**File: `api/app/Http/Controllers/TicketController.php` — `store()`.**

Replace **only** the `if (! empty($data['assigned_to'])) { … }` block Story 04 shipped, together with its `// Auto-assignment is Story 06's rule` comment. The rest of `store()` is unchanged.

```php
$data = $request->validated();
$data['created_by'] = $request->user()->id;
$data['status'] = TicketStatus::Open->value;

$autoAssigned = false;

if (! empty($data['assigned_to'])) {
    $target = Ticket::make($data);
    $target->assigned_to = $data['assigned_to'];
    if (! $request->user()->can('assign', $target)) {
        unset($data['assigned_to']);
    }
}

// WIS-6: an unnamed assignee is chosen by the auto-assignment rule.
if (empty($data['assigned_to'])) {
    $picked = $this->assigner->pick();
    if ($picked !== null) {
        $data['assigned_to'] = $picked->id;
        $autoAssigned = true;
    }
}

$ticket = Ticket::create($data);   // Story 04's observer writes 'created'

$this->clock->applyTo($ticket);
$ticket->save();

if ($autoAssigned) {
    $ticket->recordAutoAssigned($ticket->assigned_to);
}
```

- **`applyTo()` runs after `create()`, not before.** The anchor is `created_at`, which does not exist until the row is inserted.
- **The explicit-assignee path is untouched**, including its policy check. An Administrator naming an agent still wins over the rule.
- **`recordAutoAssigned()` fires after the save**, so history reads `created` then `auto_assigned` in the order they happened. Story 04's observer already wrote an `assigned` row for the same change; **both rows are correct and both are kept** — `assigned` records *what* changed, `auto_assigned` records *why*. Do not suppress the observer.
- Inject both services through the constructor: `public function __construct(private SlaClock $clock, private TicketAssigner $assigner) {}`.

**File: `api/app/Http/Controllers/TicketController.php` — `update()`.**

Extend Story 04's status block. The transition gate, the `resolved_at` / `closed_at` side effects, and the `assign` authorization stay exactly as they are; append the clock calls **inside the existing `if (array_key_exists('status', $data))` branch**, and add one branch for priority:

```php
if (array_key_exists('status', $data)) {
    // ... Story 04's canTransitionTo() gate and timestamp side effects ...

    if ($next === TicketStatus::Pending) {
        $this->clock->pause($ticket);
    } elseif ($ticket->status === TicketStatus::Pending) {
        $this->clock->resume($ticket);
    }

    // The first move off Open by an agent is that agent's first response,
    // until Story 05 supplies the earlier and authoritative signal
    // (the first outbound message). markFirstResponse() is idempotent, so
    // adding that caller later needs no change here.
    if ($ticket->status === TicketStatus::Open) {
        $this->clock->markFirstResponse($ticket);
    }
}

if (array_key_exists('priority', $data) && $data['priority'] !== $ticket->priority->value) {
    $ticket->priority = Priority::from($data['priority']);
    $this->clock->applyTo($ticket);   // re-anchored on created_at + accrued pause
}

$ticket->update($data);
```

- **Priority change recomputes the targets.** A ticket escalated to Urgent must get Urgent's clock; leaving it on Normal's target is the bug that makes an urgent ticket look healthy. Re-anchoring on `created_at + sla_paused_minutes` means the elapsed time already spent counts against the new, shorter target — which is the point.
- **`pause` / `resume` are ordered against `$ticket->status`, the value *before* the update.** Reading it after `$ticket->update($data)` compares the new status with itself and never resumes.

---

### 6 — The engine: `sla:evaluate`

**Create file: `api/app/Console/Commands/EvaluateSlaCommand.php`.** `app/Console/` does not exist yet; create the directory. Laravel 13 auto-discovers commands in `app/Console/Commands` — **no manual registration is required and none should be added.**

```php
    protected $signature = 'sla:evaluate
                            {--backfill : Stamp SLA targets on tickets that have none, then exit}
                            {--dry-run : Report what would change without writing}';

    protected $description = 'Evaluate SLA at-risk, breach, escalation and auto-close across all open tickets.';

    public function handle(SlaClock $clock, SlaNotifier $notifier, TicketAssigner $assigner): int
    {
        $now = Carbon::now();

        if ($this->option('backfill')) {
            return $this->backfill($clock);
        }

        $this->flagAtRisk($clock, $notifier, $now);
        $this->flagBreached($clock, $notifier, $now);
        $this->escalate($clock, $notifier, $assigner, $now);
        $this->autoClose($now);

        return self::SUCCESS;
    }
```

Each pass is one private method, and each follows the same three-step shape: **a chunked query, a once-only guard, a write plus a history row.**

**Pass 1 — at risk.**

```php
Ticket::query()
    ->slaAtRisk($now)
    ->whereNull('sla_at_risk_notified_at')
    ->with(['assignee:id,name,is_active'])
    ->chunkById(200, function ($tickets) use ($notifier, $now) {
        foreach ($tickets as $ticket) {
            $notifier->slaAtRisk($ticket);
            $ticket->forceFill(['sla_at_risk_notified_at' => $now])->save();
        }
    });
```

**Pass 2 — breached.** Identical shape against `slaBreached($now)` guarded by `whereNull('sla_breached_notified_at')`, calling `$notifier->slaBreached($ticket)`. **It additionally sets `sla_at_risk_notified_at` when that is still null**, so a ticket that was never seen at-risk (the engine was down through its whole at-risk window) does not fire a stale at-risk alert on the next run.

**Pass 3 — escalate.**

```php
Ticket::query()
    ->slaRunning()
    ->whereNotNull('escalate_at')
    ->where('escalate_at', '<=', $now)
    ->whereNull('escalated_at')
    ->whereNull('first_response_at')     // an answered ticket does not escalate
    ->with('slaRule')
    ->chunkById(200, function ($tickets) use ($assigner, $notifier, $now) {
        foreach ($tickets as $ticket) {
            $role = UserRole::tryFrom((string) $ticket->slaRule?->escalate_to_role);
            $target = $role ? $assigner->pickByRole($role) : null;

            if ($target === null || $target->id === $ticket->assigned_to) {
                $ticket->forceFill(['escalated_at' => $now])->save();   // stamped, not retried
                continue;
            }

            $from = $ticket->assigned_to;
            $ticket->forceFill(['assigned_to' => $target->id, 'escalated_at' => $now])->save();
            $ticket->recordEscalated($from, $target->id);
            $notifier->escalated($ticket, $target);
        }
    });
```

- **`whereNull('first_response_at')`** is what makes the intake's "Urgent **unresponded** for 30 min" true. A ticket already answered has had its human contact; escalating it punishes the agent who responded.
- **`escalated_at` is stamped even when no target is found.** Otherwise a database with no Team Lead retries every ticket every five minutes forever.
- **`$ticket->forceFill([...])->save()` writes `assigned_to`, so Story 04's `booted()` observer fires an `assigned` row with `user_id = null`** (console context — Story 04's contract says this renders as "System"). `recordEscalated()` adds the `escalated` row on top. Both are intended.

**Pass 4 — auto-close.**

```php
Ticket::query()
    ->where('status', TicketStatus::Resolved->value)
    ->whereNotNull('resolved_at')
    ->whereNotNull('sla_rule_id')
    ->with('slaRule')
    ->chunkById(200, function ($tickets) use ($now) {
        foreach ($tickets as $ticket) {
            $days = $ticket->slaRule?->auto_close_after_days;

            if ($days === null || $ticket->resolved_at->copy()->addDays($days)->greaterThan($now)) {
                continue;
            }

            if (! $ticket->status->canTransitionTo(TicketStatus::Closed)) {
                continue;
            }

            $ticket->update(['status' => TicketStatus::Closed, 'closed_at' => $now]);
            $ticket->recordAutoClosed();
        }
    });
```

- **The day arithmetic is in PHP** (`resolved_at->addDays($days)`), applied per row after a cheap `status = 'resolved'` filter. The number of Resolved tickets awaiting close is small; a portable SQL predicate for a per-row day count does not exist.
- **`canTransitionTo()` is called even though `resolved → closed` is legal** in the shipped graph. It is the single transition authority; hard-coding the knowledge that this edge exists is exactly the parallel logic Story 04's contract forbids.
- **Story 04's trap is load-bearing here:** `resolved_at` is cleared when a ticket leaves `Resolved`. A reopened ticket therefore never satisfies `whereNotNull('resolved_at')` and never auto-closes. **Verify that behaviour is present in the shipped `TicketController@update` before trusting this pass.**

**`--backfill`** iterates tickets with `whereNull('resolution_due_at')` and `whereNotIn('status', ['resolved','closed'])` in `chunkById(200)`, calls `$clock->applyTo($ticket)` and saves. It is idempotent and prints the count. **It is the only way pre-existing tickets get SLA targets** — the migration deliberately does not backfill.

**`--dry-run`** runs every query and prints a per-pass count without a single write. It is what an operator runs before the first real invocation on a populated database.

**File: `api/routes/console.php` — append below the `inspire` command (line 8):**

```php
use Illuminate\Support\Facades\Schedule;

// WIS-6: the SLA engine. Runs synchronously — no queue worker is configured
// in this project (config/queue.php defaults to the `database` driver and
// nothing drains the jobs table), so a dispatched job would never execute.
Schedule::command('sla:evaluate')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->runInBackground();
```

- **Five minutes** is the granularity the tightest seeded rule needs: Urgent's response target is 15 minutes and its at-risk boundary is at 80% of a 4-hour resolution target. A one-minute cadence adds load with no user-visible benefit; hourly would let an Urgent breach sit unflagged for most of an hour.
- **`withoutOverlapping(10)`** — a slow run on a large table must not have a second run start behind it and double-process the same chunk. The 10-minute lock expiry releases a stuck lock automatically.
- **`Schedule` is the Laravel 11+ facade** (`Illuminate\Support\Facades\Schedule`), used in `routes/console.php`. **There is no `app/Console/Kernel.php` in this project** and one must not be created.

**How it is run:**

| Context | Command | Notes |
|---|---|---|
| Local development | `cd api && php artisan schedule:work` | Long-running foreground process; invokes due tasks each minute. Run it in a second terminal beside `php artisan serve`. |
| Manual, one-off | `cd api && php artisan sla:evaluate` | The whole engine, immediately. This is how every acceptance criterion is demonstrated. |
| Inspecting first | `cd api && php artisan sla:evaluate --dry-run` | Counts only, no writes. |
| Production | one cron entry: `* * * * * cd /path/to/api && php artisan schedule:run >> /dev/null 2>&1` | Standard Laravel scheduler entry. **Document this in the story's PR description; do not add a deploy script.** |
| Tests | call the command directly — `$this->artisan('sla:evaluate')` | `QUEUE_CONNECTION=sync` under test (`api/phpunit.xml`), so nothing is deferred. |

**When the engine has not run for a long interval** — a laptop that was closed for a week, a cron that was never installed — the next run catches up completely and safely:

- Every pass is a **state comparison against `now()`**, not a delta since the last run. There is no "last run" cursor to fall behind.
- The `*_notified_at` guards mean each ticket produces **at most one** at-risk and **one** breach notification, no matter how many runs were missed. A week of downtime yields one notification per affected ticket, not one per missed five-minute slot.
- Escalations that should have happened days ago fire on the catch-up run and stamp `escalated_at`, so the following run skips them.
- Auto-close closes every eligible resolved ticket in one pass, in `chunkById(200)` batches.
- **The one thing a long gap does change:** a ticket that passed through its at-risk window *and* breached while the engine was down never emits an `sla_at_risk` notification — Pass 2 sets both guards. That is deliberate; two alerts arriving at once for the same ticket is noise, and the breach is the actionable one.

---

### 7 — `SlaNotifier`: the seam to Story 11

**Create file: `api/app/Services/SlaNotifier.php`.** Story 11 (Notifications Centre) executes **after** this story and owns `App\Enums\NotificationType`, the `notifications` table, and `App\Services\NotificationDispatcher`. This class is the seam that lets the engine ship and work now, and lets Story 11 land without touching a line of engine code.

Three public methods, each delegating to the two private ones below:

| Method | Type value | Title | Recipients |
|---|---|---|---|
| `slaAtRisk(Ticket)` | `sla_at_risk` | `SLA at risk · #{id}` | `fanOut` |
| `slaBreached(Ticket)` | `sla_breached` | `SLA breached · #{id}` | `fanOut` |
| `escalated(Ticket, User $target)` | `sla_breached` | `Escalated to you · #{id}` | `$target` only |

The body of every notification is `$ticket->subject`; the link is `/tickets/{id}`.

```php
    /** Assigned agent + every active Team Lead. */
    private function fanOut(Ticket $ticket, string $type, string $title, ?string $body): void
    {
        $recipients = collect();

        if ($ticket->assignee !== null && $ticket->assignee->is_active) {
            $recipients->push($ticket->assignee);
        }

        // Story 08 owns the teams model. Until it lands, "their Team Lead" fans
        // out to every active Team Lead — the same shortcut scopeVisibleTo() takes.
        $recipients = $recipients->merge(
            User::query()->where('is_active', true)->where('role', UserRole::TeamLead->value)->get()
        )->unique('id');

        foreach ($recipients as $recipient) {
            $this->send($recipient, $ticket, $type, $title, $body);
        }
    }

    private function send(User $recipient, Ticket $ticket, string $type, string $title, ?string $body): void
    {
        $dispatcher = 'App\\Services\\NotificationDispatcher';
        $typeEnum = 'App\\Enums\\NotificationType';

        // Story 11 (WIS-13) owns both. Until it lands, an alert is a log line
        // and the SLA state on the ticket row — never a silent no-op.
        if (! class_exists($dispatcher) || ! enum_exists($typeEnum)) {
            Log::info('sla.notification', [
                'type' => $type, 'ticket_id' => $ticket->id,
                'recipient_id' => $recipient->id, 'title' => $title,
            ]);

            return;
        }

        app($dispatcher)->dispatch(
            $recipient, $typeEnum::from($type), $title, $body, $ticket, "/tickets/{$ticket->id}",
        );
    }
```

- **The string type values `'sla_at_risk'` and `'sla_breached'` match Story 11's enum table exactly** (`../notifications/11-story-notifications-centre.md` lines 126–127). When Story 11 lands, `NotificationType::from('sla_at_risk')` resolves and the branch flips with **zero** change here.
- **The `dispatch()` call matches Story 11's pinned signature** (`recipient, type, title, body, source, linkTo`) at lines 138–146 of that plan, positionally.
- **`class_exists` / `enum_exists`, not a config flag.** A flag is a second thing to remember to flip. The presence of the class is the fact being tested.
- **The fallback logs; it does not silently return.** An operator running the engine before Story 11 sees the alerts in `storage/logs/laravel.log` and can verify the engine works.
- **Deactivated recipients are filtered here as well as in Story 11's dispatcher**, which returns `null` for a deactivated user. Both holding is correct; neither alone is relied on.

---

### 8 — `TicketResource`: fill the fixed `sla` block

**File: `api/app/Http/Resources/TicketResource.php` — change the `sla` line and nothing else.**

Story 04 ships `'sla' => ['due_at' => null, 'minutes_left' => null, 'risk' => null]`. Replace it with:

```php
'sla' => app(SlaClock::class)->snapshot($this->resource),
```

- **Three keys in, three keys out, same names, same order.** `SlaCell.tsx` and the `TicketSla` TypeScript type (Story 04's plan, lines 979–983) are already written against this. **Adding a fourth key here breaks Story 04's `TicketResource` contract and is forbidden.**
- **`app(SlaClock::class)` resolves the singleton registered in Task 4.** No constructor injection is available on a `JsonResource`; the container call is the correct form and costs one array lookup.
- **No new eager load, no N+1.** `snapshot()` reads only columns that are already on the `tickets` row. Verify with `DB::listen()` in the queue test that a 25-row page still issues the same query count Story 04's test asserts.
- **`tests/Feature/TicketScopeTest.php` stays green unedited** — it asserts on `subject`, ordering, and the absence of an assignee `email`, none of which this change touches.

---

### 9 — Requests, resource, policy, controller and routes for `sla_rules`

**Create file: `api/app/Http/Requests/StoreSlaRuleRequest.php`**

```php
public function authorize(): bool
{
    return $this->user()->can('create', SlaRule::class);
}

public function rules(): array
{
    return [
        'priority' => ['required', Rule::enum(Priority::class), Rule::unique('sla_rules', 'priority')],
        'first_response_minutes' => ['required', 'integer', 'min:1', 'max:525600'],
        'resolution_minutes' => ['required', 'integer', 'min:1', 'max:525600'],
        'at_risk_threshold_pct' => ['required', 'integer', 'min:1', 'max:99'],
        'notify_on_breach' => ['required', 'boolean'],
        'escalation_enabled' => ['required', 'boolean'],
        'escalate_after_minutes' => ['nullable', 'integer', 'min:1', 'max:525600'],
        'escalate_to_role' => ['nullable', 'required_if:escalation_enabled,true', Rule::in([
            UserRole::TeamLead->value, UserRole::Administrator->value,
        ])],
        'auto_close_after_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        'is_active' => ['sometimes', 'boolean'],
    ];
}

public function withValidator($validator): void
{
    $validator->after(function ($v) {
        if ((int) $this->input('resolution_minutes') <= (int) $this->input('first_response_minutes')) {
            $v->errors()->add('resolution_minutes',
                'The resolution target must be longer than the response target.');
        }
    });
}
```

- **`max:525600`** is one year in minutes. An unbounded integer produces a `Carbon` overflow when `applyTo()` adds it, which surfaces as a 500 on ticket creation, not as a validation error.
- **`min:1` on `at_risk_threshold_pct`, `max:99`.** `0` puts the at-risk boundary at creation time (every ticket instantly at risk); `100` puts it at the due date, which is the breach, so `at_risk` would never be reachable.
- **`resolution_minutes > first_response_minutes` is a cross-field rule.** Without it an Administrator saves a rule where the resolution deadline precedes the response deadline, and `escalate_at` (built on the response due date) lands after the breach — an escalation that fires after the thing it exists to prevent.
- **`escalate_to_role` is `required_if` escalation is enabled**, and constrained to `team_lead` / `administrator`. Escalating to an `agent` is a lateral move, not an escalation.
- **`Rule::in()` on the two `UserRole` values, not `Rule::enum(UserRole::class)`**, because the enum's third case is exactly the one that must be rejected.

**Create file: `api/app/Http/Requests/UpdateSlaRuleRequest.php`** — same rules with every field `sometimes`, and the `unique` rule ignoring the current record: `Rule::unique('sla_rules', 'priority')->ignore($this->route('sla_rule'))`. The cross-field check reads `$this->input(..., $rule->…)` so a partial update still compares against the stored value.

**Create file: `api/app/Http/Resources/SlaRuleResource.php`**

```php
return [
    'id' => $this->id,
    'priority' => $this->priority->value,
    'priority_label' => $this->priority->label(),
    'first_response_minutes' => $this->first_response_minutes,
    'resolution_minutes' => $this->resolution_minutes,
    'at_risk_threshold_pct' => $this->at_risk_threshold_pct,
    'notify_on_breach' => $this->notify_on_breach,
    'escalation_enabled' => $this->escalation_enabled,
    'escalate_after_minutes' => $this->escalate_after_minutes,
    'escalate_to_role' => $this->escalate_to_role,
    'auto_close_after_days' => $this->auto_close_after_days,
    'is_active' => $this->is_active,
    'breach_action_label' => $this->breachActionLabel(),
];
```

- **`priority_label` comes from `Priority::label()`** — Story 04's enum, not a second map.
- **`breach_action_label` is server-computed.** The card's ON BREACH sentence is derived from four booleans; deriving it twice (once here, once in TypeScript) is exactly how the screen and the engine drift.

**Create file: `api/app/Policies/SlaRulePolicy.php`** — every ability returns `$user->isAdministrator()` (`api/app/Models/User.php` lines 42–45). **Do not add SLA abilities to `TicketPolicy.php`**; that class is Story 04's and `TicketScopeTest` depends on its current methods.

**Create file: `api/app/Http/Controllers/SlaRuleController.php`**

```php
public function index(Request $request): AnonymousResourceCollection
{
    $this->authorize('viewAny', SlaRule::class);

    // Urgent → High → Normal → Low, driven by Story 04's ordering authority.
    return SlaRuleResource::collection(
        SlaRule::query()->orderBy(Priority::sortExpression(), 'desc')->get()
    );
}

public function store(StoreSlaRuleRequest $request): JsonResponse   // 201
public function update(UpdateSlaRuleRequest $request, SlaRule $slaRule): SlaRuleResource
public function destroy(Request $request, SlaRule $slaRule): JsonResponse   // 204
```

- **`Priority::sortExpression()` descending** produces the design's card order. **Do not write `orderByRaw("CASE priority WHEN 'urgent' …")`** — that is the parallel ordering logic Story 04's contract explicitly forbids, and it duplicates a weight map that already exists.
- **`index()` returns every rule, active and inactive, unpaginated.** Four rows maximum by the unique constraint; pagination on a four-row table is dead code and the screen shows deactivated rules so an Administrator can reactivate one.
- **`destroy()` ships** so a tier can be genuinely vacated and re-created with a different threshold model. **The screen does not expose it** — the design has an edit pencil and no delete control. It exists for API completeness and is covered by a policy test.
- **`update()` never touches a ticket.** That is outcome 8, and a test asserts it directly.

**File: `api/routes/api.php` — append inside the existing `auth:sanctum` group (lines 14–18), after Story 04's ticket block:**

```php
Route::get('/sla-rules', [SlaRuleController::class, 'index']);
Route::post('/sla-rules', [SlaRuleController::class, 'store']);
Route::patch('/sla-rules/{sla_rule}', [SlaRuleController::class, 'update']);
Route::delete('/sla-rules/{sla_rule}', [SlaRuleController::class, 'destroy']);
```

- **No `/sla-rules/meta` endpoint.** The priority options the form needs already come from Story 04's `GET /api/tickets/meta` (`priorities: [{value,label}]`). Adding a second source for the same list is how the two drift.
- **The route parameter is `{sla_rule}`**, snake_case, so Laravel's implicit binding resolves `SlaRule $slaRule`.

---

### 10 — Seeder

**File: `api/database/seeders/DatabaseSeeder.php` — append after the user block (currently lines 20–58) and before the ticket block. Do not restructure what is there.**

| Priority | `first_response_minutes` | `resolution_minutes` | `at_risk_pct` | `notify_on_breach` | `escalation_enabled` | `escalate_after_minutes` | `escalate_to_role` | `auto_close_after_days` | Renders as |
|---|---|---|---|---|---|---|---|---|---|
| `urgent` | **15** | **240** | 80 | `true` | `true` | **30** | `administrator` | 5 | `15 minutes` / `4 hours` / `Notify Team Lead + escalate to Administrator` |
| `high` | **60** | **480** | 80 | `true` | `false` | `null` | `null` | 5 | `1 hour` / `8 hours` / `Notify Team Lead` |
| `normal` | **240** | **1440** | 80 | `false` | `false` | `null` | `null` | 5 | `4 hours` / `24 hours` / `No escalation` |
| `low` | **1440** | **7200** | 80 | `false` | `false` | `null` | `null` | 5 | `1 day` / `5 days` / `No escalation` |

Every minute value is read straight off the design artboard (`WisalSLARules-LightLTR.dc.html` lines 81–82, 91–92, 101–102, 111–112). The Urgent escalation of **30 minutes** is the intake's own worked example.

**After creating the rules, call `app(SlaClock::class)->applyTo($ticket)` and save for each seeded ticket** so a freshly seeded database shows real countdowns instead of four dashes. Backdate at least one ticket's `created_at` past its target (`->subHours(6)` on the Urgent one) so the breached state is visible without waiting.

---

## Frontend Tasks

### 11 — Tokens

**File: `web/src/index.css` — add to all four blocks** (bare `:root` from line 20, the `prefers-color-scheme` block from line 48, `[data-theme="dark"]` from line 76, `[data-theme="light"]` from line 100).

**Reuse, do not redefine:** `--prio-low`, `--prio-normal`, `--prio-high`, `--prio-urgent` and their badge fills, and `--sla-breached` / `--sla-at-risk` / `--sla-ok` / `--sla-none` — all four `--sla-*` tokens already exist from Story 04 (its plan, lines 949–952). **This screen adds no `--sla-*` token.**

| Token | Light | Dark | Source line |
|---|---|---|---|
| `--sla-rule-border-urgent` | `#FECACA` | `#2A2C33` | L78 · D78 |
| `--sla-rule-border-high` | `#FDE68A` | `#2A2C33` | L88 · D88 |
| `--sla-rule-border-normal` | `#BFDBFE` | `#2A2C33` | L98 · D98 |
| `--sla-rule-border-low` | `#E2E8F0` | `#2A2C33` | L108 · D108 |
| `--sla-rule-accent-urgent` | `#DC2626` | `#F87171` | L78 · D78 |
| `--sla-rule-accent-high` | `#D97706` | `#FBBF24` | L88 · D88 |
| `--sla-rule-accent-normal` | `#2563EB` | `#60A5FA` | L98 · D98 |
| `--sla-rule-accent-low` | `#64748B` | `#94A3B8` | L108 · D108 |
| `--sla-rule-action-urgent` | `#DC2626` | `#F87171` | L83 · D83 |
| `--sla-rule-action-high` | `#B45309` | `#FBBF24` | L93 · D93 |
| `--sla-rule-action-muted` | `#334155` | `#CBD5E1` | L103 · D103 |
| `--sla-rule-fact-label` | `#94A3B8` | `#64748B` | L81 · D81 |

- **Every dark `--sla-rule-border-*` is `#2A2C33`.** That is not a copy error — the dark artboard drops the tinted outline entirely and carries the tier signal only on the 4px accent edge. Copy the table exactly; do not "fix" it by tinting the dark border.
- **`--sla-rule-action-high` is `#B45309`, not `#D97706`.** It is small text on a light background and takes the `badge_text_on_tint` value from `docs/design/brief.md` (verified 4.84:1). The accent edge on the same card keeps `#D97706`. Two values, two contexts, both correct.
- **`--sla-rule-fact-label` inverts between themes** (`#94A3B8` light, `#64748B` dark) — the label sits on white in light and on `#1C1D24` in dark.

---

### 12 — The feature folder and the route

**Create `web/src/features/sla-rules/`** following the shape pinned by Story 04:

```
web/src/features/sla-rules/
  api/       slaRulesApi.ts  queryKeys.ts
  components/ SlaRuleCard.tsx  SlaRuleFormModal.tsx  DurationField.tsx
              SlaRulesSkeleton.tsx  SlaRulesError.tsx  SlaRulesEmpty.tsx
  hooks/     useSlaRules.ts  useSaveSlaRule.ts
  model/     slaRuleSchema.ts  formatDuration.ts  types.ts
  pages/     SlaRulesPage.tsx
  index.ts
```

**`index.ts` exports `SlaRulesPage` only.** Nothing else is importable from outside the folder.

**File: `web/src/App.tsx`** — inside the existing `/sla-rules` route, replace `<PagePlaceholder title="SLA Rules" />` with `<SlaRulesPage />` and add the import. **Leave the `<RequireAuth roles={['administrator']}>` wrapper exactly as it is**, and change nothing else in the file. `PagePlaceholder` stays imported — five other routes still use it.

**`web/src/app/navigation/navItems.tsx` needs no edit.** The `nav.slaRules` entry already exists under `group: 'admin'` with `roles: ['administrator']`. `navItems.test.ts` (lines 12, 19, 26) and `navRoutes.test.tsx` (which builds its own route tree at line 57 and never imports `App.tsx`) both stay green with no change.

**File: `model/types.ts`**

```ts
export type PriorityValue = 'low' | 'normal' | 'high' | 'urgent';

export type SlaRule = {
  id: number;
  priority: PriorityValue;
  priority_label: string;
  first_response_minutes: number;
  resolution_minutes: number;
  at_risk_threshold_pct: number;
  notify_on_breach: boolean;
  escalation_enabled: boolean;
  escalate_after_minutes: number | null;
  escalate_to_role: 'team_lead' | 'administrator' | null;
  auto_close_after_days: number | null;
  is_active: boolean;
  breach_action_label: string;
};
```

**File: `api/queryKeys.ts`**

```ts
export const slaRuleKeys = {
  all: ['sla-rules'] as const,
  list: () => [...slaRuleKeys.all, 'list'] as const,
};
```

**This root is `['sla-rules']`, deliberately *not* nested under `ticketKeys.all`.** Story 04's contract nests *ticket* queries under that root so a ticket mutation invalidates them; rules are a different resource with a different lifetime, and nesting them would make every ticket edit refetch the rules list. **Saving a rule invalidates `slaRuleKeys.all` and `ticketKeys.all`** — a rule change alters the copy on the ON BREACH column, and future tickets get new targets.

**File: `api/slaRulesApi.ts`** — typed functions on the shared instance from `web/src/lib/api.ts`. **Do not create a second Axios client.**

```ts
export const fetchSlaRules = async (): Promise<SlaRule[]> =>
  (await api.get<{ data: SlaRule[] }>('/sla-rules')).data.data;

export const createSlaRule = async (body: SlaRuleInput): Promise<SlaRule> =>
  (await api.post<{ data: SlaRule }>('/sla-rules', body)).data.data;

export const updateSlaRule = async (id: number, body: Partial<SlaRuleInput>): Promise<SlaRule> =>
  (await api.patch<{ data: SlaRule }>(`/sla-rules/${id}`, body)).data.data;
```

`SlaRuleResource::collection()` returns Laravel's `{ data: [...] }` envelope; unwrap it here so no component knows about the envelope.

---

### 13 — `formatDuration` and `slaRuleSchema`

**File: `model/formatDuration.ts`** — the single formatter the card and the form both use.

```ts
/** 15 → "15 minutes" · 60 → "1 hour" · 240 → "4 hours" · 1440 → "1 day" · 7200 → "5 days" */
export function formatDuration(minutes: number): string {
  if (minutes % 1440 === 0) return plural(minutes / 1440, 'day');
  if (minutes % 60 === 0) return plural(minutes / 60, 'hour');
  return plural(minutes, 'minute');
}
```

- **Largest whole unit only.** `90` renders `90 minutes`, not `1 hour 30 minutes` — the design's fact column is one line at `16px/700` and a two-part value wraps at the card's 36px gap.
- **No "business day".** See the Product-rules table. `7200` renders `5 days`.
- **Singular and plural are both handled.** `60` is `1 hour`, matching the High card verbatim.

**File: `model/slaRuleSchema.ts`** — one Zod schema, the **single source** for both the form's TypeScript type and its validation, mirroring the server rules exactly:

```ts
export const slaRuleSchema = z
  .object({
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    first_response_minutes: z.number().int().min(1).max(525600),
    resolution_minutes: z.number().int().min(1).max(525600),
    at_risk_threshold_pct: z.number().int().min(1).max(99),
    notify_on_breach: z.boolean(),
    escalation_enabled: z.boolean(),
    escalate_after_minutes: z.number().int().min(1).max(525600).nullable(),
    escalate_to_role: z.enum(['team_lead', 'administrator']).nullable(),
    auto_close_after_days: z.number().int().min(1).max(365).nullable(),
  })
  .refine((v) => v.resolution_minutes > v.first_response_minutes, {
    path: ['resolution_minutes'],
    message: 'The resolution target must be longer than the response target.',
  })
  .refine((v) => !v.escalation_enabled || v.escalate_to_role !== null, {
    path: ['escalate_to_role'],
    message: 'Choose who the ticket escalates to.',
  });

export type SlaRuleInput = z.infer<typeof slaRuleSchema>;
```

**The two `refine` messages are byte-identical to the server's.** A user who defeats the client check sees the same sentence from the API, not a second phrasing of the same rule.

---

### 14 — `SlaRulesPage` and `SlaRuleCard`

**File: `pages/SlaRulesPage.tsx`** — the four states, each from its own component (`docs/design/brief.md` lines 181–187).

1. **Header** (export lines 72–75): `<h1>SLA Rules</h1>` at `22px/700`, then a `13px var(--text-muted)` subtitle reading **`{activeCount} active rules · applied by priority`** — computed from the response, never hardcoded. With one active rule it reads `1 active rule · applied by priority`.
2. **Add Rule** button on the inline-end side, primary style. `disabled` when all four tiers have a rule, with `title` and `aria-describedby` on a visually-hidden `<span>` reading **"Every priority tier already has a rule"**. Enabled, it opens the modal with the tier select limited to the vacant tiers.
3. **Loading** → `SlaRulesSkeleton` — four card-shaped blocks at the real card height, using Story 04's `--skeleton-*` tokens. **`prefers-reduced-motion` disables the shimmer.**
4. **Error** → `SlaRulesError` with a retry button calling `refetch()`. **No stack trace, no API URL** in the copy.
5. **Empty** → `SlaRulesEmpty`: "No SLA rules yet" over "Tickets will have no response or resolution target until a rule exists." plus the Add Rule action. This is reachable — a database migrated without `DatabaseSeeder`.
6. **Success** → the card list at `display:flex; flex-direction:column; gap:12px`, ordered urgent → low as the API returns it. **Do not re-sort on the client**; the server orders by `Priority::sortExpression()`.

**File: `components/SlaRuleCard.tsx`**

- Root: `background: var(--bg-card); border: 1px solid var(--sla-rule-border-{tier}); border-inline-start: 4px solid var(--sla-rule-accent-{tier}); border-radius: 10px; padding: 18px 20px; display: flex; align-items: center; gap: 20px`.
- **`border-inline-start`, one declaration.** The RTL export hand-mirrors `border-left` → `border-right` (lines 69, 79, 89, 99); the logical property does that with no second rule and no `[dir]` selector.
- Tier badge: reuse Story 04's **`PriorityBadge`** component. **Do not build a second priority chip** — `docs/design/brief.md` line 217 and Story 04's contract both name this.
- Three fact columns in `display:flex; gap:36px`: `RESPOND WITHIN` / `RESOLVE WITHIN` / `ON BREACH`, each an `11px/700 var(--sla-rule-fact-label) letter-spacing:.04em` label over its value. The first two are `16px/700 var(--text-main)` from `formatDuration()`. The third is `14px/600` in `var(--sla-rule-action-{urgent|high|muted})` showing `rule.breach_action_label` with the pencil glyph `M4 20h4l11-11-4-4L4 16z M14.5 5.5l4 4` at 14px.
- Trailing edit `<button>`: 34px square, `border-radius:8px`, `border:1px solid var(--icon-btn-border)`, `color: var(--icon-btn-color)`, same pencil glyph, **`aria-label={\`Edit the ${rule.priority_label} SLA rule\`}`**. The export's button has no accessible name at all; that is a defect, not a design.
- **A deactivated rule (`is_active === false`) renders at `opacity: .55` with an `INACTIVE` text chip.** Opacity alone is a colour-only signal, which `brief.md` line 196 forbids.
- **Focus rings are new work.** The export defines `.fv:focus-visible` at line 14 but the dark artboard uses `class="fvd"` with no rule anywhere. Ship `outline: 2px solid var(--nav-active-fg); outline-offset: 2px` on `:focus-visible` for both interactive controls. **No `outline: none` without a replacement anywhere in this story.**
- **Responsive:** below **900px** (reuse Story 04's `--queue-table-breakpoint`, do not add a second breakpoint) the three fact columns stack via `flex-wrap: wrap` with `gap: 16px 24px`, and the card keeps `align-items: flex-start`. **The page body never scrolls horizontally from 375px up.**

**File: `components/SlaRuleFormModal.tsx`** — react-hook-form + `zodResolver(slaRuleSchema)`.

- Open state lives in the **URL** (`?edit={id}` / `?new=1`), following Story 04's New-Ticket pattern, so a reload and the back button both behave.
- Fields: **Priority** (select; disabled and pre-set when editing, since `priority` is the unique key), **Respond within** and **Resolve within** via `DurationField`, **At-risk threshold** (number, suffix `%`, helper text "A ticket reads *at risk* once this share of its resolution target is used"), **Notify on breach** (checkbox), **Escalate automatically** (checkbox) revealing **Escalate to** (select: Team Lead / Administrator) and **Escalate after** (`DurationField`, helper "Measured from the response target. Leave empty to escalate at breach."), **Auto-close resolved tickets after** (number of days, clearable).
- **`DurationField`** is one number input plus a unit select (`minutes` / `hours` / `days`) that reads and writes a **minutes** number. Editing shows the largest whole unit — `240` opens as `4` + `hours` — so the value in the form matches the value on the card.
- The primary action is `Save rule`; the modal traps focus, closes on `Escape`, restores focus to the control that opened it, and disables the submit button while the mutation is in flight.
- **On success:** invalidate `slaRuleKeys.all` **and** `ticketKeys.all`, then close.
- **On a 422:** map `error.response.data.errors` onto the form fields with `setError`. Never render a raw error object.

---

## Edge Cases & Failure Modes

- **No rule exists for a ticket's priority.** Trigger: a tier's rule is deleted or deactivated, or the database was migrated without the seeder. Expected: `SlaClock::applyTo()` nulls all four target columns; `riskFor()` returns `null`; `TicketResource.sla.risk` is `null`; `SlaCell.tsx` renders `—` with `aria-label="SLA not configured"`; the engine's `slaRunning()` scope skips the row. Enforced in `SlaClock::applyTo()` and `SlaClock::riskFor()` (Task 4) and `Ticket::scopeSlaRunning()` (Task 3).
- **Tickets that existed before this story.** Trigger: `php artisan migrate` on a populated database. Expected: every SLA column is null, `sla.risk` is `null`, and the row is excluded from every widget and from the compliance denominator — **not counted as compliant** (Story 07 lines 193–195 requires exactly this). Fixed by `php artisan sla:evaluate --backfill`, which is the only backfill path. Enforced in Task 6.
- **A ticket sits in Pending across its would-be breach.** Trigger: waiting on the customer for a week. Expected: `sla_paused_at` is set, `slaRunning()` excludes it, `riskFor()` freezes the clock at the pause moment, `minutesLeft()` returns the frozen value, and no notification fires. On resume every target moves forward by the full paused span. Enforced in `SlaClock::pause()` / `resume()` (Task 4) and `TicketController@update` (Task 5).
- **Pending → Resolved without passing through Open.** Trigger: the customer replies and the agent resolves directly. `TicketStatus::allowedTransitions()` permits `pending → resolved`. Expected: `resume()` still runs (the branch is `elseif ($ticket->status === TicketStatus::Pending)`, keyed on the *old* status, not on the new one being Open), so `sla_paused_at` is cleared and `sla_paused_minutes` is final before the compliance figure reads it. A `sla_paused_at` left non-null on a resolved ticket would freeze `minutesLeft()` forever.
- **A ticket's priority is raised after creation.** Trigger: an agent moves Normal → Urgent. Expected: `applyTo()` re-anchors on `created_at + sla_paused_minutes` against Urgent's rule, so elapsed time counts against the shorter target and the ticket can land directly in `breached`. The `sla_at_risk_notified_at` / `sla_breached_notified_at` guards are **not** cleared, so a ticket already alerted under the old tier does not re-alert. **This is deliberate:** the ticket is already visible as at-risk in the queue; a second notification for the same ticket is noise.
- **The engine has not run for days.** Trigger: no cron, or a laptop closed over a weekend. Expected: the next run catches up completely; each ticket produces at most one at-risk and one breach notification, because every guard is a nullable timestamp and not a since-last-run cursor. A ticket that passed through at-risk *and* breached during the outage emits **only** the breach notification — Pass 2 sets both guards. Enforced in Task 6, Pass 2.
- **Two engine runs overlap.** Trigger: a slow first run on a large table. Expected: `withoutOverlapping(10)` blocks the second. Even without it, every write is idempotent and every guard is a `whereNull`, so the worst case is duplicated read work, never a duplicated notification.
- **Escalation with no eligible target.** Trigger: `escalate_to_role = 'team_lead'` and no active Team Lead exists, or the only Team Lead is already the assignee. Expected: `escalated_at` is stamped and the ticket is **not** reassigned, so the pass does not retry it forever. No notification fires. Enforced in Task 6, Pass 3.
- **Escalating a ticket that is already assigned to the escalation target.** Expected: the same stamp-and-skip path. Reassigning a ticket to its current assignee would write a spurious `assigned` history row every run.
- **A reopened ticket and auto-close.** Trigger: `resolved → open → resolved`. Expected: Story 04 clears `resolved_at` when a ticket leaves `Resolved` and sets it again on re-entry, so the auto-close countdown restarts from the second resolution. A stale `resolved_at` would close a live ticket. **Verify this behaviour is present in the shipped `TicketController@update` before relying on it** — Story 04's plan calls it "the sharpest cross-story trap in the schema".
- **A ticket closed straight from Open.** Trigger: a duplicate closed without resolving. Expected: `closed_at` is set, `resolved_at` is null, so `finishedAt()` falls through to `closed_at`, and `complianceBetween()` excludes it (it filters `whereNotNull('resolved_at')`). A ticket that was never resolved is not a compliance data point.
- **`at_risk_threshold_pct` set to 99 on a 15-minute target.** Trigger: an aggressive Urgent rule. Expected: `round(15 * 1 / 100) = 0`, so `sla_at_risk_at` equals `resolution_due_at`, and `scopeSlaAtRisk()`'s strict `resolution_due_at > now` means the ticket goes straight from `ok` to `breached` with no at-risk window. No division by zero, no negative interval, no duplicate alert. This is the correct outcome for a threshold that leaves under a minute of warning.
- **A concurrent rule edit and ticket creation.** Trigger: an Administrator saves a rule at the moment a ticket is created. Expected: whichever `SlaRule` row `ruleFor()` read is snapshotted into the ticket's absolute timestamps; the ticket is never partially computed from two rules, because `applyTo()` reads the rule once and writes all four columns from that one read.
- **Deleting a rule that tickets reference.** Trigger: `DELETE /api/sla-rules/{id}`. Expected: `nullOnDelete()` sets `tickets.sla_rule_id` to null and **leaves every computed timestamp intact**, so those tickets keep their risk classification and only lose their auto-close policy (Pass 4 filters `whereNotNull('sla_rule_id')`). Enforced by the FK in Task 2.
- **A non-Administrator calls the API directly.** Trigger: an Agent with a valid token issues `GET /api/sla-rules`. Expected: **403** from `SlaRulePolicy`. The hidden nav item is a UX affordance and is explicitly not the gate — `navItems.tsx`'s own comment says so.
- **Notification recipient is deactivated.** Trigger: an agent is deactivated while holding breached tickets. Expected: `SlaNotifier::fanOut()` skips a deactivated assignee, and Story 11's dispatcher returns `null` for one as well. Both guards hold independently.
- **`sla` computed for a ticket the queue paginates at 50 rows.** Expected: **zero** additional queries — `snapshot()` reads only ticket columns. Asserted by a query-count test rather than by inspection.
- **Stated uncertainty — first-response detection before Story 05.** Until the conversation thread exists, the only observable agent action on a ticket is a status change off `Open`, so that is what stamps `first_response_at`. It is **later** than the real first response (an agent who replies without changing status is not counted until they do). `markFirstResponse()` is idempotent and Story 05's message hook fires earlier, so adding that caller corrects the value with **no change** to this story's code. Named here rather than guessed at.
- **Stated uncertainty — "their Team Lead".** There is no `teams` table; `Ticket::scopeVisibleTo()` still treats Team Lead as "all tickets" (a carried-forward debt owned by Story 08). Breach alerts therefore reach **every** active Team Lead. In a single-team deployment this is exactly right; with multiple teams it over-notifies. The fan-out point carries one `// Story 08:` comment naming where the narrowing goes.
- **Stated uncertainty — working hours.** Every duration is wall-clock. A Low-priority ticket opened Friday evening consumes its 5-day target across the weekend. The design's "business day" wording is dropped for this reason (Product-rules table). Introducing a calendar changes exactly one method, `SlaClock::applyTo()`.

---

## Migration / Rollback

**Order:** `2026_08_27_100000_create_sla_rules_table.php` then `2026_08_27_100100_add_sla_columns_to_tickets_table.php`. The second has an FK to the first; running them out of order fails on PostgreSQL. **Confirm both sort after every Story 04 and Story 05 migration with `ls api/database/migrations` before committing the filenames.**

**Rollback:** `php artisan migrate:rollback --step=2` drops the eleven ticket columns, the four indexes, the FK, and `sla_rules`. `TicketResource`'s `sla` block and the `/sla-rules` screen must be reverted in the same change — `snapshot()` reading dropped columns raises on every ticket request.

**Half-applied states and what each looks like:**

- **Migration 1 applied, migration 2 not.** `sla_rules` exists and the admin screen works; tickets have no SLA columns and `TicketResource` raises. **Never deploy migration 1 alone.**
- **Both migrations applied, seeder not run.** Zero rules. Every ticket gets null targets, `sla.risk` is `null`, the queue renders dashes exactly as it does today, and `/sla-rules` shows its Empty state. **This is a safe resting state** — the pre-story behaviour with a working configuration screen.
- **Both applied, seeded, `--backfill` not run.** New tickets have targets; pre-existing ones read `null` and are excluded from widgets and compliance. Also safe, and the reason `--backfill` is opt-in.
- **Schedule registered but no cron / no `schedule:work`.** Due dates and risk classification are correct on every screen (they are computed at read time from stored columns); escalation, auto-close and notifications never fire. **The screens do not degrade** — only the automation is inert. `php artisan sla:evaluate` recovers everything in one run.

**On PostgreSQL specifically:** `dropConstrainedForeignId('sla_rule_id')` in `down()` drops the FK constraint before the column. Dropping the column first leaves an orphaned constraint. On SQLite, Laravel rebuilds the table and the distinction is invisible — **which is why this must be verified against PostgreSQL, not only against the test suite.**

---

## Test Plan

### Backend — Pest, in `api/tests/Feature/`

**All of these live in `tests/Feature/`.** `api/tests/Pest.php` extends `Tests\TestCase` **only** into `Feature`; a test in `tests/Unit/` gets no application, no container and no `RefreshDatabase`. Every test below uses `uses(RefreshDatabase::class)` and `Carbon::setTestNow()` for time control, following the fixture shape of `tests/Feature/TicketScopeTest.php` (lines 8–31).

1. **`Sla/SlaClockTest.php`** — the computation, with `Carbon::setTestNow()` pinned:
   - `it stamps response, resolution, at-risk and escalation targets from the ticket's tier` — Urgent (15/240/80/escalate 30) produces `+15m`, `+240m`, `+192m` (80% of 240), `+45m`.
   - `it leaves every target null when the tier has no active rule`.
   - `it returns ok, at_risk and breached at the three boundaries` — travel to `+191m`, `+192m`, `+241m`.
   - `it returns null risk for a ticket with no resolution target`.
   - `it freezes the clock while a ticket is paused` — pause at `+100m`, travel to `+300m`, assert `risk === 'ok'` and `minutes_left` unchanged.
   - `it pushes every target forward by the paused span on resume` — pause at `+100m`, resume at `+300m`, assert all four targets moved `+200m` and `sla_paused_minutes === 200`.
   - `it does not pause twice` and `it does not resume an unpaused ticket` — idempotency.
   - `it marks first response only once` — two calls, the first timestamp wins.
   - `it re-anchors targets on a priority change` — Normal → Urgent at `+30m` gives a resolution target at `created_at + 240m`, i.e. already only 210 minutes away.
   - `it classifies a resolved ticket as ok when it finished before its target and breached when after`.
2. **`Sla/SlaRuleApiTest.php`**:
   - `an administrator lists, creates, updates and deletes rules`.
   - `an agent receives 403 on every sla-rules route` and `a team lead receives 403 on every sla-rules route`.
   - `a second rule for the same priority is rejected with 422`.
   - `a resolution target shorter than the response target is rejected with 422` — assert the message matches the client's Zod copy byte-for-byte.
   - `escalation enabled without a target role is rejected with 422`.
   - `escalate_to_role rejects agent`.
   - `at_risk_threshold_pct rejects 0 and 100`.
   - `rules are returned urgent first` — asserts the `Priority::sortExpression()` ordering.
3. **`Sla/SlaRuleIsNotRetroactiveTest.php`** — the intake's fifth criterion, and the highest-value test in this story: create a ticket under a 240-minute Urgent rule, capture `resolution_due_at`, `PATCH` the rule to 30 minutes, reload the ticket, assert **`resolution_due_at`, `sla_at_risk_at` and `risk` are all unchanged**, and assert a *newly* created Urgent ticket gets the 30-minute target.
4. **`Sla/AutoAssignmentTest.php`**:
   - `a ticket created without an assignee goes to the least-loaded active agent`.
   - `an explicit assignee wins over the rule`.
   - `an inactive agent is never chosen`.
   - `a team lead is never auto-assigned`.
   - `the ticket stays unassigned when no active agent exists` — assert **201**, `assigned_to === null`, no crash.
   - `an auto_assigned event is written to ticket_events with the chosen agent id` — asserts against `ticket_events`, **never** `audit_logs`.
   - `four tickets with four idle agents spread across all four` — the round-robin tiebreak.
5. **`Sla/SlaEngineTest.php`** — `$this->artisan('sla:evaluate')`:
   - `it flags an at-risk ticket once and not again on a second run` — assert `sla_at_risk_notified_at` set, and run twice.
   - `it flags a breached ticket and suppresses the at-risk alert it never sent`.
   - `it skips paused tickets entirely`.
   - `it skips resolved and closed tickets`.
   - `it escalates an unanswered urgent ticket to the configured role and writes an escalated event`.
   - `it does not escalate a ticket that already has a first response`.
   - `it stamps escalated_at without reassigning when no target role user exists`.
   - `it auto-closes a resolved ticket past its window and writes an auto_closed event` — assert `status === closed`, `closed_at` set.
   - `it does not auto-close a reopened ticket` — resolve, reopen, travel 10 days, run: still Open.
   - `it catches up after a long gap without duplicating notifications` — travel **7 days**, run, assert exactly one at-risk-or-breach guard set per ticket.
   - `--dry-run writes nothing` — snapshot every SLA column before and after.
   - `--backfill stamps targets on tickets that have none and is idempotent`.
6. **`Sla/TicketSlaResourceTest.php`**:
   - `the sla block has exactly three keys named due_at, minutes_left and risk` — `assertSame(['due_at','minutes_left','risk'], array_keys($json['sla']))`. **This is the Story 04 contract guard.**
   - `risk is one of breached, at_risk, ok or null for every ticket in a mixed page`.
   - `minutes_left is negative on a breached ticket`.
   - `a page of 25 tickets issues no additional query for the sla block` — wrap `DB::listen()` and compare the count against a page with SLA rules deleted.
7. **`Sla/SlaComplianceTest.php`** — `complianceBetween()`:
   - `it returns null rates and a zero count for an empty window` (never `0`).
   - `it excludes tickets with no resolution target from both numerator and denominator`.
   - `it subtracts paused minutes from the average resolution time`.
   - `it counts a ticket resolved exactly on its target as compliant`.
8. **`Sla/PendingClockTest.php`** — the end-to-end pause criterion through the HTTP API: `PATCH` to `pending`, travel 3 hours, `PATCH` back to `open`, assert `resolution_due_at` moved 3 hours and `risk` is still `ok` on a rule that would otherwise have breached.
9. **Regression:** `tests/Feature/TicketScopeTest.php` and `tests/Feature/ApiContractTest.php` pass **with no edits**. If either needs a change, the `sla` contract was broken — fix the code, not the test.

### Frontend — Vitest + Testing Library, in `web/src/features/sla-rules/`

Follow the patterns in `web/src/app/layouts/AppLayout.test.tsx` and `web/src/features/auth/LoginPage.test.tsx`. Mock the Axios instance from `web/src/lib/api.ts`; **do not hit a network.**

10. `pages/SlaRulesPage.test.tsx`:
    - `it renders four rule cards in urgent-to-low order`.
    - `it renders the loading skeleton, then the cards` — all four states, one assertion each.
    - `it renders the error state with a retry that refetches, and no API URL in the copy`.
    - `it renders the empty state with an Add Rule action when the list is empty`.
    - `it prints the active-rule count in the subtitle and pluralises it` — one rule reads `1 active rule`.
    - `it disables Add Rule when every tier has a rule and explains why` — assert the accessible description text.
11. `components/SlaRuleCard.test.tsx`:
    - `it renders RESPOND WITHIN, RESOLVE WITHIN and ON BREACH with the server's breach label`.
    - `it renders 15 minutes, 4 hours, 1 hour, 1 day and 5 days from minute values`.
    - `it gives the edit button an accessible name naming the tier`.
    - `it marks a deactivated rule with a text chip, not colour alone`.
12. `components/SlaRuleFormModal.test.tsx`:
    - `it blocks a resolution target shorter than the response target with the server's exact message`.
    - `it requires an escalation target when escalation is enabled`.
    - `it converts 4 hours to 240 minutes on submit and opens 240 minutes as 4 hours`.
    - `it disables the priority select when editing`.
    - `it maps a 422 response onto the offending field`.
    - `it closes on Escape and restores focus to the control that opened it`.
13. `model/formatDuration.test.ts` — a table test: `15 → "15 minutes"`, `60 → "1 hour"`, `90 → "90 minutes"`, `240 → "4 hours"`, `1440 → "1 day"`, `7200 → "5 days"`.
14. **Regression:** `web/src/app/navigation/navItems.test.ts` and `navRoutes.test.tsx` pass **unedited**. Neither file is touched by this story.

---

## Verification Steps

1. **Backend migrates:** `cd api && php artisan migrate` against the real PostgreSQL connection. Both migrations apply. Then `php artisan migrate:rollback --step=2` and `php artisan migrate` again — **the rollback must succeed on PostgreSQL, not only under SQLite.**
2. **Backend seeds:** `cd api && php artisan migrate:fresh --seed`. `sla_rules` holds four rows; the seeded tickets have non-null `resolution_due_at`; the backdated Urgent ticket reads `breached`.
3. **Backend tests:** `cd api && php artisan test`. Fully green, including `TicketScopeTest` and `ApiContractTest` unedited.
4. **Engine, dry run:** `cd api && php artisan sla:evaluate --dry-run` prints per-pass counts and writes nothing — confirm with a `SELECT` on `sla_at_risk_notified_at` before and after.
5. **Engine, real run:** `cd api && php artisan sla:evaluate`. The backdated ticket gains `sla_breached_notified_at`; `storage/logs/laravel.log` carries `sla.notification` lines (Story 11 has not landed).
6. **Scheduler:** `cd api && php artisan schedule:list` shows `sla:evaluate` at `*/5 * * * *`. `php artisan schedule:work` in a second terminal invokes it on the next five-minute boundary.
7. **Frontend builds:** `cd web && npm run build` and `npm run lint` are both clean.
8. **Frontend tests:** `cd web && npx vitest run` is green. **There is no `npm test` script.**
9. **Regression, manual:** `cd api && php artisan serve` plus `cd web && npm run dev`.
   - Sign in as `admin@wisal.test` / `Password123!`. `/sla-rules` renders four cards matching the artboard — copy, order, badges, ON BREACH sentences.
   - Edit the High rule's resolve target to `6 hours`, save. The card updates. **Open `/tickets` and confirm no existing ticket's SLA value changed.**
   - Sign in as `agent@wisal.test`. **SLA Rules is absent from the sidebar**, and `curl` to `/api/sla-rules` with that token returns **403**.
   - On `/tickets`, the SLA column now shows real countdowns; the backdated ticket shows the breached state; a Pending ticket shows a frozen value.
   - **Theme:** toggle to dark. Card borders become `#2A2C33` with only the 4px accent tiered; every ON BREACH sentence stays legible.
   - **RTL:** set direction to RTL. The accent edge moves to the visual right with no second stylesheet, the fact columns mirror, and the subtitle's numeral stays LTR.
   - **Responsive:** narrow to 375px. The fact columns wrap; the page body has **no horizontal scrollbar** at any width from 375px up.
   - **Keyboard:** tab through the page. Every control shows a visible focus ring; the modal traps focus, closes on Escape, and returns focus to its opener.
   - **Reduced motion:** enable it at the OS level and reload during loading. The skeleton renders without shimmer.

---

## Shared contracts this story establishes

**Stories 05, 07, 08, 11, 12 and 13 cite this section verbatim. Nothing below may be redefined in a later plan.**

### `sla_rules` — the configuration table

`id · priority (string 16, **unique**, cast to Priority) · first_response_minutes · resolution_minutes · at_risk_threshold_pct (default 80) · notify_on_breach · escalation_enabled · escalate_after_minutes (nullable) · escalate_to_role (nullable, 'team_lead'|'administrator') · auto_close_after_days (nullable) · is_active · timestamps`

**One rule per priority tier, enforced by the unique index.** Model `App\Models\SlaRule`, resource `SlaRuleResource`, policy `SlaRulePolicy` (Administrator only). `breachActionLabel()` is derived, never stored.

### `tickets` — the eleven columns this story adds

| Column | Type | Meaning |
|---|---|---|
| `sla_rule_id` | FK → `sla_rules`, nullable, `nullOnDelete` | Which rule produced the timestamps. **Never re-read to derive risk.** |
| `first_response_due_at` | timestamp, nullable | Response target. **Named by Story 04's contract.** |
| `first_response_at` | timestamp, nullable | Actual first response. **Story 05 adds the earlier, authoritative caller.** |
| `resolution_due_at` | timestamp, nullable | Resolution target. **Named by Story 04's contract. This is `sla.due_at`.** |
| `sla_at_risk_at` | timestamp, nullable | Precomputed at-risk boundary. |
| `escalate_at` | timestamp, nullable | Precomputed escalation moment. `null` = never escalates. |
| `sla_paused_at` | timestamp, nullable | Non-null **only** while the ticket is Pending. |
| `sla_paused_minutes` | unsignedInteger, default 0 | Total paused minutes already added into the four targets. |
| `sla_at_risk_notified_at` | timestamp, nullable | Once-only guard. |
| `sla_breached_notified_at` | timestamp, nullable | Once-only guard. |
| `escalated_at` | timestamp, nullable | **Story 07 reads this** for its Current Escalations list. |

Indexes: `(status, resolution_due_at)` · `(status, sla_at_risk_at)` · `(status, escalate_at)` · `(status, resolved_at)`.

**Every due date is an absolute timestamp written once at ticket creation (and re-written only on a priority change).** Nothing derives a due date from `sla_rules` at read time. **That is the mechanism, not the convention, behind "a rule edit applies going forward only."**

### The due-date computation — pinned

Given rule `R` for the ticket's current priority and `anchor = ticket.created_at + sla_paused_minutes`:

```
first_response_due_at = anchor + R.first_response_minutes
resolution_due_at     = anchor + R.resolution_minutes
sla_at_risk_at        = resolution_due_at − round(R.resolution_minutes × (100 − R.at_risk_threshold_pct) / 100)
escalate_at           = R.escalation_enabled
                          ? (R.escalate_after_minutes !== null
                               ? first_response_due_at + R.escalate_after_minutes
                               : resolution_due_at)
                          : null
```

On leaving Pending, all four move forward by the paused span and `sla_paused_minutes` accumulates it. **All arithmetic is PHP/Carbon. Every SQL predicate is a plain `column <= ?` against a PHP-computed value** — no `INTERVAL`, no `julianday()`, no `NULLS LAST` — because the test suite runs SQLite and production runs PostgreSQL.

### Risk classification — pinned

| Condition | `sla.risk` |
|---|---|
| `resolution_due_at` is null | `null` |
| Status is Resolved or Closed, and `resolved_at ?? closed_at` ≤ `resolution_due_at` | `"ok"` |
| Status is Resolved or Closed, and it finished late | `"breached"` |
| `resolution_due_at` ≤ *evaluation time* | `"breached"` |
| `sla_at_risk_at` ≤ *evaluation time* < `resolution_due_at` | `"at_risk"` |
| otherwise | `"ok"` |

*Evaluation time* is `sla_paused_at` when the ticket is paused, otherwise `now()`. **A resolved ticket is never `at_risk`.**

### `App\Services\SlaClock` — the single computation source

Registered as a **singleton** in `AppServiceProvider`. **Every screen, widget, report and job reads risk through it. No caller reimplements a threshold, and no caller reads `sla_rules` to classify a ticket.**

```php
ruleFor(Priority $priority): ?SlaRule
applyTo(Ticket $ticket): void                                   // stamps the four targets; caller saves
pause(Ticket $ticket, ?CarbonInterface $at = null): void        // idempotent
resume(Ticket $ticket, ?CarbonInterface $at = null): void       // idempotent
markFirstResponse(Ticket $ticket, ?CarbonInterface $at = null): void  // idempotent, first caller wins
riskFor(Ticket $ticket, ?CarbonInterface $now = null): ?string  // 'breached'|'at_risk'|'ok'|null
minutesLeft(Ticket $ticket, ?CarbonInterface $now = null): ?int  // negative when breached
snapshot(Ticket $ticket, ?CarbonInterface $now = null): array    // ['due_at','minutes_left','risk']
complianceBetween(CarbonInterface $from, CarbonInterface $to): array
    // ['compliance_rate' => ?float, 'breach_rate' => ?float,
    //  'avg_resolution_minutes' => ?int, 'resolved_count' => int]
```

- **`snapshot()` issues no query and needs no eager load** — every input is a `tickets` column.
- **`complianceBetween()` returns `null` rates on an empty window, never `0`.** Tickets with a null `resolution_due_at` are excluded from both numerator and denominator — **not counted compliant** (Story 07 lines 193–195; Story 12 lines 155–161 bind to these four keys).

### `TicketResource.sla` — filled, shape unchanged

```jsonc
"sla": { "due_at": "2026-08-27T13:12:00.000Z", "minutes_left": -18, "risk": "breached" }
```

**Exactly three keys, the same three names, in the same order Story 04 pinned.** `risk` is `"breached" | "at_risk" | "ok" | null`. **No later story adds a fourth key.**

### Query scopes — the only correct SLA selectors

`Ticket::slaRunning()` · `slaBreached(?$now)` · `slaAtRisk(?$now)` · `slaUrgencyOrder()`.

**Story 07's `GET /api/dashboard/agent/sla-risk` uses `slaAtRisk()->orWhere` composition or a union of `slaAtRisk()` and `slaBreached()`; its `GET /api/dashboard/agent/queue` "ordered by SLA urgency" is `slaUrgencyOrder()`. Neither hand-rolls a comparison.** `slaUrgencyOrder()` uses a `CASE` expression rather than `NULLS LAST`, which is not portable to SQLite.

### `ticket_events` — three new `event` values

`auto_assigned` · `escalated` · `auto_closed`, appended to **Story 04's** `ticket_events` table. **No second history table exists, and nothing in this story writes to Story 01's `audit_logs`.** Engine-written rows carry `user_id = null` (console context), which Story 04's contract renders as "System".

### Escalation — Story 07's open question, resolved here

Story 07 (lines 207–209) records the escalation source as an uncertainty for Story 04 to settle. **Story 04 settled nothing — it ships no escalation concept.** This story does:

- **Escalated** means `tickets.escalated_at IS NOT NULL`. It is **not** a `TicketStatus` case and **not** a boolean flag.
- `Ticket::escalated_at` is the timestamp Story 07's Current Escalations list sorts and ages by. **Story 07's instruction not to add the column in its own plan stands; the column is here.**
- The **who** comes from the `escalated` row in `ticket_events` (`old_value` = previous assignee id, `new_value` = new assignee id). Escalations are engine-written, so that row's `user_id` is **null**.
- **Story 07 must render its `escalated_by_name` as `"SLA automation"` for engine escalations**, not as a user's name. Its thin wrapper resource keeps the field name; only its source changes. Its `escalated_at` reads the ticket column directly.
- The **Active escalations** tile counts `whereNotNull('escalated_at')->whereNotIn('status', ['resolved','closed'])`.

### Auto-assignment — `App\Services\TicketAssigner`

`pick(): ?User` — active `agent` role, fewest Open+Pending tickets, tiebreak by least-recently-assigned then lowest id. `pickByRole(UserRole $role): ?User` for escalation targets. **`null` is a valid answer and leaves the ticket Unassigned.** `TicketController@store` calls `pick()` **only** when no authorized explicit assignee is present, and writes an `auto_assigned` history row. **This replaces the `// Auto-assignment is Story 06's rule` block Story 04 shipped; nothing else in `store()` changes.**

### The engine — `php artisan sla:evaluate`

`App\Console\Commands\EvaluateSlaCommand`, auto-discovered from `app/Console/Commands` (**no `Kernel.php`; this project has none**). Registered in `api/routes/console.php` as `Schedule::command('sla:evaluate')->everyFiveMinutes()->withoutOverlapping(10)->runInBackground()`.

**It runs synchronously and dispatches no queued job.** `QUEUE_CONNECTION=database` with no worker configured anywhere in this repo means a dispatched job would sit in `jobs` forever. Local: `php artisan schedule:work`, or `php artisan sla:evaluate` directly. Production: one `* * * * * php artisan schedule:run` cron entry. Flags: `--backfill` (the **only** way pre-existing tickets get targets — the migration deliberately does not backfill) and `--dry-run`.

Four passes, each idempotent via a nullable-timestamp guard: at-risk → breach → escalate → auto-close. **After any outage the next run catches up completely and emits at most one at-risk and one breach notification per ticket**, because no pass keeps a since-last-run cursor.

### `App\Services\SlaNotifier` — the Story 11 seam

Three methods: `slaAtRisk(Ticket)`, `slaBreached(Ticket)`, `escalated(Ticket, User)`. Recipients are the assigned agent plus **every active Team Lead** (no `teams` table — Story 08's debt, marked with a comment at the fan-out point).

It calls `App\Services\NotificationDispatcher::dispatch($recipient, NotificationType::from($type), $title, $body, $ticket, "/tickets/{id}")` — **Story 11's pinned signature, positionally** — behind a `class_exists` / `enum_exists` guard, falling back to a `Log::info('sla.notification', …)` line while Story 11 has not landed. Type values are the strings `'sla_at_risk'` and `'sla_breached'`, matching Story 11's enum table exactly.

**Story 11 needs no change to this story's code when it lands.** Its own claim that "Story 06's SLA evaluation job is the first caller of the dispatcher" holds, and the caller is `SlaNotifier::send()`.

### API surface (all inside the existing `auth:sanctum` group, all Administrator-only)

| Method | Path |
|---|---|
| `GET` | `/api/sla-rules` — every rule, unpaginated, urgent-first via `Priority::sortExpression()` |
| `POST` | `/api/sla-rules` |
| `PATCH` | `/api/sla-rules/{sla_rule}` |
| `DELETE` | `/api/sla-rules/{sla_rule}` |

**No `/api/sla-rules/meta`** — the priority options come from Story 04's `GET /api/tickets/meta`.

### Frontend

- `web/src/features/sla-rules/` with `index.ts` exporting **`SlaRulesPage` only**.
- `slaRuleKeys` roots at `['sla-rules']`, **deliberately not under `ticketKeys.all`**. A rule mutation invalidates **both** roots.
- **Twelve `--sla-rule-*` tokens** in all four `index.css` blocks. `--sla-*` and `--prio-*` are **reused from Story 04, never redefined**, and the tier chip is Story 04's `PriorityBadge`, not a second component.
- `formatDuration(minutes)` in `features/sla-rules/model/` is the one duration formatter; `slaRuleSchema` is the one source for the form's type and its validation, and its two cross-field messages are byte-identical to the server's.
- **`web/src/App.tsx` changes by one `element`.** `navItems.tsx`, `navItems.test.ts` and `navRoutes.test.tsx` are **not touched** — `/sla-rules` is already in the manifest under `group: 'admin'` with `roles: ['administrator']`.

---

## Done Criteria

- [ ] `sla_rules` exists with `priority` **unique**, and `php artisan migrate:fresh --seed` produces exactly four rules matching the design's minute values (15/240 · 60/480 · 240/1440 · 1440/7200).
- [x] All eleven SLA columns and all four indexes exist on `tickets`, added by a **new** migration. `2026_08_25_200001_create_tickets_table.php` and every Story 04 migration are **byte-for-byte unchanged**.
- [ ] `php artisan migrate:rollback --step=2` succeeds **against PostgreSQL**, not only under the SQLite test suite.
- [ ] `TicketResource.sla` returns **exactly** `due_at`, `minutes_left`, `risk` — same three names, same order — with `risk` one of `"breached" | "at_risk" | "ok" | null`. Asserted by a key-list test, not by inspection.
- [ ] A page of 25 tickets issues **no additional query** for the `sla` block, asserted by a query-count test.
- [ ] `SlaClock` is the only class in `api/app/` containing threshold arithmetic. `grep -rn "at_risk_threshold_pct" api/app/` returns hits **only** in `SlaClock.php`, `SlaRule.php`, `SlaRuleResource.php` and the two FormRequests.
- [ ] Editing an SLA rule leaves every existing ticket's `resolution_due_at`, `sla_at_risk_at` and `risk` **unchanged**, proven by `SlaRuleIsNotRetroactiveTest`.
- [ ] A ticket moved to Pending freezes its `minutes_left`, and moving it back pushes every target forward by the exact paused span — proven end-to-end through the HTTP API by `PendingClockTest`.
- [ ] A ticket created with no assignee lands on the least-loaded active **Agent**, writes an `auto_assigned` row to **`ticket_events`** (never `audit_logs`), and stays Unassigned with a **201** when no active agent exists.
- [ ] `php artisan sla:evaluate` flags at-risk, flags breach, escalates and auto-closes; running it twice changes nothing the second time; `--dry-run` writes nothing; `--backfill` is idempotent.
- [ ] After a **7-day** simulated gap, one run emits at most **one** at-risk and **one** breach notification per ticket, and a ticket that breached during the gap emits only the breach.
- [ ] A **reopened** ticket never auto-closes, proven by a test that resolves, reopens, travels 10 days and runs the engine.
- [ ] Escalation fires only on a ticket with a **null `first_response_at`**, stamps `escalated_at` even when no target exists, and never reassigns a ticket to its current assignee.
- [ ] `php artisan schedule:list` shows `sla:evaluate` at `*/5 * * * *` with `withoutOverlapping`. **No `app/Console/Kernel.php` was created**, and **no queued job is dispatched anywhere in this story**.
- [ ] `/sla-rules` renders the real screen; `PagePlaceholder` no longer appears at that route; **`web/src/App.tsx` changes by exactly one `element` value** and the `RequireAuth roles={['administrator']}` wrapper is untouched.
- [x] **`navItems.tsx` is not edited**, and `navItems.test.ts` and `navRoutes.test.tsx` pass **unchanged**.
- [ ] The four cards match the artboard: tier badge, `RESPOND WITHIN` / `RESOLVE WITHIN` / `ON BREACH`, the pencil glyph, the 4px accent edge — and the Low card reads **`1 day` / `5 days`**, the deliberate deviation recorded in the Product-rules table.
- [ ] All four async states ship, each from its own component; the error state contains **no** stack trace and **no** API URL; the empty state names the consequence of having no rules.
- [ ] The subtitle's active-rule count is computed from the response and pluralises correctly. **Add Rule** is disabled with a stated, accessible reason when all four tiers are occupied.
- [ ] Every new token is declared in **all four** blocks of `web/src/index.css`; no `--sla-*` or `--prio-*` token from Story 04 is redefined; the tier chip is Story 04's `PriorityBadge`.
- [ ] Under RTL the accent edge is on the visual right from a single `border-inline-start` declaration — no `[dir="rtl"]` override and no second stylesheet — and the subtitle's numeral stays LTR.
- [ ] Below 900px the fact columns wrap and the page body never scrolls horizontally from 375px up.
- [ ] No `outline: none` without a replacement anywhere in this story; the skeleton respects `prefers-reduced-motion`; the modal traps focus, closes on Escape and restores focus to its opener; the deactivated-rule state carries a text chip, not colour alone.
- [ ] An Agent and a Team Lead both receive **403** on every `/api/sla-rules` route, and `SlaRulePolicy` is a **new** file — `TicketPolicy.php` gained no SLA ability.
- [ ] `php artisan test` and `npx vitest run` are both fully green, with `tests/Feature/TicketScopeTest.php` and `tests/Feature/ApiContractTest.php` **unedited**; `npm run build` and `npm run lint` are clean.
- [ ] `.squad/plans/sla-rules-automation/00-overview.md` records the Story 06 row and its dependency notes.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 07.**
