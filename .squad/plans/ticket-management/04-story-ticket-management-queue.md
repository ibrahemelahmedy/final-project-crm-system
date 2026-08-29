# Story 04 — Ticket Management (Queue) (Story: WIS-2)

## Prerequisites

- **Story 01 completed** — [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md). This story **expands** what Story 01 built and must not re-derive it:
  - `api/app/Enums/UserRole.php` **lines 5–28** — the closed set `agent` / `team_lead` / `administrator`, with `label()` and `homeRoute()`. **Do not add a role.**
  - `api/app/Models/User.php` **lines 42–50** — `isAdministrator()` and `canSeeTeamQueue()`. Every role decision in this story goes through those two methods; **do not introduce a permissions package**.
  - `api/app/Models/Ticket.php` **lines 26–32** — `scopeVisibleTo()`, the server-side row filter. This story keeps it and extends it; it does **not** replace the filtering strategy with a client-side one.
  - `api/database/migrations/2026_08_25_200001_create_tickets_table.php` — **the minimal scaffold. Read it, never edit it.** See the Product-rules table.
  - `api/app/Models/AuditLog.php` **lines 35–49** — `AuditLog::record()`. **Ticket history is a separate, domain-level table (`ticket_events`); do not write ticket lifecycle changes into `audit_logs`, and do not create a second auth-audit table.**
  - `web/src/lib/api.ts` **lines 10–23** — the single Axios instance and the only place a Bearer token is attached. **Do not create a second Axios client.**
  - `web/src/lib/queryClient.ts` **lines 3–13** — the one `QueryClient` singleton. `queries.staleTime` is **30 000 ms** and `mutations.retry` is **false**; **do not relax either**.
- **Story 02 completed** — [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md). This story fills one of the shell's slots:
  - `web/src/App.tsx` **line 201** currently renders `<PagePlaceholder title="Tickets" />` at `/tickets`. This story replaces that element.
  - `web/src/app/navigation/navItems.tsx` **lines 39–47** already defines the **Tickets** nav item pointing at `/tickets`. **Do not add a nav entry**; the path already resolves.
  - `web/src/app/layouts/AppLayout.tsx` **lines 151–157** — the header's **New Ticket** button, currently `disabled title="Coming soon"`. This story wires it. See Frontend Task 8.
  - `web/src/index.css` **lines 20–125** — the three-block token structure (bare `:root`, then `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`, then `:root[data-theme="dark"]`, then `:root[data-theme="light"]`). Every token this story adds must be declared in **all four** blocks that the existing tokens use, or an explicit theme choice stops winning in one direction.
- **Story 03 must land before this story's migration runs** — [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md). Story 03 **owns** the `customers` table, the `Customer` model, `CustomerFactory`, `CustomerResource`, `CustomerPolicy`, and `GET/POST/PATCH /api/customers`. This story only:
  - adds `tickets.customer_id` as `foreignId('customer_id')->constrained('customers')`;
  - declares `Ticket::customer()` as a `belongsTo(Customer::class)`;
  - reads **`id` and `name` only** off that relation in `TicketResource`.

  **Do not specify, add to, or assume any other column on `customers`.** The new migration's filename timestamp must sort **after** Story 03's `create_customers_table` migration, or `constrained('customers')` fails with "no such table".
- **Coordination — contracts this story owns and others consume.** Stories **05, 06, 07, 11, 12, 13, 14** read the `Priority` / `TicketStatus` / `Channel` enums, the `ticket_events` history table, `resolved_at` / `closed_at`, and the `TicketResource` JSON shape defined below. None of them redefines any of it. See **Shared contracts this story establishes** near the end of this file — later plans cite that section verbatim.
- **SLA fields are owned by Story 06** ([`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md)): `first_response_due_at`, `resolution_due_at`, the auto-assignment rule, and the SLA-risk computation. **This story does not compute SLA.** It ships the column, its four design tokens, and a fixed-shape `sla` object in the JSON that Story 06 fills without changing the shape.
- **Conversation thread / `ticket_messages` is Story 05.** Out of scope here — no message table, no thread UI, no reply composer.
- **Verified toolchain state** (checked at plan time — do not re-derive):

  | Where | Package / setting | Actual value | Matters because |
  |---|---|---|---|
  | `api/composer.json` **line 9** | `laravel/framework` | **^13.17** | `->change()` works on SQLite without `doctrine/dbal`; `Schema::table()` supports inline `constrained()` on a new column. |
  | `api/composer.json` **line 18** | `pestphp/pest` | **^5.1** | Test syntax below matches `tests/Feature/TicketScopeTest.php`. |
  | `api/tests/Pest.php` **line 4** | `pest()->extend(TestCase::class)->in('Feature')` | — | **Only `Feature/` is bound to the Laravel TestCase.** A test needing `RefreshDatabase` must live under `tests/Feature/`, not `tests/Unit/`. |
  | `api/phpunit.xml` **line 26** | `DB_CONNECTION` | **`sqlite`** | Tests run on SQLite regardless of `.env`. Every migration must be driver-portable. |
  | `api/.env` | `DB_CONNECTION` | **`pgsql`** (Supabase pooler) | Local dev now runs on PostgreSQL. **Both drivers must work.** Precedent for a driver guard: `api/database/migrations/2026_08_25_200000_create_audit_logs_table.php` **lines 24–26**. |
  | `web/package.json` **line 20** | `react-router-dom` | **7.18.2** | `useSearchParams` is available — the filter-state-in-URL requirement depends on it. |
  | `web/package.json` **line 14** | `@tanstack/react-query` | **5.102.3** | `placeholderData: keepPreviousData` is available; needed so paging does not flash the skeleton. |
  | `web/package.json` **line 21** | `zod` | **4.4.3** | Zod 4 syntax. `z.enum([...])`, `z.coerce.number()`. |
  | `web/package.json` **lines 6–11** | scripts | `dev`, `build`, `lint`, `preview` | **There is no `test` script.** Run `npx vitest run`. Lint is `npm run lint` (oxlint 1.79.0). |

---

## Story Goal

Turn the placeholder `Ticket` scaffold into the project's core domain entity, and build the **Ticket Queue** — the screen an agent lives in — as a structured, server-paginated, server-filtered list.

User-visible outcomes:

1. An authenticated user opens `/tickets` and sees a real queue: one row per ticket showing **channel icon, ID, subject, customer, priority, status, assignee, SLA-risk, and last-updated**.
2. An **Agent** sees only tickets assigned to them. A **Team Lead** or **Administrator** sees the whole queue and can reassign any ticket. The narrowing happens **in the SQL query**, never in the browser.
3. Filters (priority × status × channel × agent × category, plus a subject search) are **faceted, multi-select, and reflected in the URL** — the view is shareable, bookmarkable, and survives a refresh.
4. Pagination is **server-side**. The page size and page number live in the URL.
5. Selecting rows raises a **bulk-action bar** naming the selection count, offering **Assign** and **Close**, each behind a confirmation that names the count and the action. The server validates **per row** and reports which rows it skipped.
6. Creating a ticket requires a **customer**, a **category**, and a **priority**, and never silently assigns the ticket to its creator.
7. Every status, priority, assignment, and category change is recorded in **ticket history** with who changed it and when.
8. The screen ships **all four async states** — loading skeleton, error, empty (explaining why and offering "Clear filters"), success.
9. On a narrow viewport the table becomes stacked cards in which **priority, status, and SLA-risk stay visible per row** — not hidden behind a drill-in.
10. Under `dir="rtl"` the column order fully mirrors while the priority/status/SLA colours keep their meaning.

**In scope beyond the obvious:** expanding the `tickets` table via a **new** migration, three new PHP enums, a `ticket_events` history table with a model observer that writes it, a `TicketFactory`, an extended `DatabaseSeeder`, and the queue/priority/status/SLA design tokens that Stories 05–14 will reuse.

**Explicitly NOT in scope:**

- The conversation thread, message timeline, and reply composer — **Story 05**.
- SLA rule configuration, the escalation engine, auto-assignment, and the auto-close-after-5-days rule — **Story 06**. This story exposes `resolved_at` and `closed_at` and the `sla` JSON slot those rules drive.
- Real inbound-channel ingestion (an actual email/WhatsApp/SMS/web-form connector). **`channel` is a static enum set manually or by the seeder.**
- AI auto-categorisation and suggested replies — deferred, no story owns them.
- Attachments. The New Ticket modal export (`docs/design/references/5.Modals/WisalModals-LightLTR.dc.html` **lines 116–121**) shows a drop zone; see the Product-rules table for why it is rendered inert here.
- Arabic strings. RTL **layout** is this story; the Arabic **catalogue** is Story 15. Ship English strings with the `labelKey`-style discipline already used in `navItems.tsx`.
- A `/tickets/{id}` detail route. The queue row links nowhere yet — see Frontend Task 6.

---

## Context — Read These Files First

1. `api/database/migrations/2026_08_25_200001_create_tickets_table.php` — **the whole file, 27 lines.** Line **9** is a comment reading `// The Ticket Management story expands this table`. Note exactly what exists: `id`, `subject`, `status` (default `'open'`), `priority` (default `'normal'`), `assigned_to` (nullable FK to `users`, `nullOnDelete`), `timestamps()`, and `index('assigned_to')` on line 19. **This file is frozen. Never edit it, never rename it, never change its `down()`.**
2. `api/app/Models/Ticket.php` — the whole file, 33 lines. `$fillable` at **lines 14–19**; `assignee()` at **21–24**; `scopeVisibleTo()` at **26–32**, whose comment on **line 28** flags that the Team Lead branch is "all tickets" until a `teams` table lands. **This story does not create a `teams` table** — see the Product-rules table for how that debt is handled.
3. `api/app/Http/Controllers/TicketController.php` — the whole file, 23 lines. `index()` at **15–22** already calls `$this->authorize('viewAny', Ticket::class)` and `Ticket::visibleTo($request->user())->latest()->paginate(25)`. This story **replaces the body of `index()`** and adds four more actions.
4. `api/app/Http/Resources/TicketResource.php` — the whole file, 25 lines. The current shape is `id / subject / status / priority / assignee{id,name} / created_at / updated_at`. This story **replaces `toArray()`** while keeping `subject` and the email-free `assignee` shape, because `api/tests/Feature/TicketScopeTest.php` **lines 54–64** assert on both.
5. `api/app/Policies/TicketPolicy.php` — the whole file, 19 lines. `viewAny()` returns `true` (**line 12**); `view()` at **15–18** is `canSeeTeamQueue() || assigned_to === user->id`. This story **extends** this class with `create`, `update`, and `assign`; it does not rewrite `view()`.
6. `api/tests/Feature/TicketScopeTest.php` — the whole file, 77 lines. **The two `it(...)` blocks at lines 46 and 67 must keep passing with their assertions unchanged.** The `beforeEach` at **lines 10–44** creates tickets with only `subject` and `assigned_to` — that fixture **must change** once `customer_id` is required. See Backend Task 9 and the Test Plan.
7. `api/routes/api.php` — the whole file, 18 lines. `GET /api/tickets` is registered at **line 17** inside the `auth:sanctum` group (**lines 14–18**). This story **extends** that group; it does not restructure the file or add a new middleware group.
8. `api/app/Enums/UserRole.php` — **lines 5–28.** The `match ($this)` style in `label()` (**13–18**) and `homeRoute()` (**23–27**) is the precedent every new enum in this story follows. Backed enums, `string` values, snake_case values, `PascalCase` cases.
9. `api/app/Models/AuditLog.php` — **lines 15–33.** `public $timestamps = false;` plus a `created_at` cast. `TicketEvent` copies this exact shape (Backend Task 4).
10. `docs/design/references/2.ticket-queue/WisalTicketQueue-LightLTR.dc.html` — **the primary reference. Build from it; do not invent UI.** 199 lines. Read:
    - **Lines 76–82** — the page header block: title "Tickets" at `22px/700`, subtitle at `13px` `#64748B` reading "132 tickets · 5 approaching SLA breach". Container is `padding:24px 28px; display:flex; flex-direction:column; gap:16px`.
    - **Lines 84–93** — the **bulk-action bar**, shown in place of nothing (it stacks above the filter chips): `background:#EEF2FF; border:1px solid #C7D2FE; border-radius:10px; padding:10px 14px; gap:12px`. Count label at `13px/700 #4F46E5`; three buttons (**Assign**, **Change Status**, **Close**) at `padding:7px 12px; font-size:12.5px/600; border-radius:8px` on `#fff` with `1px solid #C7D2FE`; the **Close** button's text is `#B91C1C` (line 90); a dismiss `×` at the inline end (line 92).
    - **Lines 96–111** — the **filter chips**: `padding:6px 10px; border-radius:8px; font-size:12.5px/600; border:1px solid #E2E8F0`. An **active** chip carries a 6px `#4F46E5` dot and `color:#334155` (lines 97–100, 107–110); an **inactive** chip is `color:#64748B` with no dot (lines 101–106). Chevron `M5 8l7 7 7-7`.
    - **Line 113** — the table shell: `background:#fff; border:1px solid #E2E8F0; border-radius:10px; min-height:0; overflow:hidden`.
    - **Line 114** — the header row's grid: `grid-template-columns:32px 28px 70px 1.7fr 1fr 100px 110px 100px`, `padding:10px 14px`, `font-size:11px; font-weight:700; color:#94A3B8; letter-spacing:.02em`.
    - **Lines 116–121** — the column labels: (blank), (blank), **ID**, **SUBJECT**, **CUSTOMER**, **PRIORITY**, **STATUS**, **SLA LEFT**. Every sortable label carries a 10px double-chevron `M7 9l3-3 3 3 M7 15l3 3 3-3` in `#CBD5E1`. **SUBJECT has no sort affordance.**
    - **Lines 124–173** — ten data rows. Row height comes from `padding:10px 14px` at `font-size:12.5px`. Checkbox is a 16px `border-radius:4px` box, `1.5px solid #CBD5E1` unchecked (line 125) / solid `#4F46E5` with a white `M5 13l4 4L19 7` tick when checked (line 130). Zebra background `#F8FAFC` on alternate rows (lines 139, 154, 164); **selected** rows are `#EEF2FF` (lines 129, 144). Row border `1px solid #F1F5F9`; **the last row has none** (line 169).
    - **The exact badge values are in the Design tokens table below — read them from there, not by eye.**
    - **Lines 175–186** — the pagination footer: `border-top:1px solid #E2E8F0; padding:10px 14px; justify-content:space-between`. Left: "Showing 1–10 of 132" at `12px #64748B`. Right: 28×28 buttons, `border-radius:6px`; the current page is solid `#4F46E5` with white `12px/700` text; others are `#fff` with `1px solid #E2E8F0` and `#334155` text; an ellipsis `…` in `#94A3B8`; prev/next chevrons `M15 6l-6 6 6 6` and `M9 6l6 6-6 6`.
11. `docs/design/references/2.ticket-queue/WisalTicketQueue-DarkLTR.dc.html` — the dark palette, 197 lines. **Line 111** (table shell `#1C1D24` / border `#2A2C33`), **line 112** (header row text `#64748B`, sort chevrons `#3F4148`), **lines 122–172** (row border `#2A2C33`, zebra `#202128`, selected `rgba(129,140,248,0.12)`, unchecked checkbox border `#3F4148`, checked fill `#818CF8` with a `#121317` tick), **lines 84–91** (dark bulk bar: `rgba(129,140,248,0.12)` on `1px solid rgba(129,140,248,0.35)`, buttons on `#1C1D24`, Close text `#F87171`), **lines 173–185** (dark pagination: buttons `#121317` on `1px solid #2A2C33`, current page `#818CF8` with `#121317` text).
12. `docs/design/references/2.ticket-queue/WisalTicketQueue-EmptyState.dc.html` — 88 lines, light only. **This is the Empty state; build it.** Read **lines 65–76**: the subtitle becomes "0 results" (line 65); the filter chips that caused the emptiness render **active-and-removable** — `background:#EEF2FF; border:1px solid #C7D2FE; color:#4F46E5` with an `×` (`M18 6L6 18M6 6l12 12`) instead of a chevron (lines 67–68), while untouched filters keep the chevron (lines 69–70). The empty panel (lines 72–76) is the table shell centred, holding a 64px `#F1F5F9` circle with a 30px `#94A3B8` magnifier, a `16px/700` heading **"No tickets match your filters"**, a `13px #64748B` line **"Try removing "Urgent" or "Resolved" to see more results."**, and a solid `#4F46E5` **"Clear filters"** button at `padding:10px 18px; font-size:13.5px/600`.
13. `docs/design/references/2.ticket-queue/WisalTicketQueue-LoadingState.dc.html` — 107 lines, light only. **This is the Loading skeleton; build it.** Read **lines 12–15** for the `.sk` rule itself — `background:linear-gradient(90deg,#EEF0F3 25%,#F5F6F8 37%,#EEF0F3 63%); background-size:400% 100%; animation:shimmer 1.4s ease infinite; border-radius:6px` with `@keyframes shimmer{0%{background-position:100% 0;}100%{background-position:0 0;}}`. Read **lines 79–105**: a 100×26 title bar plus a 160×14 subtitle bar; four 30px-tall chip bars (110/100/120/100 wide); then **five** skeleton rows on a **simplified 7-column grid** `32px 70px 2fr 1fr 100px 110px 90px` with `padding:14px; gap:8px`, bars at `16×16 / 44×14 / 80%×14 / 70%×14 / 60×20 / 70×20 / 50×14`. **The skeleton's grid deliberately differs from the real table's grid** — see the Product-rules table.
14. **Grep before you copy — and this time the answer is "no defect".** `STATUS.md` **lines 49–53** records a recurring export bug: a class used in markup with no rule in `<style>`. Verified at plan time across all six files in `docs/design/references/2.ticket-queue/`:
    - `WisalTicketQueue-LightLTR`, `-DarkLTR`, `-LightRTL`, `-DarkRTL` contain **zero** `class="..."` attributes — every style is inline.
    - `-EmptyState` uses only `.fv`, and `.fv:focus-visible` **is** defined (line 14).
    - `-LoadingState` uses `.fv` and `.sk`, and **both are defined** (lines 14–16).

    The same check on `docs/design/references/5.Modals/`: the two light files use only `.fv` (defined), the two dark files use only `.fvd` (defined). **No missing-class defect in any file this story reads.** The real gap is different and larger: **the exports have no `<button>` for a row, no `<input type="checkbox">`, no `<th>`, no `aria-*` anywhere.** They are a *visual* reference. The entire accessible table structure in Frontend Task 5 is new work.
15. `docs/design/references/2.ticket-queue/WisalTicketQueue-LightRTL.dc.html` — 197 lines. Read it to learn **what mirroring must produce**, then implement it with logical properties rather than by copying. Three specifics:
    - **Line 53** — the `⌘K` badge carries `direction:ltr`.
    - **Lines 125–170** — every ticket ID span carries `direction:ltr` (`#4821` must not render as `4821#`).
    - **Lines 80, 85, 174** — bare numerals inside Arabic sentences are wrapped in `<span style="direction:ltr;display:inline-block;">`.
    - **Defect to correct, not copy:** the RTL export **does not mirror the pagination chevrons** — line 176 still uses `M15 6l-6 6 6 6` for "previous". `docs/design/brief.md` **line 202** requires directional icons to mirror. See Frontend Task 7.
16. `docs/design/references/5.Modals/WisalModals-LightLTR.dc.html` — the **New Ticket** modal, **lines 45–101**. Panel: `width:620px; border-radius:16px; box-shadow:0 25px 60px rgba(15,23,42,0.3)`, backdrop `rgba(15,23,42,0.45)` (line 43). Header `padding:18px 22px` with a `16px/700` title and a 30px close button. Body `padding:20px 22px; gap:16px`. Fields in order: **Subject** (line 50), **Customer** (a search input with a result list, lines 53–68), **Priority** (four segmented buttons, lines 71–77), **Channel** (a `<select>`, lines 80–84), **Description** (a textarea, line 87), **Attachments** (a dashed drop zone, lines 90–95). Footer `padding:16px 22px; border-top` with **Cancel** (outline) and **Create Ticket** (solid `#4F46E5`, `13px/700`). Label style throughout: `12.5px/600 #334155; margin-bottom:6px`. Input style: `border:1px solid #E2E8F0; border-radius:8px; padding:9px 12px; font-size:13px`. The four priority buttons carry the priority tint pairs directly — Normal is the selected one (`border:2px solid #2563EB; background:#EFF6FF; font-weight:700`).
17. `docs/design/references/5.Modals/WisalModals-LightLTR.dc.html` **lines 138–151** — the **destructive confirmation dialog**; the bulk-Close confirmation in Frontend Task 9 is built from it. 380px panel, `border-radius:14px; padding:22px; gap:14px`, backdrop `rgba(15,23,42,0.55)`. A 36px `#FEF2F2` circle with a `#DC2626` warning glyph `M12 9v4 M12 17h.01 M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z`; a `15px/700` question; a `13px #475569; line-height:1.6` body **naming the specific record**; Cancel + a solid `#DC2626` confirm. Dark equivalents in `WisalModals-DarkLTR.dc.html` **lines 119–125** (`rgba(248,113,113,0.14)` circle, `#F87171` confirm with `#121317` text).
18. `docs/design/references/14.WisalChannels/WisalChannels-LightLTR.dc.html` — **the authority for the channel set.** Five channels and no more: **Email** (line 100), **WhatsApp** (line 109), **Live chat** (line 118), **SMS** (line 127), **Web forms** (line 136). All five are marked "Not connected" — consistent with this story's out-of-scope note that no real ingestion exists.
19. `docs/design/brief.md` — **lines 96–110** (the `priority`, `status`, and `badge_text_on_tint` token blocks — **binding**, and the reason light-theme badge text uses `#B45309`/`#B91C1C` rather than the general warning/danger values), **lines 136–150** (the Ticket Queue layout pattern, including the RTL rule and the explicit "priority, status, and SLA risk must be visible *together*"), **lines 181–187** (the four required states, plus "Destructive actions add a **Confirmation** state naming the specific record"), **lines 189–197** (accessibility: `outline:none` without a replacement is forbidden; `prefers-reduced-motion` respected; **colour is never the only signal**), **lines 199–206** (RTL mirrors layout, column order, and directional icons), **lines 217–218** (**do not conflate priority and status into one badge**).
20. `web/src/features/auth/` — **the feature-folder convention this story follows.** Note what is there: `AuthContext.tsx`, `LoginPage.tsx`, `RequireAuth.tsx`, `loginSchema.ts`, `useLogin.ts`, plus colocated `*.test.tsx`. Note what is *not* there: no `src/pages/`, no layer-first folders. `useLogin.ts` **lines 11–14** is the `useMutation` precedent.
21. `web/src/app/navigation/navRoutes.test.tsx` **lines 13–60** and `web/src/app/layouts/AppLayout.test.tsx` **lines 10–45** — **the test precedent to match exactly**: `vi.mock('../../lib/api')` spreading `importActual` and replacing only `api`, a `makeUser()` factory, and a `SignedInAs` wrapper that drives a real `login()` through `AuthProvider` instead of hand-mocking `useAuth`. **Copy this pattern; do not invent a new one.**
22. `web/src/index.css` **lines 415–421** — `.shell-main` already carries `min-inline-size: 0; overflow-x: auto; padding-block: 24px; padding-inline: 28px`. **The queue page must not add its own outer padding**, or it doubles.

---

## Product rules — where this plan resolves a conflict

Each row is a deliberate decision, verified against the file it cites. Do not silently revert one.

| Source says | This plan does | Why |
|---|---|---|
| A `tickets` table already exists with `status` and `priority` columns | **Add a new migration that `Schema::table('tickets', …)` — never touch `2026_08_25_200001_create_tickets_table.php`** | That file's own line 9 says the Ticket Management story *expands* the table. Editing an applied migration desynchronises every environment that already ran it, and rewrites project history. The scaffold's `status`/`priority` string columns and their defaults are **kept as-is** and simply gain enum casts. |
| Intake AC: a ticket "requires a customer" | `tickets.customer_id` is added **nullable + FK in migration A**, then flipped to **NOT NULL in migration B** after orphan demo rows are removed | A `NOT NULL` column cannot be added to a table that already holds rows, and this story may not invent a `customers` row to backfill with — Story 03 owns that table's columns, and reaching into them is exactly the coupling the ownership split prevents. Two small migrations make the intent legible and the failure loud. |
| Story 01's `Ticket::scopeVisibleTo()` comment: narrow the Team Lead branch "once teams exist" | **No `teams` table in this story.** `scopeVisibleTo()` keeps its `canSeeTeamQueue() ? all : own` shape, and the debt note in `.squad/plans/ticket-management/00-overview.md` is **re-pointed at Story 08** (`users-roles-admin`) | Teams are a *user-administration* concept, not a ticket concept. Building a `teams` table here would mean designing user grouping, membership, and a management UI inside the ticket story — scope that Story 08 already owns. The comment on `Ticket.php` line 28 is updated to name Story 08 instead of "Ticket Management story". |
| Intake AC: a new ticket "follows the auto-assignment rule from WIS-6 (or is left Unassigned if that story is not yet built)" | `POST /api/tickets` leaves `assigned_to` **null** unless the request explicitly names an assignee **and** the actor may assign | The intake gives the fallback in its own words. The load-bearing half of the criterion — "it is never silently assigned to the creator" — is enforced here by a test that creates a ticket as an Agent and asserts `assigned_to` is `null`. `created_by` is recorded separately so the creator is still known. |
| Design exports show **eight** columns and no assignee and no last-updated | **Nine columns.** Insert **ASSIGNEE** between STATUS and SLA LEFT; render **last-updated** as a muted second line inside the SUBJECT cell | `docs/design/brief.md` line 143 and the intake both name assigned agent *and* last-updated as per-row facts. The export depicts an **Agent's own** queue (its Agent filter chip reads "Agent: Me", line 108) where an assignee column is redundant — but a Team Lead needs it. Adding a tenth column would break the density the reviewed design commits to; a secondary line under the subject does not. New grid: `32px 28px 70px 1.5fr 1fr 100px 110px 120px 100px`. |
| The Loading export uses a **7**-column grid (`32px 70px 2fr 1fr 100px 110px 90px`, line 82) while the real table uses **8** | **The skeleton uses the same nine-column grid as the real table.** Keep the export's bar widths and `padding:14px; gap:8px`, but not its column template | A skeleton whose columns do not line up with the table that replaces it produces a visible jump on load — the exact layout shift a skeleton exists to prevent. The export's grid mismatch is an artefact of it being drawn separately, not a design decision. |
| Design defines status tokens for **open / pending / resolved** only (`brief.md` lines 104–106); no export depicts a **CLOSED** badge | **`closed` is decided here**: light `#334155` on `#E2E8F0`; dark `#CBD5E1` on `rgba(203,213,225,0.14)` | `DatabaseSeeder.php` line 87 already writes `'status' => 'closed'`, and the intake's auto-close criterion requires `closed_at`. A closed status must render. Deliberately a *darker* slate than **LOW priority** (`#64748B` on `#F1F5F9`) so the two never read as the same chip in adjacent columns — `brief.md` line 217 forbids conflating the two token sets, and two near-identical greys side by side is the same mistake in a quieter form. |
| Intake AC: a ticket requires a **category**; the New Ticket modal export has no category field | **Add a Category `<select>` to the modal, between Customer and Priority.** Store `category` as a plain **`string`** column validated against `Ticket::CATEGORIES`, **not** an `App\Enums` enum | The AC is explicit and the modal export predates it. `category` is kept out of `app/Enums/` on purpose: the three enums this story owns are closed sets that later stories bind code to, whereas the category list is the one that an Administrator will plausibly want to edit (Story 08). A string column plus a constant is trivially promotable to a config table later; an enum consumed by seven stories is not. |
| The New Ticket modal export shows an **Attachments** drop zone (lines 90–95) | Render it, **inert**: a `<div aria-hidden="true">` with `title="Coming soon"`, no file input, no handler | Deleting it makes the modal stop matching the reviewed design; wiring it invents file storage, virus scanning, and a retention policy that no story owns. An affordance that is visibly inert is honest. **Do not attach an `<input type="file">`.** |
| Design shows ticket ids as `#4821` | Render `#{id}` from the primary key. **No `reference` column** | A separate human-readable reference column adds a uniqueness constraint, a generator, and a backfill for a value the primary key already provides. The `#` prefix is presentation, applied in `TicketResource` as `reference` so the SPA never string-builds it. |
| Design's SLA LEFT column shows live countdowns ("12m", "47m", "1h 20m") | **Every row renders `—` in `--sla-none` until Story 06 lands**, with `title`/`aria-label` "SLA not configured" | Story 06 owns the computation, and the export itself already depicts the `—` case for a resolved row (LightLTR line 157, `color:#94A3B8`). Faking a countdown from `created_at` would ship a number that means nothing and that Story 06 would then have to unpick. **The column, its four tokens, and the JSON slot exist from this story** — that is the whole contract. |
| Story 02 shipped the header **New Ticket** button `disabled title="Coming soon"` (`AppLayout.tsx` lines 151–157) | Replace it with `<Link to="/tickets?new=1">` and drop `disabled` | The shell must not hold feature state. A URL parameter makes "open the create modal" a routable, shareable, back-button-correct fact that `TicketQueuePage` reads — with no cross-feature store and no context threaded through the layout. |
| The intake calls for a bulk **"Change Status"** action; the design bar has three buttons (Assign / Change Status / Close) | Ship **Assign** and **Close** as working actions; **Change Status** opens the same status menu but is limited to the transitions the policy allows per row | "Close" *is* a status change, so the two buttons overlap. Rather than delete a depicted control, Close is the one-click common case and Change Status is the general form. Both funnel through the **same** `POST /api/tickets/bulk` endpoint and the **same** per-row authorization. |
| `docs/design/brief.md` line 202: RTL mirrors directional icons | **Mirror the pagination chevrons under RTL** | The RTL export does not (line 176 keeps `M15 6l-6 6 6 6` for "previous"). The brief is the later, binding rule; the export is a defect here. Swap the two paths on `dir === 'rtl'` — **do not** apply `transform: scaleX(-1)`, which also mirrors the focus ring. |

---

## Backend Tasks

Every path in this section is relative to `api/`. Run PHP from **PowerShell** via Laravel Herd: `& "C:\Users\ibrah\.config\herd\bin\php84\php.exe" artisan …`.

### 1 — The three enums

**Create file: `app/Enums/Priority.php`**

```php
<?php

namespace App\Enums;

use Illuminate\Contracts\Database\Query\Expression;
use Illuminate\Support\Facades\DB;

enum Priority: string
{
    case Low = 'low';
    case Normal = 'normal';
    case High = 'high';
    case Urgent = 'urgent';

    public function label(): string
    {
        return match ($this) {
            self::Low => 'Low',
            self::Normal => 'Normal',
            self::High => 'High',
            self::Urgent => 'Urgent',
        };
    }

    /** Ascending urgency. Used for sorting — never persisted. */
    public function weight(): int
    {
        return match ($this) {
            self::Low => 1,
            self::Normal => 2,
            self::High => 3,
            self::Urgent => 4,
        };
    }

    /**
     * Sorting on the raw string column orders alphabetically
     * (high, low, normal, urgent) — which is wrong in every direction.
     * Order by this expression instead.
     */
    public static function sortExpression(): Expression
    {
        return DB::raw(
            "CASE tickets.priority "
            ."WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 "
            ."WHEN 'normal' THEN 2 WHEN 'low' THEN 1 ELSE 0 END"
        );
    }

    /** @return array<int, array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases()
        );
    }
}
```

**Create file: `app/Enums/TicketStatus.php`** — same shape, plus the transition graph. **The graph is the single source of truth for what `PATCH /api/tickets/{ticket}` accepts**; do not duplicate the rules in the FormRequest.

```php
enum TicketStatus: string
{
    case Open = 'open';
    case Pending = 'pending';
    case Resolved = 'resolved';
    case Closed = 'closed';

    public function label(): string { /* Open | Pending | Resolved | Closed */ }

    /** A closed ticket is finished; a resolved one can still be reopened by a reply. */
    public function isClosed(): bool
    {
        return $this === self::Closed;
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open     => [self::Pending, self::Resolved, self::Closed],
            self::Pending  => [self::Open, self::Resolved, self::Closed],
            self::Resolved => [self::Open, self::Closed],
            self::Closed   => [self::Open],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }

    public static function options(): array { /* as Priority::options() */ }
}
```

**A transition to the same status is not allowed** — `allowedTransitions()` never contains `$this`, so a no-op `PATCH` returns **422** rather than silently writing a history row that records nothing.

**Create file: `app/Enums/Channel.php`**

```php
enum Channel: string
{
    case Email = 'email';
    case Whatsapp = 'whatsapp';
    case Chat = 'chat';
    case Sms = 'sms';
    case WebForm = 'web_form';

    public function label(): string
    {
        return match ($this) {
            self::Email => 'Email',
            self::Whatsapp => 'WhatsApp',
            self::Chat => 'Live chat',
            self::Sms => 'SMS',
            self::WebForm => 'Web form',
        };
    }

    public static function options(): array { /* as Priority::options() */ }
}
```

The five cases and their labels come from `docs/design/references/14.WisalChannels/WisalChannels-LightLTR.dc.html` lines 100, 109, 118, 127, 136. **Do not add a sixth channel.** Story 14 renders this same set read-only.

### 2 — Migration A: expand the `tickets` table

**Create file: `database/migrations/2026_08_26_100000_expand_tickets_table.php`**

**The timestamp must sort after Story 03's `create_customers_table` migration.** Check `database/migrations/` before writing the filename; if Story 03 used a later date, move this one past it.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Expands the minimal tickets scaffold created in
     * 2026_08_25_200001_create_tickets_table.php (Story 01). That file is
     * frozen — every ticket column added after it lands here or later.
     */
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            // Nullable here; migration B flips it to NOT NULL after cleanup.
            $table->foreignId('customer_id')->nullable()->after('subject')
                ->constrained('customers')->restrictOnDelete();

            $table->foreignId('created_by')->nullable()->after('assigned_to')
                ->constrained('users')->nullOnDelete();

            $table->text('description')->nullable()->after('subject');
            $table->string('category', 32)->default('general')->after('priority');
            $table->string('channel', 16)->default('email')->after('category');

            $table->timestamp('resolved_at')->nullable()->after('channel');
            $table->timestamp('closed_at')->nullable()->after('resolved_at');

            // Composite indexes chosen for the queue's actual access paths:
            // an Agent's own queue sorted newest-first, and the faceted filters.
            $table->index(['assigned_to', 'status', 'created_at'], 'tickets_agent_queue_index');
            $table->index(['status', 'priority'], 'tickets_status_priority_index');
            $table->index('customer_id');
            $table->index('channel');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropIndex('tickets_agent_queue_index');
            $table->dropIndex('tickets_status_priority_index');
            $table->dropIndex(['channel']);
            $table->dropConstrainedForeignId('customer_id');
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn(['description', 'category', 'channel', 'resolved_at', 'closed_at']);
        });
    }
};
```

Four details that are each a real failure if missed:

- **`restrictOnDelete()` on `customer_id`, not `cascadeOnDelete()`.** A customer with tickets must not be deletable in a way that silently destroys support history. Story 03's delete flow will get a 409 from the database, which is the correct answer.
- **`nullOnDelete()` on `created_by`**, matching `assigned_to`'s existing behaviour (`create_tickets_table.php` line 17). Deleting a user must not delete their tickets.
- **`->after(...)` is a MySQL-only hint** and is silently ignored on both SQLite and PostgreSQL. It is kept for readability. **Do not rely on physical column order anywhere.**
- **`$table->index('customer_id')` is separate from the FK.** PostgreSQL does *not* auto-index the referencing side of a foreign key; the Customer filter would table-scan without it.

### 3 — Migration B: make `customer_id` required

**Create file: `database/migrations/2026_08_26_100100_require_tickets_customer_id.php`**

```php
public function up(): void
{
    // The only rows that can lack a customer are the four demo tickets the
    // Story 01 seeder created before this column existed. Story 04's seeder
    // recreates them with customers. Deleting them here is what lets the
    // NOT NULL constraint go on cleanly in an environment that has already
    // been migrated once.
    DB::table('tickets')->whereNull('customer_id')->delete();

    Schema::table('tickets', function (Blueprint $table) {
        $table->foreignId('customer_id')->nullable(false)->change();
    });
}

public function down(): void
{
    Schema::table('tickets', function (Blueprint $table) {
        $table->foreignId('customer_id')->nullable()->change();
    });
}
```

- **In test runs this delete is a no-op** — `RefreshDatabase` migrates an empty database, so both migrations run against zero rows.
- **In local dev, run `php artisan migrate:fresh --seed`** rather than relying on the delete. The delete exists so a developer who runs a plain `migrate` does not hit a constraint violation they cannot diagnose.
- **`->change()` on SQLite rebuilds the table.** Laravel 13 does this natively without `doctrine/dbal`, and it preserves the indexes declared through the schema builder. It is why migration B declares **no** index changes — mixing a `->change()` with index edits in one closure is where SQLite rebuilds lose indexes.

### 4 — The ticket history table and model

**Create file: `database/migrations/2026_08_26_100200_create_ticket_events_table.php`**

```php
Schema::create('ticket_events', function (Blueprint $table) {
    $table->id();
    $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
    $table->string('event', 32);          // created | status_changed | priority_changed
                                          // | assigned | unassigned | category_changed | reopened
    $table->string('field', 32)->nullable();
    $table->string('old_value')->nullable();
    $table->string('new_value')->nullable();
    $table->timestamp('created_at')->useCurrent();
    $table->index(['ticket_id', 'created_at']);
});
```

- **`cascadeOnDelete()` on `ticket_id`** — history has no meaning without its ticket, and it is the only cascade in this story.
- **`nullOnDelete()` on `user_id`** — a deleted agent must not erase the record that a change happened. Renders as "Deleted user".
- **No `updated_at`.** History is append-only. The shape mirrors `audit_logs` (`2026_08_25_200000_create_audit_logs_table.php` line 20).
- **`old_value` / `new_value` are strings, not JSON.** Every value this story records is a scalar enum value or a user id. A JSON column here would invite later stories to stuff arbitrary payloads into ticket history, which is what `audit_logs` is for.

**Create file: `app/Models/TicketEvent.php`** — copy the shape of `app/Models/AuditLog.php` lines 15–33:

```php
class TicketEvent extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'ticket_id', 'user_id', 'event', 'field', 'old_value', 'new_value', 'created_at',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function ticket(): BelongsTo { return $this->belongsTo(Ticket::class); }

    public function actor(): BelongsTo { return $this->belongsTo(User::class, 'user_id'); }
}
```

**This is the ticket-history table Stories 05, 06, 07, 11, 12 and 13 write to and read from. Do not create a second one, and do not route ticket lifecycle changes into `audit_logs`** — that table is Story 01's authentication audit and its `event` values are `login.*` / `logout`.

### 5 — `app/Models/Ticket.php` — **extend, do not replace**

Keep `assignee()` (lines 21–24) and `scopeVisibleTo()` (lines 26–32) exactly as they are. Change three things and add five.

**Change 1 — `$fillable` (lines 14–19)** becomes:

```php
protected $fillable = [
    'subject', 'description', 'customer_id', 'status', 'priority',
    'category', 'channel', 'assigned_to', 'created_by',
    'resolved_at', 'closed_at',
];
```

**Change 2 — add a `casts()` method**, following `app/Models/User.php` lines 31–40 (the method form, not a `$casts` property):

```php
protected function casts(): array
{
    return [
        'status' => TicketStatus::class,
        'priority' => Priority::class,
        'channel' => Channel::class,
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
    ];
}
```

**`category` is deliberately not cast** — it is a plain string validated against the constant below.

**Change 3 — the comment on line 28.** It currently says the `teams` table lands "in Ticket Management story". Rewrite it to name **Story 08 (`users-roles-admin`)**, which owns user grouping. The code below it does not change.

**Add 1 — the category allow-list**, as a class constant so the FormRequest, the meta endpoint, and the seeder all read one list:

```php
public const CATEGORIES = ['general', 'billing', 'technical', 'account', 'feature_request'];

public static function categoryLabel(string $category): string
{
    return match ($category) {
        'billing' => 'Billing',
        'technical' => 'Technical',
        'account' => 'Account',
        'feature_request' => 'Feature request',
        default => 'General',
    };
}
```

**Add 2 — relations:**

```php
public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
public function events(): HasMany { return $this->hasMany(TicketEvent::class)->latest('created_at'); }
```

**Add 3 — `scopeFilter(Builder $query, array $filters): Builder`.** One place where every facet is applied, so the list endpoint and any later count query cannot drift:

```php
public function scopeFilter(Builder $query, array $filters): Builder
{
    return $query
        ->when($filters['status'] ?? null, fn ($q, $v) => $q->whereIn('status', $v))
        ->when($filters['priority'] ?? null, fn ($q, $v) => $q->whereIn('priority', $v))
        ->when($filters['channel'] ?? null, fn ($q, $v) => $q->whereIn('channel', $v))
        ->when($filters['category'] ?? null, fn ($q, $v) => $q->whereIn('category', $v))
        ->when($filters['customer_id'] ?? null, fn ($q, $v) => $q->whereIn('customer_id', $v))
        ->when($filters['q'] ?? null, fn ($q, $v) => $q->where('subject', 'like', '%'.$v.'%'))
        ->when($filters['assigned_to'] ?? null, function ($q, $v) {
            $unassigned = in_array('unassigned', $v, true);
            $ids = array_values(array_filter($v, fn ($x) => $x !== 'unassigned'));

            return $q->where(function ($inner) use ($unassigned, $ids) {
                if ($ids) {
                    $inner->whereIn('assigned_to', $ids);
                }
                if ($unassigned) {
                    $inner->orWhereNull('assigned_to');
                }
            });
        });
}
```

Three things this gets right that the obvious version does not:

- **The `assigned_to` group is wrapped in its own closure.** Without the wrapping `where(function …)`, the `orWhereNull` escapes to the top level of the query and **defeats `scopeVisibleTo()`** — an Agent filtering by "Unassigned" would see every unassigned ticket in the company. This is the single most dangerous line in the story.
- **`'unassigned'` is a sentinel value inside the `assigned_to` array**, not a separate parameter. It keeps one filter concept in one URL key.
- **`like '%…%'` on `subject` only.** Searching `description` too would need a full-text index this story does not add; the header search affordance stays inert (Story 02's decision) and this `q` parameter is only used by the queue's own filter row.

**Add 4 — `scopeSorted(Builder $query, ?string $sort): Builder`.** A closed set, because an unvalidated `orderBy` off a query string is an injection surface:

```php
public function scopeSorted(Builder $query, ?string $sort): Builder
{
    $direction = str_starts_with((string) $sort, '-') ? 'desc' : 'asc';
    $column = ltrim((string) $sort, '-');

    return match ($column) {
        'id' => $query->orderBy('tickets.id', $direction),
        'priority' => $query->orderBy(Priority::sortExpression(), $direction),
        'status' => $query->orderBy('tickets.status', $direction),
        'updated_at' => $query->orderBy('tickets.updated_at', $direction),
        'customer' => $query->orderBy(
            Customer::select('name')->whereColumn('customers.id', 'tickets.customer_id'),
            $direction
        ),
        default => $query->latest('tickets.created_at'),   // matches the current index() behaviour
    };
}
```

**The `default` branch preserves `->latest()` from `TicketController@index` line 20**, so the existing `TicketScopeTest` ordering assumptions do not move. **`sla` is not a sortable column** — there is nothing to sort on until Story 06; the SLA header renders without a sort affordance.

**Add 5 — a `booted()` hook that writes history.** Put it on the model rather than in the controller, so a change made from Tinker, a seeder, or a future Story 06 job is recorded too:

```php
protected static function booted(): void
{
    static::created(fn (Ticket $t) => $t->recordEvent('created'));

    static::updated(function (Ticket $t) {
        foreach (['status', 'priority', 'category'] as $field) {
            if ($t->wasChanged($field)) {
                $t->recordEvent($field.'_changed', $field,
                    (string) ($t->getOriginal($field) instanceof \BackedEnum
                        ? $t->getOriginal($field)->value
                        : $t->getOriginal($field)),
                    (string) ($t->{$field} instanceof \BackedEnum ? $t->{$field}->value : $t->{$field}));
            }
        }

        if ($t->wasChanged('assigned_to')) {
            $t->recordEvent(
                $t->assigned_to === null ? 'unassigned' : 'assigned',
                'assigned_to',
                (string) $t->getOriginal('assigned_to'),
                (string) $t->assigned_to
            );
        }
    });
}

protected function recordEvent(string $event, ?string $field = null, ?string $old = null, ?string $new = null): void
{
    TicketEvent::create([
        'ticket_id' => $this->id,
        'user_id' => auth()->id(),   // null for seeder / console writes — intended
        'event' => $event,
        'field' => $field,
        'old_value' => $old,
        'new_value' => $new,
        'created_at' => now(),
    ]);
}
```

- **`getOriginal()` returns the cast value**, so an enum comes back as a `BackedEnum` and must be unwrapped — writing `(string) $enum` throws. This is the most likely runtime error in this task.
- **`auth()->id()` is null in seeders and console commands.** That is correct and the column is nullable; the SPA renders "System".
- **A `reopened` event** is written by the controller (not the observer) when the target status is `Open` and the previous status was `Resolved` or `Closed`, because that is a semantic distinction `wasChanged` cannot see.

### 6 — Requests, resources, and the policy

**Create file: `app/Http/Requests/StoreTicketRequest.php`**

```php
public function authorize(): bool
{
    return $this->user()->can('create', Ticket::class);
}

public function rules(): array
{
    return [
        'subject'     => ['required', 'string', 'max:255'],
        'description' => ['nullable', 'string', 'max:5000'],
        'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')],
        'category'    => ['required', Rule::in(Ticket::CATEGORIES)],
        'priority'    => ['required', Rule::enum(Priority::class)],
        'channel'     => ['required', Rule::enum(Channel::class)],
        'assigned_to' => ['nullable', 'integer', Rule::exists('users', 'id')],
    ];
}
```

- **`status` is not accepted on create.** Every new ticket is `open` — the column default from the scaffold migration. Accepting it would let a client create a ticket that is already closed, bypassing the transition graph and its history rows.
- **`assigned_to` is `nullable` and, when present, is additionally checked in the controller against `TicketPolicy::assign`.** A `Rule::exists` says the user is real, not that the actor may assign to them.

**Create file: `app/Http/Requests/UpdateTicketRequest.php`** — all fields `sometimes`, plus `'status' => ['sometimes', Rule::enum(TicketStatus::class)]`. **The transition legality is checked in the controller against `TicketStatus::canTransitionTo()`, not here**, because the FormRequest cannot see the resolved model cleanly and duplicating the graph is how the two drift.

**Create file: `app/Http/Requests/BulkTicketActionRequest.php`**

```php
'ids'         => ['required', 'array', 'min:1', 'max:100'],
'ids.*'       => ['integer'],
'action'      => ['required', Rule::in(['assign', 'status'])],
'assigned_to' => ['required_if:action,assign', 'nullable', 'integer', Rule::exists('users', 'id')],
'status'      => ['required_if:action,status', Rule::enum(TicketStatus::class)],
```

**`max:100`** caps the blast radius of one request and matches the largest page size the UI offers (50) with headroom for a cross-page selection.

**File: `app/Http/Resources/TicketResource.php` — replace `toArray()`.** The full shape is pinned in **Shared contracts this story establishes**; the two constraints that make existing tests keep passing are that **`subject` stays a top-level key** and that **`assignee` never carries `email`** (`tests/Feature/TicketScopeTest.php` lines 54–64).

**Create file: `app/Http/Resources/TicketEventResource.php`**

```php
return [
    'id' => $this->id,
    'event' => $this->event,
    'field' => $this->field,
    'old_value' => $this->old_value,
    'new_value' => $this->new_value,
    'actor' => $this->actor ? ['id' => $this->actor->id, 'name' => $this->actor->name] : null,
    'created_at' => $this->created_at,
];
```

**File: `app/Policies/TicketPolicy.php` — extend.** Keep `viewAny()` (line 12) and `view()` (lines 15–18) byte-for-byte; `TicketScopeTest` depends on both. Add:

```php
public function create(User $user): bool
{
    return true;   // every authenticated role may open a ticket
}

public function update(User $user, Ticket $ticket): bool
{
    return $this->view($user, $ticket);   // if you can see it, you can work it
}

/** Reassigning a ticket away from yourself is a supervisory act. */
public function assign(User $user, Ticket $ticket): bool
{
    return $user->canSeeTeamQueue() || $ticket->assigned_to === $user->id;
}
```

`assign()` is what makes the intake's Team Lead criterion true and its Agent criterion safe: an Agent may hand *their own* ticket on, but cannot reach into another agent's row. **This is the method the bulk endpoint calls per row.**

### 7 — `app/Http/Controllers/TicketController.php` — **replace `index()`, add four actions**

Keep the class, the `AuthorizesRequests` trait (line 13), and the `$this->authorize('viewAny', …)` call. Replace the body of `index()`:

```php
public function index(Request $request): AnonymousResourceCollection
{
    $this->authorize('viewAny', Ticket::class);

    $perPage = (int) $request->integer('per_page', 25);
    $perPage = in_array($perPage, [10, 25, 50], true) ? $perPage : 25;

    $filters = [
        'status'      => $request->array('status'),
        'priority'    => $request->array('priority'),
        'channel'     => $request->array('channel'),
        'category'    => $request->array('category'),
        'customer_id' => $request->array('customer_id'),
        'assigned_to' => $request->array('assigned_to'),
        'q'           => $request->string('q')->trim()->value() ?: null,
    ];

    $tickets = Ticket::query()
        ->visibleTo($request->user())          // FIRST — the security boundary
        ->filter($filters)                     // then the user's own facets
        ->with(['assignee:id,name', 'customer:id,name'])
        ->sorted($request->string('sort')->value())
        ->paginate($perPage)
        ->withQueryString();

    return TicketResource::collection($tickets);
}
```

Four load-bearing details:

- **`visibleTo()` is applied before `filter()`, and `filter()` never removes a constraint.** Order is not cosmetic here: it is the difference between a filter narrowing an Agent's own queue and a filter widening it.
- **`with(['assignee:id,name', 'customer:id,name'])`** — column-limited eager loads. Without them the queue issues 2N+1 queries at 25 rows; with the full relation loaded it would ship the assignee's `email`, which `TicketScopeTest` line 62 explicitly forbids. **The column list is a security control, not just a performance one.**
- **`withQueryString()`** keeps the facets on the pagination links, so page 2 of a filtered view is still filtered.
- **`per_page` is an allow-list, not a clamp.** `min(max($n,1),100)` would let a client request 99 and defeat the index tuning; three fixed sizes match the UI.

Add:

```php
public function store(StoreTicketRequest $request): JsonResponse
public function show(Request $request, Ticket $ticket): TicketResource
public function update(UpdateTicketRequest $request, Ticket $ticket): TicketResource
public function bulk(BulkTicketActionRequest $request): JsonResponse
public function events(Request $request, Ticket $ticket): AnonymousResourceCollection
public function meta(Request $request): JsonResponse
```

**`store()`** — the assignment rule the intake names:

```php
$data = $request->validated();
$data['created_by'] = $request->user()->id;
$data['status'] = TicketStatus::Open->value;

// The intake is explicit: a new ticket is NEVER silently assigned to its
// creator. Auto-assignment is Story 06's rule; until it lands, an unnamed
// assignee means Unassigned.
if (! empty($data['assigned_to'])) {
    $target = Ticket::make($data);
    $target->assigned_to = $data['assigned_to'];
    if (! $request->user()->can('assign', $target)) {
        unset($data['assigned_to']);
    }
}

$ticket = Ticket::create($data);   // observer writes the 'created' event

return (new TicketResource($ticket->load(['assignee:id,name', 'customer:id,name'])))
    ->response()->setStatusCode(201);
```

**`update()`** — the transition gate and the timestamp side effects:

```php
$this->authorize('update', $ticket);
$data = $request->validated();

if (array_key_exists('status', $data)) {
    $next = TicketStatus::from($data['status']);
    if (! $ticket->status->canTransitionTo($next)) {
        throw ValidationException::withMessages([
            'status' => "Cannot move a {$ticket->status->label()} ticket to {$next->label()}.",
        ]);
    }
    $wasFinished = in_array($ticket->status, [TicketStatus::Resolved, TicketStatus::Closed], true);

    $data['resolved_at'] = $next === TicketStatus::Resolved ? now() : null;
    $data['closed_at']   = $next === TicketStatus::Closed ? now() : null;
}

if (array_key_exists('assigned_to', $data)) {
    $this->authorize('assign', $ticket);
}

$ticket->update($data);            // observer writes the change events

if (isset($wasFinished, $next) && $wasFinished && $next === TicketStatus::Open) {
    $ticket->recordReopened();     // the one event wasChanged() cannot infer
}
```

- **`resolved_at` is cleared when a ticket leaves `Resolved`.** A stale `resolved_at` on a reopened ticket is what makes Story 06's auto-close rule fire on a live ticket. **This is the sharpest cross-story trap in the schema.**
- **A ticket moved straight to `Closed` from `Open` gets `closed_at` but not `resolved_at`.** That is correct — it was closed, not resolved. Story 12's reports must not assume `resolved_at` is set on every closed ticket.

**`bulk()`** — per-row authorization with a reported skip list, which is the intake's last acceptance criterion:

```php
$applied = [];
$skipped = [];

DB::transaction(function () use ($request, &$applied, &$skipped) {
    $tickets = Ticket::query()
        ->visibleTo($request->user())              // rows outside the actor's scope never load
        ->whereIn('id', $request->validated('ids'))
        ->lockForUpdate()
        ->get();

    foreach ($tickets as $ticket) {
        $ability = $request->validated('action') === 'assign' ? 'assign' : 'update';
        if ($request->user()->cannot($ability, $ticket)) {
            $skipped[] = ['id' => $ticket->id, 'reason' => 'forbidden'];
            continue;
        }
        // …apply, reusing the same transition check as update()
        $applied[] = $ticket->id;
    }
});

return response()->json([
    'applied' => $applied,
    'skipped' => $skipped,
], 200);
```

- **Ids the actor cannot see simply do not load**, so they appear in neither list — the response never confirms that a ticket id exists outside the caller's scope.
- **`200`, never `207` or `422`,** even when every row is skipped. A partially-applied bulk action is a successful request with a detailed result; the SPA renders the skip count. **Do not throw on the first skipped row** — that would apply some rows and report a failure.
- **`lockForUpdate()` inside the transaction** stops two supervisors bulk-assigning the same rows from interleaving.

**`meta()`** — one request that feeds every facet dropdown:

```php
return response()->json([
    'priorities' => Priority::options(),
    'statuses'   => TicketStatus::options(),
    'channels'   => Channel::options(),
    'categories' => array_map(
        fn (string $c) => ['value' => $c, 'label' => Ticket::categoryLabel($c)],
        Ticket::CATEGORIES
    ),
    'agents' => User::query()
        ->where('is_active', true)
        ->whereIn('role', [UserRole::Agent, UserRole::TeamLead])
        ->orderBy('name')
        ->get(['id', 'name'])
        ->map(fn ($u) => ['value' => (string) $u->id, 'label' => $u->name])
        ->all(),
]);
```

**This is deliberately not `GET /api/users`** — Story 08 owns that endpoint and its richer shape. `meta()` returns `id` and `name` only, and nothing else on the user record leaks. When Story 08 lands, `agents` may be re-sourced from its service; **the response key and its `{value,label}` shape must not change**, because the SPA's filter component binds to it.

### 8 — Routes

**File: `routes/api.php` — extend the existing `auth:sanctum` group (lines 14–18).** Keep `GET /api/tickets` on line 17 where it is. Replace it with the block below, in this order — **`/tickets/meta` must be registered before `/tickets/{ticket}`**, or `meta` is swallowed as a model-binding id and returns 404.

```php
Route::get('/tickets', [TicketController::class, 'index']);
Route::get('/tickets/meta', [TicketController::class, 'meta']);
Route::post('/tickets', [TicketController::class, 'store']);
Route::post('/tickets/bulk', [TicketController::class, 'bulk']);
Route::get('/tickets/{ticket}', [TicketController::class, 'show']);
Route::patch('/tickets/{ticket}', [TicketController::class, 'update']);
Route::get('/tickets/{ticket}/events', [TicketController::class, 'events']);
```

**Do not add a new middleware group, a throttle, or a route prefix.** `SecurityHeaders` and CORS already apply globally.

### 9 — Factory, seeder, and the existing test fixture

**Create file: `database/factories/TicketFactory.php`**

```php
public function definition(): array
{
    return [
        'subject' => fake()->sentence(6),
        'description' => fake()->paragraph(),
        'customer_id' => Customer::factory(),        // Story 03 owns this factory
        'status' => fake()->randomElement(TicketStatus::cases()),
        'priority' => fake()->randomElement(Priority::cases()),
        'category' => fake()->randomElement(Ticket::CATEGORIES),
        'channel' => fake()->randomElement(Channel::cases()),
        'assigned_to' => null,
        'created_by' => null,
    ];
}

public function assignedTo(User $user): static { /* state */ }
public function unassigned(): static { /* state */ }
```

**`'assigned_to' => null` by default.** A factory that auto-creates an assignee makes "unassigned" hard to test and quietly inflates the users table in every test.

**File: `database/seeders/DatabaseSeeder.php` — extend, do not replace.** Keep the five `User::create(...)` calls at **lines 20–58** exactly as they are; the login tests and the manual verification steps depend on those five accounts and their `Password123!` password. **Replace the four `Ticket::create(...)` blocks at lines 60–88** with:

- The same four demo tickets, now carrying a `customer_id` (from Story 03's customer seeder), a `category`, a `channel`, and a `created_by`.
- Roughly **60** further tickets via `Ticket::factory()`, spread across the five channels, four priorities and four statuses, assigned across `$agent1`, `$agent2` and left unassigned. Sixty is enough to make server-side pagination visibly real at 25 per page and to exercise the "…" in the pagination footer.
- **Story 03's customer seeding must run before this block.** If Story 03 registered a `CustomerSeeder`, call it via `$this->call(...)` at the top; otherwise create customers inline through `Customer::factory()`.

**File: `api/tests/Feature/TicketScopeTest.php` — modify the fixture only.**

The three `Ticket::create([...])` calls at **lines 32–43** pass only `subject` and `assigned_to`, and will now fail on the NOT NULL `customer_id`. Replace each with:

```php
Ticket::factory()->create([
    'subject' => 'Ticket Agent One 1',
    'assigned_to' => $this->agent1->id,
]);
```

**The two `it(...)` blocks at lines 46 and 67 must not change** — not their names, not a single assertion. If an assertion needs editing, something in the resource shape regressed and the fix belongs in `TicketResource`, not in the test.

---

## Frontend Tasks

Every path is relative to `web/`. Feature folder, per the convention in `web/src/features/auth/`:

```
web/src/features/tickets/
  api/
    ticketsApi.ts          fetch/create/update/bulk + meta, all through lib/api
    queryKeys.ts           ticketKeys — one keying scheme
  model/
    ticket.ts              TS types mirroring TicketResource
    ticketFilters.ts       zod schema for the URL params + defaults
    newTicketSchema.ts     zod schema = the create form's types AND validation
    display.ts             priority/status/channel label + token-class maps
  hooks/
    useTicketFilters.ts    URL search params <-> filter state
    useTicketsQuery.ts     the list query
    useTicketMeta.ts       the facet options query
    useTicketMutations.ts  create / update / bulk
    useRowSelection.ts     selection set, scoped to the current page
  components/
    TicketTable.tsx  TicketRow.tsx  TicketTableHeader.tsx
    PriorityBadge.tsx  StatusBadge.tsx  SlaCell.tsx  ChannelIcon.tsx
    FilterBar.tsx  FilterChip.tsx
    BulkActionBar.tsx  BulkConfirmDialog.tsx
    Pagination.tsx
    TicketQueueSkeleton.tsx  TicketQueueEmpty.tsx  TicketQueueError.tsx
    NewTicketModal.tsx
  pages/
    TicketQueuePage.tsx
  index.ts                 the ONLY public surface: export { TicketQueuePage }
```

**`index.ts` exports `TicketQueuePage` and nothing else.** `App.tsx` imports from `'./features/tickets'`, never from a file inside it.

### 1 — Design tokens

**File: `web/src/index.css` — extend.** Add every token below to **all four** blocks that the existing tokens use (bare `:root` lines 20–47, the `prefers-color-scheme` block lines 49–75, `[data-theme="dark"]` lines 77–100, `[data-theme="light"]` lines 102–125). Omitting one is how an explicit theme choice stops winning in one direction.

Values are read from the exports; the cited line is `WisalTicketQueue-LightLTR.dc.html` / `WisalTicketQueue-DarkLTR.dc.html`.

| Token | Light | Dark | Source |
|---|---|---|---|
| `--prio-urgent-fg` / `--prio-urgent-bg` | `#B91C1C` / `#FEF2F2` | `#F87171` / `rgba(248,113,113,0.14)` | L127 · D125 · `brief.md` 110 |
| `--prio-high-fg` / `--prio-high-bg` | `#B45309` / `#FFFBEB` | `#FBBF24` / `rgba(251,191,36,0.14)` | L132 · D130 · `brief.md` 109 |
| `--prio-normal-fg` / `--prio-normal-bg` | `#2563EB` / `#EFF6FF` | `#60A5FA` / `rgba(96,165,250,0.14)` | L142 · D140 |
| `--prio-low-fg` / `--prio-low-bg` | `#64748B` / `#F1F5F9` | `#94A3B8` / `rgba(148,163,184,0.14)` | L157 · D155 |
| `--status-open-fg` / `--status-open-bg` | `#4F46E5` / `#EEF2FF` | `#A5B4FC` / `rgba(129,140,248,0.14)` | L127 · D125 |
| `--status-pending-fg` / `--status-pending-bg` | `#0E7490` / `#ECFEFF` | `#22D3EE` / `rgba(34,211,238,0.14)` | L132 · D130 |
| `--status-resolved-fg` / `--status-resolved-bg` | `#059669` / `#ECFDF5` | `#34D399` / `rgba(52,211,153,0.14)` | L157 · D155 |
| `--status-closed-fg` / `--status-closed-bg` | `#334155` / `#E2E8F0` | `#CBD5E1` / `rgba(203,213,225,0.14)` | **decided in this plan** — see Product rules |
| `--sla-breached` | `#B91C1C` | `#F87171` | L127 · D125 |
| `--sla-at-risk` | `#B45309` | `#FBBF24` | L132 · D130 |
| `--sla-ok` | `#64748B` | `#94A3B8` | L142 · D140 |
| `--sla-none` | `#94A3B8` | `#64748B` | L157 · D155 |
| `--table-row-border` | `#F1F5F9` | `#2A2C33` | L124 · D122 |
| `--table-row-zebra` | `#F8FAFC` | `#202128` | L139 · D134 |
| `--table-row-selected` | `#EEF2FF` | `rgba(129,140,248,0.12)` | L129 · D127 |
| `--table-head-fg` | `#94A3B8` | `#64748B` | L114 · D112 |
| `--table-sort-icon` | `#CBD5E1` | `#3F4148` | L116 · D114 |
| `--bulk-bar-bg` / `--bulk-bar-border` | `#EEF2FF` / `#C7D2FE` | `rgba(129,140,248,0.12)` / `rgba(129,140,248,0.35)` | L85 · D84 |
| `--danger-fg` | `#B91C1C` | `#F87171` | L90 · D89 |
| `--checkbox-border` | `#CBD5E1` | `#3F4148` | L125 · D123 |
| `--skeleton-base` / `--skeleton-sheen` | `#EEF0F3` / `#F5F6F8` | `#202128` / `#2A2C33` | Loading export line 15; dark values derived from `--table-row-zebra` / `--border-card` |
| `--queue-table-breakpoint` | `900px` | `900px` | **decided in this plan** |

Two rules that a naive pass breaks:

- **`--sla-none` and `--sla-ok` swap between themes** (`#94A3B8` ↔ `#64748B`). That is not a typo — it is what keeps the "no SLA" dash quieter than the "SLA fine" value in each theme. Copy the table exactly.
- **`--queue-table-breakpoint` is 900px, not `--shell-breakpoint` (1024px).** The shell's sidebar collapses at 1024, but a nine-column table survives past that in the widened content area. Two different things needing two different numbers is why this gets its own token rather than reusing the shell's.

### 2 — Types and schemas

**Create file: `model/ticket.ts`** — the TypeScript mirror of the pinned `TicketResource` shape. **Hand-write it against the contract section at the end of this file; do not infer it from a sample response.**

```ts
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketChannel = 'email' | 'whatsapp' | 'chat' | 'sms' | 'web_form';
export type SlaRisk = 'breached' | 'at_risk' | 'ok' | null;

export type TicketSla = {
  due_at: string | null;
  minutes_left: number | null;
  risk: SlaRisk;          // always null until Story 06 — the shape does not change then
};

export type Ticket = {
  id: number;
  reference: string;                                   // "#4821"
  subject: string;
  description: string | null;
  status: TicketStatus;      status_label: string;
  priority: TicketPriority;  priority_label: string;
  category: string;          category_label: string;
  channel: TicketChannel;    channel_label: string;
  customer: { id: number; name: string } | null;
  assignee: { id: number; name: string; initials: string } | null;
  created_by: { id: number; name: string } | null;
  sla: TicketSla;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; from: number | null; to: number | null; total: number };
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
};
```

**`meta` and `links` are Laravel's own `AnonymousResourceCollection` envelope** — the existing `TicketScopeTest` already reads `$response->json()['data']`, confirming the envelope is present. Do not unwrap it in the API layer; the pagination footer needs `from`, `to`, `total`, `last_page`.

**Create file: `model/ticketFilters.ts`** — the zod schema is the single source of both the parsing rule and the type, per the Story 01 convention (`features/auth/loginSchema.ts` lines 3–8):

```ts
export const SORTABLE = ['id', 'customer', 'priority', 'status', 'updated_at'] as const;

export const ticketFiltersSchema = z.object({
  status:   z.array(z.enum(['open', 'pending', 'resolved', 'closed'])).default([]),
  priority: z.array(z.enum(['low', 'normal', 'high', 'urgent'])).default([]),
  channel:  z.array(z.enum(['email', 'whatsapp', 'chat', 'sms', 'web_form'])).default([]),
  category: z.array(z.string()).default([]),
  assigned_to: z.array(z.string()).default([]),   // user ids as strings, plus the literal 'unassigned'
  q: z.string().trim().default(''),
  sort: z.string().default('-created_at'),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(25),
});

export type TicketFilters = z.infer<typeof ticketFiltersSchema>;
```

**`assigned_to` holds strings, not numbers**, so the `'unassigned'` sentinel lives in the same array without a union type at every call site. The API layer sends them verbatim.

**Create file: `model/newTicketSchema.ts`**

```ts
export const newTicketSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(255),
  customer_id: z.number({ message: 'Select a customer' }).int().positive(),
  category: z.string().min(1, 'Select a category'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  channel: z.enum(['email', 'whatsapp', 'chat', 'sms', 'web_form']),
  description: z.string().max(5000).optional(),
});
export type NewTicketValues = z.infer<typeof newTicketSchema>;
```

**This schema validates shape only.** Whether the actor may assign, which statuses are reachable, and whether the customer exists are **server** rules — Story 01's Done Criteria states this and it still holds.

### 3 — API layer and query keys

**Create file: `api/queryKeys.ts`**

```ts
export const ticketKeys = {
  all: ['tickets'] as const,
  list: (filters: TicketFilters) => [...ticketKeys.all, 'list', filters] as const,
  detail: (id: number) => [...ticketKeys.all, 'detail', id] as const,
  events: (id: number) => [...ticketKeys.all, 'events', id] as const,
  meta: () => [...ticketKeys.all, 'meta'] as const,
};
```

**Every mutation invalidates `ticketKeys.all`.** Stories 05, 06 and 07 attach under the same root; a narrower invalidation is what leaves a stale queue behind after a status change made from the detail screen.

**Create file: `api/ticketsApi.ts`** — all calls go through the shared instance from `web/src/lib/api.ts`. **Do not create a second Axios client and do not set an `Authorization` header here** — the interceptor at `lib/api.ts` lines 16–21 already does it.

```ts
export async function fetchTickets(filters: TicketFilters): Promise<Paginated<Ticket>> {
  const { data } = await api.get('/tickets', { params: toQuery(filters) });
  return data;
}
```

`toQuery` turns the filter object into Laravel-friendly params: arrays become repeated `key[]=value` entries, empty arrays and the empty `q` are **omitted entirely**, and `page` is omitted when it is 1. **Omitting defaults is what keeps a freshly-loaded `/tickets` URL clean** — a URL full of `?status[]=&priority[]=&page=1` is not a shareable view, it is noise. Configure the serializer explicitly:

```ts
api.get('/tickets', { params, paramsSerializer: { indexes: null } })
```

Without `indexes: null`, Axios 1.19 emits `status[0]=open`, which Laravel's `$request->array('status')` reads as a keyed map rather than a list.

Also export `fetchTicketMeta()`, `createTicket(values)`, `updateTicket(id, patch)`, `bulkTickets({ ids, action, assigned_to?, status? })`, and `fetchTicketEvents(id)`.

### 4 — Filter state in the URL

**Create file: `hooks/useTicketFilters.ts`** — the hook that makes the intake's shareable-URL criterion true.

```ts
export function useTicketFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ticketFiltersSchema.parse({
      status: searchParams.getAll('status'),
      priority: searchParams.getAll('priority'),
      channel: searchParams.getAll('channel'),
      category: searchParams.getAll('category'),
      assigned_to: searchParams.getAll('assigned_to'),
      q: searchParams.get('q') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      per_page: searchParams.get('per_page') ?? undefined,
    }),
    [searchParams],
  );

  const setFilters = (next: Partial<TicketFilters>, opts?: { keepPage?: boolean }) => { /* … */ };
  const clearFilters = () => { /* … */ };
  const activeCount = /* facets with a non-empty value, excluding sort/page/per_page */;

  return { filters, setFilters, clearFilters, activeCount };
}
```

Five rules, each of which a naive version gets wrong:

- **`searchParams` is the only source of truth.** No `useState` mirror. A mirrored copy is how the back button starts disagreeing with the table.
- **Use `.safeParse` and fall back to defaults on failure.** A hand-edited URL such as `?priority[]=critical` must render the unfiltered queue, **not** crash the route. `.parse` throws and there is no error boundary above this.
- **Any facet change resets `page` to 1** unless `keepPage` is passed. Landing on page 7 of a two-page result is the classic faceted-search bug.
- **`setSearchParams(next, { replace: false })` for facet changes** so each filter state is a real history entry, but **`{ replace: true }` for the debounced `q`** so typing eight characters does not bury the back button under eight entries.
- **Debounce `q` by 300 ms** before it reaches the URL. Debounce the *URL write*, not the query — TanStack Query keys off the URL-derived filters, so debouncing there covers both.

**Create file: `hooks/useTicketsQuery.ts`**

```ts
export function useTicketsQuery(filters: TicketFilters) {
  return useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: () => fetchTickets(filters),
    placeholderData: keepPreviousData,
  });
}
```

**`placeholderData: keepPreviousData` is required, not optional.** Without it, every page change and every filter toggle unmounts the table and shows the skeleton — the "flash of skeleton" that makes server-side pagination feel broken. With it, the table dims via `isPlaceholderData` and the rows stay put. The skeleton then only ever shows on the genuine first load, which is exactly what the Loading export depicts.

### 5 — The table

**Create file: `components/TicketTable.tsx`** — the accessible structure the exports do not have.

- Render a real **`<table>`** with `<thead>`, `<tbody>`, `<th scope="col">`, `<tr>`, `<td>`. The exports use nested `<div style="display:grid">`; a nine-column grid of divs announces as nothing to a screen reader. Keep the export's exact metrics by applying `display: grid; grid-template-columns: …` to the `<tr>` elements with `table { display: block }` — the grid columns come from the design, the semantics come from the elements.
- **Grid template** (see Product rules for why it is nine columns, not eight):
  `grid-template-columns: 32px 28px 70px 1.5fr 1fr 100px 110px 120px 100px;`
- **Column order** — select · channel · ID · SUBJECT (+ updated-at sub-line) · CUSTOMER · PRIORITY · STATUS · ASSIGNEE · SLA LEFT.
- **Header cells.** Sortable columns (`ID`, `CUSTOMER`, `PRIORITY`, `STATUS`) are `<button>`s inside the `<th>` carrying `aria-sort={'ascending' | 'descending' | 'none'}` **on the `<th>`, not the button**. Their double-chevron `M7 9l3-3 3 3 M7 15l3 3 3-3` in `var(--table-sort-icon)` becomes a single chevron in `var(--nav-active-fg)` when that column is the active sort. **`SUBJECT`, `ASSIGNEE` and `SLA LEFT` are not sortable** — the export gives SUBJECT no affordance, and there is nothing to sort SLA on until Story 06.
- **Select-all checkbox** in the first `<th>`, `aria-label="Select all tickets on this page"`, with `indeterminate` set imperatively via a ref when some-but-not-all rows on the page are selected. **`indeterminate` is a DOM property with no React prop** — setting `checked={undefined}` does not produce it.
- **Selection is scoped to the current page** and cleared on any filter or page change (`useRowSelection` watches the filters object). A selection that survives a filter change lets a user bulk-close rows they can no longer see.

**Create file: `components/TicketRow.tsx`**

- The row is a `<tr>` carrying `data-selected` and `data-zebra`; the zebra rule is `tr[data-zebra='true'] { background: var(--table-row-zebra) }` and the selected rule wins over it via source order.
- **The subject cell holds two lines**: the subject at `12.5px/500 var(--text-main)` with `overflow:hidden; text-overflow:ellipsis; white-space:nowrap`, and beneath it the relative last-updated at `11px var(--text-muted)`. **Give the cell `min-inline-size: 0`** or the ellipsis never triggers inside a grid track.
- **Relative time is computed with `Intl.RelativeTimeFormat`**, not a date library. `docs/decisions/ADR-004-authentication.md` and the app-shell overview both record that the PHP `intl` extension is blocked on this machine — that is a **backend** constraint and does not affect the browser's `Intl`. Add the full timestamp as a `title` so the exact value is always reachable.
- **The row is not a link and has no click handler.** There is no `/tickets/{id}` route until Story 05. Do not add one, and do not add `cursor: pointer` to a row that does nothing.
- **`ChannelIcon`** renders the 15px glyph in `var(--table-head-fg)` with `role="img"` and an `aria-label` of the channel label. **Colour is not the only signal** (`brief.md` line 196) — the icon plus its label is what carries the channel. Paths, verbatim from `WisalTicketQueue-LightLTR.dc.html`:

  | Channel | `d` | Export line |
  |---|---|---|
  | `email` | `M3 6h18v12H3z M3 6l9 7 9-7` | 126 |
  | `web_form` | `M6 3h9l3 3v15H6z M9 8h6M9 12h6M9 16h4` | 131 |
  | `chat` | `M4 5h16v10H8l-4 4z` | 136 |
  | `whatsapp` | `M12 3a8 8 0 0 0-7 12l-1 4 4-1a8 8 0 1 0 4-15z M9 9.5c.3 2.8 2.7 5.2 5.5 5.5` | 146 |
  | `sms` | `M6 3h12v14H9l-3 3z M9 8h6M9 11h4` | 161 |

**Create files: `components/PriorityBadge.tsx`, `components/StatusBadge.tsx`** — two separate components with two separate token sets. **`brief.md` line 217 forbids conflating them; a single `<Badge kind="…">` component is how they get conflated six months later.** Both render `font-size:10.5px; font-weight:700; border-radius:6px; padding:3px 7px; width:fit-content` (export line 127) and read `var(--prio-*)` / `var(--status-*)`. Both render the **uppercase label as text** — colour alone never carries the value.

**Create file: `components/SlaCell.tsx`**

```tsx
// Story 06 (SLA Rules) computes sla.minutes_left and sla.risk. Until then the
// API returns nulls and this cell renders the design's own "no SLA" dash
// (WisalTicketQueue-LightLTR.dc.html line 157). Do not derive a countdown
// from created_at — a number that means nothing is worse than no number.
```

Render `—` in `var(--sla-none)` with `aria-label="SLA not configured"` while `risk` is `null`. Write the `risk === 'breached' | 'at_risk' | 'ok'` branches now, mapping to `--sla-breached` / `--sla-at-risk` / `--sla-ok`, so Story 06 changes only the API. **Each branch renders text, not just colour.**

### 6 — Page, states, filters

**Create file: `pages/TicketQueuePage.tsx`** — the composition root. It renders, in the export's order (lines 76–188):

1. **The title block.** `<h1>Tickets</h1>` at `22px/700`, then a `13px var(--text-muted)` subtitle. The export's subtitle reads "132 tickets · 5 approaching SLA breach"; ship **"{total} tickets"** only. **Do not print an SLA-breach count** — nothing computes one until Story 06, and a hardcoded number is a lie in the product's most-viewed screen.
2. **`BulkActionBar`**, rendered only when the selection is non-empty, above the filter row (export lines 84–93).
3. **`FilterBar`** (export lines 96–111).
4. **The table shell**, which contains — exclusively — one of four things.
5. **`Pagination`** inside the shell's footer (export lines 175–186), rendered whenever `meta.last_page > 1`.

**The four states are mutually exclusive and the page must make that structural**, per `brief.md` lines 181–187:

| State | Condition | Renders |
|---|---|---|
| Loading | `isPending` (first load only — `keepPreviousData` keeps this false on refetch) | `TicketQueueSkeleton` |
| Error | `isError` | `TicketQueueError` |
| Empty | `data.meta.total === 0` | `TicketQueueEmpty` |
| Success | otherwise | `TicketTable` + `Pagination` |

**Create file: `components/TicketQueueSkeleton.tsx`** — from `WisalTicketQueue-LoadingState.dc.html` lines 79–105, with the grid correction from the Product-rules table. Five rows. Wrap the shimmer:

```css
@media (prefers-reduced-motion: reduce) { .tq-sk { animation: none; } }
```

Give the container `role="status" aria-busy="true"` and one visually-hidden "Loading tickets" — the shimmer alone announces nothing.

**Create file: `components/TicketQueueEmpty.tsx`** — from `WisalTicketQueue-EmptyState.dc.html` lines 72–76. **Two distinct empty cases, not one:**

- **Filtered empty** (`activeCount > 0`): heading "No tickets match your filters", body naming the active facets, and the **"Clear filters"** button calling `clearFilters()`. This is the intake's named criterion.
- **Genuinely empty** (`activeCount === 0`): heading "No tickets yet", body "Tickets you or your team create will appear here.", and a **"New ticket"** button opening the modal. Shipping the "Clear filters" copy to a user with no filters set is the version of this state that reads as broken.

**Create file: `components/TicketQueueError.tsx`** — `brief.md` line 185 requires "actionable, retryable, no raw stack trace". Render a short message, a **Retry** button calling `refetch()`, and **never** `error.message` from Axios, which leaks the API URL. Branch on the status: `403` renders "You do not have access to this queue"; everything else renders "We could not load the ticket queue."

**Create file: `components/FilterBar.tsx` + `components/FilterChip.tsx`** — from export lines 96–111 and the Empty export's active-chip variant (lines 67–70).

- Five chips: **Priority**, **Status**, **Channel**, **Agent**, **Category**. Each is a `<button aria-haspopup="listbox" aria-expanded>` opening a multi-select popover of checkboxes fed by `useTicketMeta()`.
- **Inactive chip**: `color: var(--text-muted)`, chevron `M5 8l7 7 7-7`, label "Priority: All".
- **Active chip**: `background: var(--nav-active-bg); border-color:#C7D2FE; color: var(--nav-active-fg)`, label "Priority: High" or "Priority: 2 selected", and a second `<button>` with `M18 6L6 18M6 6l12 12` that clears **that facet only**, `aria-label="Clear priority filter"`.
- A **search input** for `q`, and a **"Clear all"** text button shown only when `activeCount > 0`.
- **The popover closes on Escape and on outside click, and returns focus to its chip.** Do not use `<dialog>` — it opens a top layer whose default backdrop fights the token palette, exactly as recorded in the app-shell plan's drawer decision.

### 7 — Pagination

**Create file: `components/Pagination.tsx`** — export lines 175–186.

- Left: "Showing {from}–{to} of {total}" at `12px var(--text-muted)`, straight from `meta`. **Do not compute it in the browser** — a client-computed range disagrees with the server the moment a row is created between requests.
- Right: prev, a windowed page list with an ellipsis, next. 28×28, `border-radius:6px`; current page solid `var(--nav-active-fg)` with `--btn-text`, `aria-current="page"`, and **not** a disabled button — a disabled current page is unreachable by keyboard.
- Wrap in `<nav aria-label="Ticket queue pagination">`. Prev/next carry `aria-label="Previous page"` / `"Next page"` and are `disabled` at the ends.
- **RTL: swap the two chevron paths** — `M15 6l-6 6 6 6` and `M9 6l6 6-6 6` — when `document.documentElement.dir === 'rtl'`, reading direction from `useUiPreferences()` rather than the DOM. `brief.md` line 202 requires it and the RTL export omits it (line 176). **Do not use `transform: scaleX(-1)`**, which mirrors the focus ring too.

### 8 — Create, bulk actions, and the header button

**Create file: `components/NewTicketModal.tsx`** — from `WisalModals-LightLTR.dc.html` lines 45–101, plus the Category field from the Product-rules table.

- `react-hook-form` + `zodResolver(newTicketSchema)`, matching `features/auth/LoginPage.tsx`'s form setup. **The zod schema is the single source of both the TS type and the validation.**
- Field order: **Subject · Customer · Category · Priority · Channel · Description · Attachments(inert)**.
- **Customer** is a search-as-you-type combobox over Story 03's `GET /api/customers?q=`, rendering the export's result rows (avatar initials + name + company, lines 57–66). It is `role="combobox"` with `aria-expanded`, `aria-controls`, `aria-activedescendant`, and arrow-key navigation. **It submits `customer_id`, never a name string.**
- **Priority** is a four-button segmented control (export lines 71–77) implemented as `role="radiogroup"` with four `role="radio"` buttons and roving `tabIndex` — **not** four independent buttons, which give a keyboard user four stops for one value. Selected state uses the `--prio-*` token pair plus `border-width: 2px` and `font-weight: 700`.
- Modal mechanics: focus moves to the first field on open, is trapped while open, and returns to the invoker on close; Escape closes; the backdrop is `rgba(15,23,42,0.45)` with `aria-hidden="true"`; the panel is `role="dialog" aria-modal="true"` labelled by its `<h2>`.
- **Open state lives in the URL** (`?new=1`), read via `useSearchParams`. Closing removes the parameter with `{ replace: true }`.
- On success: `queryClient.invalidateQueries({ queryKey: ticketKeys.all })`, close, and move focus to the new row's subject cell if it is on the current page.
- **422 handling:** map Laravel's `errors` object onto the form via `setError(field, …)`, and surface anything unmapped in a form-level alert. **Never** swallow a 422 into a generic "something went wrong".

**Create file: `components/BulkActionBar.tsx`** — export lines 84–93. `role="region" aria-label="Bulk actions"` with `aria-live="polite"` on the count so "3 selected" is announced as it changes. Three controls — **Assign** (agent picker from `useTicketMeta`), **Change Status** (menu of statuses), **Close** (`var(--danger-fg)`) — plus a dismiss `×` that clears the selection.

**Create file: `components/BulkConfirmDialog.tsx`** — from `WisalModals-LightLTR.dc.html` lines 138–151. `brief.md` line 186 requires the confirmation to **name the specific records**:

- "Close 3 tickets?" / "Assign 3 tickets to Sarah Ahmed?"
- Body listing the affected references (`#4821, #4819, #4815`), truncated with "and N more" past five.
- Destructive confirm uses `--danger-fg`; the assign confirm uses the primary button.

After the request resolves, **render the skip report**: if `skipped.length > 0`, show "Applied to N tickets. M skipped — you do not have permission to change them." **Do not silently report success** when rows were skipped; that is the failure mode the intake's last criterion is written against.

**File: `web/src/app/layouts/AppLayout.tsx` — extend.** Replace **lines 151–157** (the `disabled` **New Ticket** button) with a `react-router` `<Link className="shell-new-ticket-btn" to="/tickets?new=1">` carrying the same `M12 5v14 M5 12h14` icon and the same label. Remove `disabled` and `title="Coming soon"`. **File: `web/src/index.css` — extend** `.shell-new-ticket-btn` with `text-decoration: none` and a `:focus-visible` outline; keep `:disabled` in place, since nothing else uses the class.

**File: `web/src/App.tsx` — extend.** Change **line 201** from `<PagePlaceholder title="Tickets" />` to `<TicketQueuePage />`, importing from `'./features/tickets'`. **Change nothing else** — not the provider nesting (lines 170–173), not the `*` catch-all (line 224), not the `import.meta.env.DEV` devtools guard (line 227).

### 9 — Responsive and RTL

**File: `web/src/index.css` — extend.**

```css
@media (max-width: 899px) {
  /* The nine-column grid becomes a stack of cards. Priority, status and
     SLA-risk stay visible per card — intake criterion, brief.md line 143. */
  .tq-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .tq-row { grid-template-columns: 32px 1fr auto; grid-template-areas: …; row-gap: 6px; }
}
```

- **`thead` is visually hidden, not `display: none`.** `display: none` removes it from the accessibility tree and the column names with it.
- **Priority, status and SLA-risk move into a chip row inside the card, never behind a disclosure.** The intake names this explicitly.
- **`.shell-main` already provides the outer padding** (`index.css` lines 415–421). The queue page adds none.
- The table's own horizontal overflow lives in a wrapper with `overflow-x: auto`, so a wide table scrolls **inside its container** and the page body never scrolls sideways.

**RTL** is carried by logical properties throughout — `padding-inline`, `margin-inline-start`, `inset-inline-end`, `border-inline-end`. A CSS `grid-template-columns` **mirrors automatically** under `dir="rtl"`, so the column order requirement needs no second stylesheet. Three explicit exceptions:

- **The ticket reference gets `direction: ltr`** (`WisalTicketQueue-LightRTL.dc.html` lines 125–170) or `#4821` renders as `4821#`.
- **The pagination chevrons swap paths** (Frontend Task 7).
- **Bare numerals inside sentences** — "Showing 1–10 of 132", "3 selected" — are wrapped in `<span dir="ltr" style="display:inline-block">`, matching the RTL export's own treatment (lines 80, 85, 174).

---

## Edge Cases & Failure Modes

- **Editing the frozen scaffold migration.** Trigger: an executor "tidying up" by adding columns to `2026_08_25_200001_create_tickets_table.php`. Expected: never happens — every new column lands in `2026_08_26_100000_expand_tickets_table.php`. That file's own line 9 says so, and every environment that has already migrated would silently diverge.
- **Migration order against `customers`.** Trigger: this story's expand migration sorting *before* Story 03's `create_customers_table`. Expected: `constrained('customers')` fails with "relation customers does not exist" (pgsql) / "no such table" (SQLite). Enforced by the filename timestamp — **check `api/database/migrations/` before choosing it**.
- **`NOT NULL` on a populated table.** Trigger: running migration B against a database still holding the four `DatabaseSeeder` demo tickets from Story 01, which have no customer. Expected: the `DB::table('tickets')->whereNull('customer_id')->delete()` on the first line of `up()` clears them first. In tests this is a no-op — `RefreshDatabase` migrates an empty schema.
- **Half-applied migration state.** Trigger: migration A succeeds, B fails. Expected: `customer_id` exists and is nullable, the app still runs, and `StoreTicketRequest`'s `required` rule still prevents new ticket without a customer. Recovery is `php artisan migrate:rollback --step=1` then fixing B. See **Migration / Rollback**.
- **`->change()` losing indexes on SQLite.** Trigger: mixing an index edit and a `->change()` in one `Schema::table` closure. Expected: migration B contains **only** the `->change()`; every index is declared in migration A.
- **Sorting by priority alphabetically.** Trigger: `orderBy('priority')` on the string column, giving high → low → normal → urgent. Expected: `Priority::sortExpression()` is used instead (`app/Enums/Priority.php`). Asserted by Test Plan item 5.
- **The `orWhereNull` escaping its group.** Trigger: writing the `assigned_to`/`unassigned` filter without the wrapping `where(function …)` in `Ticket::scopeFilter()`. Expected: the group is wrapped. **Consequence if missed: an Agent filtering by "Unassigned" sees every unassigned ticket in the company** — a real data leak, not a display bug. Asserted by Test Plan item 4.
- **Filters widening an Agent's scope.** Trigger: `?assigned_to[]=<other agent id>` typed by an Agent. Expected: `visibleTo()` is applied before `filter()`, so the result is empty, not the other agent's queue. Asserted by Test Plan item 3.
- **Assignee email leaking through the queue.** Trigger: `->with('assignee')` without the column list, or a `TicketResource` that spreads the relation. Expected: `with(['assignee:id,name'])` and an explicit two-key `assignee` object. `tests/Feature/TicketScopeTest.php` **lines 60–64** already guards this; **do not weaken it**.
- **`getOriginal()` on a cast enum.** Trigger: `(string) $ticket->getOriginal('status')` inside the `booted()` observer. Expected: it returns a `TicketStatus`, and casting a `BackedEnum` to string throws. Unwrap with `->value` first — see Backend Task 5. **The most likely runtime error in the backend half of this story.**
- **Stale `resolved_at` on a reopened ticket.** Trigger: moving `resolved → open` without clearing `resolved_at`. Expected: `update()` sets `resolved_at = null` on any transition away from `Resolved`. **Consequence if missed: Story 06's auto-close-after-5-days rule fires on live tickets.** Asserted by Test Plan item 8.
- **A no-op status change.** Trigger: `PATCH {status: 'open'}` on an already-open ticket. Expected: **422**, because `allowedTransitions()` never contains `$this`. A silent 200 would append a history row recording no change.
- **`closed` without `resolved`.** Trigger: `open → closed` directly. Expected: `closed_at` set, `resolved_at` left `null`. Story 12's reports must not assume otherwise; this is stated in the shared-contracts section.
- **`/tickets/meta` shadowed by model binding.** Trigger: registering `GET /tickets/{ticket}` before `GET /tickets/meta`. Expected: `meta` comes first in `routes/api.php`. Symptom if missed: a 404 with the message "No query results for model [Ticket] meta".
- **Bulk action partially applied then aborted.** Trigger: throwing on the first row the actor cannot touch. Expected: the loop `continue`s, collects the id into `skipped`, and the endpoint returns **200** with both lists. The UI reports the skip count.
- **Concurrent bulk assignment.** Trigger: two supervisors bulk-assigning overlapping rows. Expected: `DB::transaction` + `lockForUpdate()` serialises them; the second sees the first's result.
- **A bulk selection spanning a filter change.** Trigger: select 3 rows, change the Priority filter, click Close. Expected: `useRowSelection` clears on any filter or page change, so the bar disappears with the selection. Without this a user closes tickets they can no longer see.
- **`indeterminate` never appearing on select-all.** Trigger: expecting a React prop. Expected: set via a ref in an effect — it is a DOM property with no attribute.
- **A malformed URL crashing the route.** Trigger: `?priority[]=critical` or `?page=abc`. Expected: `ticketFiltersSchema.safeParse` falls back to defaults and the unfiltered queue renders. **`.parse` would throw with no error boundary above `TicketQueuePage`.**
- **Axios array serialisation.** Trigger: default Axios 1.19 params, which emit `status[0]=open`. Expected: `paramsSerializer: { indexes: null }`, giving `status[]=open`, which `$request->array('status')` reads as a list.
- **Skeleton flashing on every page change.** Trigger: omitting `placeholderData: keepPreviousData`. Expected: the skeleton appears only on first load; paging dims the existing rows.
- **Landing on an out-of-range page.** Trigger: a bookmarked `?page=7` after the queue shrank. Expected: Laravel returns an empty `data` with `meta.total` intact, so the **filtered-empty** state renders with its "Clear filters" action rather than a blank table.
- **Two empty states conflated.** Trigger: one component for both cases. Expected: `activeCount` picks the copy. "Clear filters" shown to a user with no filters reads as a bug.
- **The subject ellipsis never triggering.** Trigger: a grid track without `min-inline-size: 0`. Expected: the subject cell sets it. A grid item defaults to `min-width: auto` and refuses to shrink below its content.
- **`#4821` rendering as `4821#` under RTL.** Trigger: omitting `direction: ltr` on the reference. Expected: the token is applied — the RTL export does it on every row (lines 125–170).
- **Pagination chevrons pointing the wrong way under RTL.** Trigger: copying the RTL export verbatim, which does not mirror them (line 176). Expected: the paths swap. **The export is the defect here; `brief.md` line 202 is binding.**
- **Priority and status becoming one component.** Trigger: a shared `<Badge>` with a `kind` prop. Expected: two components, two token sets. `brief.md` line 217 forbids conflating them.
- **CLOSED reading as LOW.** Trigger: reusing `--prio-low-*` for the closed status. Expected: the darker slate decided in the Product-rules table. Two near-identical greys in adjacent columns is the same conflation the brief forbids, in a quieter form.
- **`prefers-reduced-motion` ignored.** Trigger: the skeleton shimmer and the modal transition. Expected: both guarded. `brief.md` line 195 is binding.
- **`outline: none` anywhere.** Trigger: styling a custom checkbox or a chip. Expected: every focusable element in this story has a visible `:focus-visible` ring. `brief.md` line 193 forbids the alternative outright.
- **Uncertainty, recorded rather than guessed — the category list.** `docs/design/` depicts no category selector anywhere, and no requirements file enumerates categories. The five values in `Ticket::CATEGORIES` (`general`, `billing`, `technical`, `account`, `feature_request`) are **chosen in this plan** from the subjects the queue export itself shows (billing discrepancy, API errors, password reset, GDPR export, feature request). If the client later supplies a real list, changing it is one constant and one seeder line — which is exactly why `category` is a string column and not an enum.
- **Uncertainty, recorded rather than guessed — the SLA column's width.** The export gives SLA LEFT 100px for values like "1h 20m". Story 06 may need more. The token and the column exist; the track width is the one thing Story 06 may adjust without this being a regression.

---

## Migration / Rollback

Three migrations land in this story, in this order:

| # | File | Reversible? |
|---|---|---|
| A | `2026_08_26_100000_expand_tickets_table.php` | Yes — `down()` drops the FKs, indexes and columns it added. |
| B | `2026_08_26_100100_require_tickets_customer_id.php` | **Partially.** `down()` restores nullability, but the rows the `up()` deleted are gone. |
| C | `2026_08_26_100200_create_ticket_events_table.php` | Yes — `dropIfExists`. |

- **Rollback command:** `php artisan migrate:rollback --step=3` from `api/`, run from PowerShell via the Herd PHP binary.
- **What migration B destroys, and why it is safe:** only tickets with a `NULL` `customer_id`, which can only be the four demo rows the Story 01 seeder created before the column existed. Production has no such rows because production does not exist yet. **If this story is ever re-run against a database holding real customer-less tickets, stop and backfill instead of deleting.**
- **Half-applied state (A applied, B failed):** the app runs. `customer_id` is nullable at the database level but `required` in `StoreTicketRequest`, so no new customer-less ticket can be created through the API. The queue's Customer column renders blank for any legacy row. Fix B and re-run — do not "fix" it by relaxing the FormRequest.
- **Half-applied state (A and B applied, C failed):** ticket writes **throw**, because `Ticket::booted()` inserts into a `ticket_events` table that does not exist. This is loud, immediate, and correct. Re-run `php artisan migrate`.
- **The clean local reset is `php artisan migrate:fresh --seed`.** With Story 03 landed, that produces customers, five users, four demo tickets and ~60 factory tickets in one command.
- **PostgreSQL vs SQLite.** `.env` points at Supabase (pgsql); `phpunit.xml` line 26 forces sqlite. **Every statement in these three migrations is portable Schema-builder API — there is no raw SQL.** The one place raw SQL appears in this story is `Priority::sortExpression()`, whose `CASE … WHEN` is standard SQL supported by both. If a driver-specific statement ever becomes necessary, guard it exactly as `2026_08_25_200000_create_audit_logs_table.php` lines 24–26 does.

---

## Test Plan

### Backend — Pest, in `api/tests/Feature/`

`api/tests/Pest.php` line 4 binds **only `Feature/`** to the Laravel `TestCase`. Anything needing `RefreshDatabase` goes there. Match the style of `tests/Feature/TicketScopeTest.php`: `uses(RefreshDatabase::class)`, a `beforeEach` building users via `User::factory()`, and Sanctum tokens via `createToken('spa')->plainTextToken` with `withHeader('Authorization', "Bearer {$token}")`.

1. **`tests/Feature/TicketScopeTest.php` — regression, fixture-only change.** The two existing `it(...)` blocks (lines 46, 67) keep their names and every assertion. Only the three `Ticket::create(...)` calls at lines 32–43 become `Ticket::factory()->create(...)`. **If an assertion needs editing, `TicketResource` regressed.**
2. **`tests/Feature/TicketQueueFilterTest.php`** (integration):
   - `it filters by status, priority, channel and category` — one seeded set, four single-facet requests, asserting counts.
   - `it combines facets with AND across dimensions and OR within one` — `?priority[]=high&priority[]=urgent&status[]=open` returns high-or-urgent **and** open.
   - `it searches subjects case-insensitively`.
   - `it returns an empty data array, not a 404, when nothing matches`.
3. **`tests/Feature/TicketQueueScopeTest.php`** (integration — **the security tests**):
   - `it does not let an agent widen their scope with an assigned_to filter` — Agent One requests `?assigned_to[]={agentTwoId}` and receives **zero** rows.
   - `it does not let an agent see other unassigned tickets` — with unassigned tickets present, Agent One requests `?assigned_to[]=unassigned` and receives **zero** rows. **This is the `orWhereNull`-escaping regression; it fails loudly if the closure wrapping is dropped.**
   - `it lets a team lead filter by any agent`.
4. **`tests/Feature/TicketSortingTest.php`** (integration):
   - `it sorts by priority using urgency order, not alphabetically` — seed one of each priority, request `?sort=-priority`, assert the id order is urgent, high, normal, low. **A plain `orderBy` produces high, low, normal, urgent and fails this.**
   - `it defaults to newest first` — the pre-existing `->latest()` behaviour.
   - `it ignores an unknown sort key and falls back to the default`.
5. **`tests/Feature/TicketPaginationTest.php`** (integration):
   - `it paginates server-side at 25 per page by default` — seed 60, assert `meta.total` is 60, `data` has 25, `meta.last_page` is 3.
   - `it accepts only 10, 25 and 50 as a page size` — `?per_page=1000` returns 25.
   - `it keeps filters on page two` — `?status[]=open&page=2` stays filtered.
6. **`tests/Feature/TicketCreateTest.php`** (integration):
   - `it requires a customer, a category and a priority` — a bare `POST` returns **422** naming all three.
   - `it never assigns a new ticket to its creator` — an Agent posts a valid ticket with no `assigned_to`; assert `assigned_to` is `null` and `created_by` is the Agent. **The intake's named criterion.**
   - `it ignores an assigned_to the actor may not assign` — an Agent posts `assigned_to: {otherAgent}`; assert the created ticket is unassigned and the response is **201**, not 403.
   - `it opens every new ticket in the open status` — even when the payload tries to send `status: closed`.
   - `it writes a created event to ticket history`.
7. **`tests/Feature/TicketTransitionTest.php`** (integration):
   - `it rejects an illegal transition` — `pending → pending` returns **422**.
   - `it allows open to pending to resolved`.
   - `it records who changed the status and when` — assert a `ticket_events` row with `event=status_changed`, `old_value=open`, `new_value=pending`, and `user_id` equal to the actor. **The intake's history criterion.**
   - `it records an assignment change with the old and new assignee ids`.
8. **`tests/Feature/TicketTimestampTest.php`** (integration):
   - `it stamps resolved_at when a ticket is resolved`.
   - `it clears resolved_at when a resolved ticket is reopened`. **Guards Story 06's auto-close rule.**
   - `it stamps closed_at without resolved_at when a ticket is closed directly from open`.
9. **`tests/Feature/TicketBulkActionTest.php`** (integration):
   - `it applies a bulk assign to every ticket the actor may assign`.
   - `it skips rows the actor lacks permission for and reports them` — a Team Lead's list containing a row outside scope returns **200** with a populated `skipped` array and the rest applied. **The intake's last criterion.**
   - `it returns 200 with an empty applied list when every row is skipped`.
   - `it rejects more than 100 ids with a 422`.
   - `it writes one history row per applied ticket`.
10. **`tests/Feature/TicketMetaTest.php`** (integration):
    - `it returns every priority, status, channel and category option`.
    - `it lists only active agents and team leads` — assert the deactivated seeded user is absent and that **no email appears anywhere in the payload**.
11. **`tests/Feature/ApiContractTest.php` — regression, unchanged.** Its three tests (security headers, JSON 401, `Retry-After` exposure) must still pass. This story adds no middleware.

### Frontend — Vitest + Testing Library, in `web/src/features/tickets/`

**No `test` script exists — run `npx vitest run`.** Copy the harness from `web/src/app/navigation/navRoutes.test.tsx` lines 13–60: `vi.mock('../../lib/api')` spreading `importActual`, a typed user factory, and a `SignedIn` wrapper driving a real `login()`. Colocate each test beside its subject.

12. **`model/ticketFilters.test.ts`** (unit — no DOM):
    - `it defaults every facet to empty and the page to 1`.
    - `it falls back to defaults on a malformed URL` — `priority: ['critical'], page: 'abc'` must parse to the defaults, **not throw**.
    - `it keeps the unassigned sentinel in the assigned_to array`.
13. **`hooks/useTicketFilters.test.tsx`** (unit, inside `MemoryRouter`):
    - `it reads the initial filters from the URL`.
    - `it writes a facet change back to the URL` — assert the resulting search string.
    - `it resets the page to 1 when a facet changes`.
    - `it survives a remount with the same URL` — the shareable/bookmarkable criterion.
    - `it clears every facet but keeps per_page on clearFilters`.
14. **`components/TicketTable.test.tsx`** (unit):
    - `it renders one row per ticket with the reference, subject, customer, priority, status and assignee`.
    - `it renders the priority and status as separate labelled badges` — assert **both** texts are present, so colour is never the only signal.
    - `it renders a dash and an SLA-not-configured label while risk is null`.
    - `it marks the active sort column with aria-sort` — assert exactly **one** `<th>` carries a non-`none` value.
    - `it sets the select-all checkbox to indeterminate for a partial selection`.
    - `it clears the selection when the filters change`.
15. **`components/TicketQueueEmpty.test.tsx`** (unit):
    - `it offers Clear filters when filters are active` — assert the heading is "No tickets match your filters".
    - `it offers New ticket when no filters are active` — assert "Clear filters" is **absent**.
16. **`components/Pagination.test.tsx`** (unit):
    - `it renders the server-provided range and total` — assert it does not recompute from `data.length`.
    - `it marks the current page with aria-current and leaves it enabled`.
    - `it disables previous on page one and next on the last page`.
    - `it swaps the chevron paths under rtl`.
17. **`pages/TicketQueuePage.test.tsx`** (integration, with `api.get` mocked):
    - `it shows the skeleton on first load and not on a refetch`.
    - `it shows a retryable error without leaking the api url` — assert the rendered text contains no `http`.
    - `it shows the empty state when the server returns zero rows`.
    - `it opens the create modal when the url carries new=1`.
18. **`components/NewTicketModal.test.tsx`** (unit):
    - `it blocks submit until a customer, a category and a priority are chosen`.
    - `it maps a 422 field error onto its input`.
    - `it traps focus and returns it to the invoker on Escape`.
19. **`components/BulkConfirmDialog.test.tsx`** (unit):
    - `it names the count and the action in the confirmation`.
    - `it reports the skipped count after a partial success` — the intake's criterion, at the UI layer.
20. **Regressions — must pass untouched:** `web/src/app/navigation/navItems.test.ts`, `navRoutes.test.tsx`, `app/layouts/AppLayout.test.tsx`, `AppLayout.drawer.test.tsx`, `app/providers/UiPreferencesContext.test.tsx`, `features/auth/LoginPage.test.tsx` (**12 tests**), `features/auth/AuthContext.test.tsx`. **`navRoutes.test.tsx` renders every `navItems` path against `PagePlaceholder`, so it is unaffected by `App.tsx`'s route change** — it builds its own route tree (lines 56–58). If it fails, `navItems.tsx` was edited, which this story does not do.
21. **Manual only (Verification Step 7):** dark-mode rendering, RTL mirroring, the 375px card layout, and reduced motion. jsdom resolves neither computed CSS nor real `dir` layout. **Do not fake these with a snapshot test that asserts nothing real.**

---

## Verification Steps

1. **Backend migrates cleanly:** in `api/`, `& "C:\Users\ibrah\.config\herd\bin\php84\php.exe" artisan migrate:fresh --seed`. It completes with no error, creates `ticket_events`, and seeds five users, Story 03's customers, and ~64 tickets.
2. **Backend rollback works:** `php artisan migrate:rollback --step=3` completes, then `php artisan migrate` re-applies. A failure here means a `down()` is wrong.
3. **Backend tests pass:** in `api/`, `php artisan test`. Every new test above is green **and every pre-existing test still passes** — the 3 in `ApiContractTest.php`, the 2 in `TicketScopeTest.php` (with only its fixture changed), the 7 in `Auth/LoginTest.php`, 1 in `Auth/LogoutTest.php`, 2 in `Auth/PasswordPolicyTest.php`. **Zero failures.**
4. **Frontend tests pass:** in `web/`, `npx vitest run`. Every new test is green and all 35 pre-existing `it(...)` declarations plus `navRoutes.test.tsx`'s `it.each` block still pass.
5. **Types and lint clean:** in `web/`, `npm run build` (`tsc -b && vite build`) completes with no errors, and `npm run lint` (oxlint) reports none.
6. **Devtools still excluded:** confirm `ReactQueryDevtools` appears nowhere in `web/dist/assets/*.js` after the build — Story 01's Done Criteria, and Task 8's edit to `App.tsx` is exactly the kind of change that loses the `import.meta.env.DEV` guard on line 227.
7. **App runs end to end:** `php artisan serve` in `api/`, `npm run dev` in `web/`.
   - **Agent scoping:** sign in as `agent@wisal.test` / `Password123!`, open **Tickets**. The queue shows only Sarah Ahmed's tickets. Open devtools → Network → the `/api/tickets` response — confirm the row count matches what is rendered, i.e. **the server did the filtering**. Sign in as `lead@wisal.test`; the queue is larger.
   - **Filters in the URL:** apply Priority = High and Status = Open. The address bar reads `?priority[]=high&status[]=open`. **Copy the URL, open it in a new tab, and confirm the same filtered view loads.** Reload — it survives. Press Back — the previous filter state returns.
   - **Server-side pagination:** page to 2 and 3. Each is a new `/api/tickets` request with `page=2`/`page=3`; the footer range updates from the server's `meta`. Confirm the rows **do not flash a skeleton** while paging.
   - **Empty state:** apply a filter combination matching nothing. The panel shows "No tickets match your filters" and a **Clear filters** button that restores the full queue.
   - **Loading state:** throttle to Slow 3G and hard-reload `/tickets` — the five-row skeleton appears with the same column widths as the real table, then swaps with **no layout jump**.
   - **Error state:** stop `php artisan serve` and reload. An actionable, retryable message appears with **no stack trace and no API URL**.
   - **Create:** click the header's **New Ticket**. The URL gains `?new=1`. Submitting with no customer blocks with a field error. Complete it and submit — the new ticket appears in the queue **Unassigned**, and its history shows a `created` event.
   - **History:** change a ticket's status via the UI, then `GET /api/tickets/{id}/events` — a `status_changed` row names the actor, the old value and the new value.
   - **Bulk:** as `lead@wisal.test`, select 3 rows. The bar reads "3 selected". Choose **Close** — the confirmation names **3** and lists the references. Confirm; the rows update and the selection clears.
8. **Regression on theme, direction, responsiveness, and keyboard:**
   - **Theme:** toggle to dark. Priority, status and SLA colours switch to the dark token set; the table shell is `#1C1D24`, the zebra `#202128`, the selected row the translucent indigo. Confirm a **CLOSED** badge is visibly distinct from a **LOW** priority badge in the same row, in **both** themes.
   - **RTL:** set `dir="rtl"` on `<html>`. The column order fully mirrors; the reference still reads `#4821`; the pagination chevrons point the correct way; the priority and status colours are unchanged.
   - **Responsive:** narrow to **375px**. The table becomes stacked cards; **priority, status and SLA-risk stay visible on every card**; there is **no horizontal scrollbar on the page body** at any width from 375px up.
   - **Keyboard:** Tab from the top. Every filter chip, the select-all checkbox, every row checkbox, every sortable header, every bulk button, every pagination button, and every modal control is reachable in order with a **visible focus ring**. The create modal traps focus and returns it on Escape. The filter popovers close on Escape and return focus to their chip.
   - **Reduced motion:** enable it at the OS level — the skeleton does not shimmer and the modal does not animate.

---

## Shared contracts this story establishes

**Stories 05, 06, 07, 08, 11, 12, 13 and 14 cite this section verbatim. Nothing below may be redefined in a later plan.**

### Enums — `api/app/Enums/`

| Enum | Cases (value) | Labels |
|---|---|---|
| `Priority` | `low`, `normal`, `high`, `urgent` | Low · Normal · High · Urgent |
| `TicketStatus` | `open`, `pending`, `resolved`, `closed` | Open · Pending · Resolved · Closed |
| `Channel` | `email`, `whatsapp`, `chat`, `sms`, `web_form` | Email · WhatsApp · Live chat · SMS · Web form |

- `Priority::weight()` and `Priority::sortExpression()` are the **only** correct way to order by urgency.
- `TicketStatus::allowedTransitions()` / `canTransitionTo()` is the **only** transition authority: `open → {pending, resolved, closed}`, `pending → {open, resolved, closed}`, `resolved → {open, closed}`, `closed → {open}`. A transition to the same status is **not** allowed.
- All three expose `options(): array<{value, label}>` — the shape `GET /api/tickets/meta` returns and the SPA's facet components bind to.
- **`category` is deliberately not an enum**: a `string(32)` column validated against `Ticket::CATEGORIES` = `['general', 'billing', 'technical', 'account', 'feature_request']`, with `Ticket::categoryLabel()` for display.

### Final `tickets` columns after this story

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | bigint PK | no | Rendered as `#{id}`; **there is no separate reference column.** |
| `subject` | string | no | From the Story 01 scaffold. |
| `description` | text | **yes** | Added here. |
| `customer_id` | FK → `customers` | **no** | `restrictOnDelete`. Table owned by Story 03. |
| `status` | string, default `'open'` | no | Scaffold column, now cast to `TicketStatus`. |
| `priority` | string, default `'normal'` | no | Scaffold column, now cast to `Priority`. |
| `category` | string(32), default `'general'` | no | Allow-list, not an enum. |
| `channel` | string(16), default `'email'` | no | Cast to `Channel`. |
| `assigned_to` | FK → `users` | **yes** | Scaffold column, `nullOnDelete`. `null` = Unassigned. |
| `created_by` | FK → `users` | **yes** | Added here, `nullOnDelete`. **Never equal to `assigned_to` by default.** |
| `resolved_at` | timestamp | **yes** | Set on entering `resolved`; **cleared on leaving it.** |
| `closed_at` | timestamp | **yes** | Set on entering `closed`. **May be set while `resolved_at` is null.** |
| `created_at` / `updated_at` | timestamps | no | Scaffold columns. |

Indexes: `assigned_to` (scaffold) · `(assigned_to, status, created_at)` · `(status, priority)` · `customer_id` · `channel`.

**Story 06 adds `first_response_due_at` and `resolution_due_at` in its own migration. This story does not.**

### `ticket_events` — the ticket history table

`id · ticket_id (FK cascade) · user_id (FK nullable, nullOnDelete) · event · field · old_value · new_value · created_at`, append-only, no `updated_at`. Model `App\Models\TicketEvent`, resource `TicketEventResource`. Event values written by this story: `created`, `status_changed`, `priority_changed`, `category_changed`, `assigned`, `unassigned`, `reopened`.

**Later stories append new `event` values here; they do not create a second history table, and they do not write ticket lifecycle changes into `audit_logs`** (Story 01's authentication audit).

### `TicketResource` JSON shape

```jsonc
{
  "id": 4821,
  "reference": "#4821",
  "subject": "Unable to reset password via email link",
  "description": "…" ,                       // nullable
  "status": "open",           "status_label": "Open",
  "priority": "high",         "priority_label": "High",
  "category": "account",      "category_label": "Account",
  "channel": "email",         "channel_label": "Email",
  "customer":   { "id": 12, "name": "Amelia Chen" },        // nullable; id + name ONLY
  "assignee":   { "id": 3, "name": "Sarah Ahmed", "initials": "SA" },  // nullable; NEVER carries email
  "created_by": { "id": 3, "name": "Sarah Ahmed" },         // nullable
  "sla": { "due_at": null, "minutes_left": null, "risk": null },   // Story 06 fills; SHAPE IS FIXED
  "resolved_at": null,
  "closed_at": null,
  "created_at": "2026-08-26T09:12:00.000000Z",
  "updated_at": "2026-08-26T11:40:00.000000Z"
}
```

- **`sla.risk` is one of `"breached" | "at_risk" | "ok" | null`.** It is `null` for every ticket until Story 06 lands. **Story 06 changes the values, never the keys** — the queue's SLA column is already written against all four cases.
- **`customer` carries `id` and `name` only.** Everything else about a customer comes from Story 03's `CustomerResource` via `GET /api/customers`.
- **`assignee` never carries `email`**, guarded by `tests/Feature/TicketScopeTest.php` lines 60–64 and by the column-limited eager load.
- Collections are wrapped in Laravel's standard `{ data, links, meta }` envelope.

### API surface (all behind `auth:sanctum`)

| Method | Path | Owner |
|---|---|---|
| `GET` | `/api/tickets` | this story — faceted, sorted, server-paginated, role-scoped |
| `GET` | `/api/tickets/meta` | this story — facet options + assignable agents |
| `POST` | `/api/tickets` | this story |
| `POST` | `/api/tickets/bulk` | this story — per-row authorization, `{applied, skipped}`, always **200** |
| `GET` | `/api/tickets/{ticket}` | this story |
| `PATCH` | `/api/tickets/{ticket}` | this story — transition-gated |
| `GET` | `/api/tickets/{ticket}/events` | this story |

**`/api/tickets/meta` must stay registered before `/api/tickets/{ticket}`.** `GET /api/tickets` query parameters: `status[]`, `priority[]`, `channel[]`, `category[]`, `customer_id[]`, `assigned_to[]` (user ids as strings, plus the literal `unassigned`), `q`, `sort` (`id|customer|priority|status|updated_at`, `-` prefix for descending), `page`, `per_page` (**10, 25 or 50**).

### Frontend

- `web/src/features/tickets/` with `index.ts` exporting **`TicketQueuePage` only**.
- `ticketKeys` in `features/tickets/api/queryKeys.ts` is the one keying scheme for every ticket query. **Stories 05, 06, 07, 11, 12 and 13 nest under `ticketKeys.all`; every ticket mutation invalidates that root.**
- Design tokens `--prio-*`, `--status-*`, `--sla-*`, `--table-*`, `--bulk-bar-*`, `--checkbox-border`, `--skeleton-*`, `--queue-table-breakpoint` live in `web/src/index.css` and are **reused, not redefined**, by every later screen showing a ticket.
- **Priority and status are two components with two token sets** (`PriorityBadge`, `StatusBadge`). `docs/design/brief.md` line 217 forbids merging them.
- **Filter and pagination state lives in the URL**, parsed through `ticketFiltersSchema`. Every later list screen follows this pattern.
- The header's **New Ticket** control is a `<Link to="/tickets?new=1">`; the modal's open state is a URL parameter, not component state.

---

## Done Criteria

- [x] `api/database/migrations/2026_08_25_200001_create_tickets_table.php` is **byte-for-byte unchanged**; every new column arrived through a new migration.
- [x] The `tickets` table matches the shared-contract table exactly, `customer_id` is **NOT NULL** with a `restrictOnDelete` FK to `customers`, and all five indexes exist.
- [x] `Priority`, `TicketStatus` and `Channel` exist in `api/app/Enums/` with exactly the cases and labels pinned above, and `Ticket::casts()` casts all three.
- [ ] `ticket_events` exists, is append-only, and records `created`, `status_changed`, `priority_changed`, `category_changed`, `assigned`, `unassigned` and `reopened` with the actor's id and timestamp — **asserted by a test**, not by inspection. No ticket lifecycle change is written to `audit_logs`.
- [ ] `GET /api/tickets` applies `visibleTo()` **before** any facet, and a test proves an Agent cannot widen their own scope with `?assigned_to[]=` — including the `unassigned` sentinel.
- [ ] Sorting by priority orders urgent → high → normal → low, driven by `Priority::sortExpression()`; an unknown `sort` key falls back to newest-first rather than erroring.
- [ ] Pagination is server-side, accepts only 10/25/50, and keeps filters on later pages via `withQueryString()`.
- [ ] `POST /api/tickets` requires customer, category and priority; **leaves `assigned_to` null when none is given**; records `created_by`; and forces `status` to `open`.
- [ ] `PATCH /api/tickets/{ticket}` rejects an illegal transition with 422, sets `resolved_at` / `closed_at`, and **clears `resolved_at` when a ticket leaves `resolved`**.
- [ ] `POST /api/tickets/bulk` authorises **per row**, returns **200** with `{applied, skipped}` even when every row is skipped, caps at 100 ids, and runs inside a transaction with `lockForUpdate()`.
- [x] `TicketResource` matches the pinned JSON shape, including the fixed four-key `sla` object, and **never** exposes an assignee email — `tests/Feature/TicketScopeTest.php`'s two tests pass with their assertions unchanged.
- [x] `/tickets` renders the real queue; `PagePlaceholder` no longer appears at that route; `web/src/App.tsx` is otherwise unchanged.
- [x] The queue row shows channel icon, `#id`, subject, last-updated, customer, priority, status, assignee and SLA — **nine columns**, with priority and status as **two separate labelled badges**.
- [x] All four states ship, each from its own component, with **two** distinct empty-state copies (filtered vs. genuinely empty) and an error state containing no stack trace and no API URL.
- [x] Filter, sort, page and page-size state round-trips through the URL: a copied URL reproduces the view in a new tab, survives a reload, and the back button walks the filter history. A malformed URL falls back to defaults instead of crashing.
- [x] Selecting rows raises the bulk bar; the confirmation names the count and the action; a partial result reports the skipped count to the user rather than claiming success.
- [x] The header's **New Ticket** button is no longer `disabled`; it links to `/tickets?new=1` and the modal's open state lives in the URL.
- [x] Every new token is declared in **all four** blocks of `web/src/index.css`, and a `CLOSED` status badge is visibly distinct from a `LOW` priority badge in both themes.
- [ ] Below **900px** the table becomes cards on which priority, status and SLA-risk stay visible, and the page body never scrolls horizontally from 375px up.
- [x] Under RTL the column order mirrors, `#4821` still reads `#4821`, and the pagination chevrons mirror — the export's own omission is corrected, not copied.
- [x] No `outline: none` without a replacement anywhere in this story; the skeleton and the modal both respect `prefers-reduced-motion`; every interactive element has a visible focus ring.
- [ ] `npx vitest run` and `php artisan test` are both fully green, `npm run build` and `npm run lint` are clean, and `ReactQueryDevtools` is absent from the production bundle.
- [x] `.squad/plans/ticket-management/00-overview.md` records the Story 04 row and re-points the carried-forward `teams` debt at Story 08.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 05.**
