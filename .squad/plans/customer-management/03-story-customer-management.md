# Story 03 — Customer Management (Story: WIS-4)

## Prerequisites

- **Story 01 completed** — [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md). This story consumes it and **must not** re-derive any of it:
  - `api/app/Enums/UserRole.php` **lines 5–18** — `UserRole::Agent | TeamLead | Administrator`, each with `label()`.
  - `api/app/Models/User.php` **lines 42–50** — `isAdministrator()` and `canSeeTeamQueue()` (true for `TeamLead` and `Administrator`). **`CustomerPolicy` uses these two helpers; it does not re-implement a role check.**
  - `api/routes/api.php` **lines 14–18** — the `auth:sanctum` group. Every endpoint this story adds goes **inside that existing group**.
  - `web/src/lib/api.ts` **lines 14–26** — the one Axios instance, `baseURL` `VITE_API_URL || http://localhost:8000/api`, `Bearer` token attached by the request interceptor. **Do not create a second Axios instance.**
  - `web/src/lib/queryClient.ts` **lines 3–13** — the `QueryClient` singleton (`retry: 1`, `refetchOnWindowFocus: false`, `staleTime: 30_000`, `mutations.retry: false`).
  - `web/src/features/auth/AuthContext.tsx` **lines 5–13** — the `User` type with `role`, `role_label`, `home_route`. `user.id` is what keys the per-user column preference in Frontend Task 6.
- **Story 02 completed** — [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md). This story fills the placeholder that story created:
  - `web/src/App.tsx` **line 46** — `<Route path="/customers" element={<PagePlaceholder title="Customers" />} />`. **This story replaces that one line and adds a child route.**
  - `web/src/app/navigation/navItems.tsx` **lines 48–56** — the `Customers` nav entry already exists and points at `/customers`. **This story does not edit `navItems.tsx`.** Shared contract 6 (one nav manifest) is already satisfied; adding a second entry for the profile route would break `navRoutes.test.tsx`, which sweeps every manifest entry (it imports `navItems` at **line 10**).
  - `web/src/app/layouts/AppLayout.tsx` **line 218** — `<main id="main-content" className="shell-main" tabIndex={-1}><Outlet /></main>`. The Customers page renders inside that `<main>`; **it must not render its own sidebar, header, or `<h1>` for the app name.**
  - `web/src/index.css` **lines 20–125** — the three-block token structure (bare `:root`, `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`, `:root[data-theme="dark"]`, plus `:root[data-theme="light"]`). Every token this story adds goes into **all four** blocks, in that order.
  - `web/src/index.css` **lines 415–420** — `.shell-main` already carries `flex: 1; min-inline-size: 0; overflow-x: auto; padding-block: 24px; padding-inline: 28px`. **The Customers page must not add its own page padding** or it doubles to 56px, and must not add a second `overflow-x` container around the whole page.
- **Verified toolchain state** (read at plan time — do not assume, these differ from older notes):

  | Where | Package / setting | Actual value | Matters because |
  |---|---|---|---|
  | `api/composer.json` | `laravel/framework` | **^13.17** | Laravel 13, not 12. `Schema::hasColumn`, `whereAny`, and enum casts used below are all available. |
  | `api/composer.json` | `pestphp/pest` | **^5.1** | Pest 5 syntax — `uses(RefreshDatabase::class)` at file top, `it(...)`, `expect(...)`. |
  | `api/composer.json` | `laravel/sanctum` | ^4.0 | Bearer-token mode (ADR-004). Tests authenticate with `createToken('spa')->plainTextToken`. |
  | `api/.env` **line 23** | `DB_CONNECTION` | **`pgsql`** (Supabase pooler, `DB_HOST` line 24) | The dev database is **PostgreSQL**, not the SQLite fallback STATUS.md line 16 still describes. Partial unique indexes are available. |
  | `api/phpunit.xml` | `DB_CONNECTION` / `DB_DATABASE` | `sqlite` / `:memory:` | **Tests run on SQLite while dev runs on Postgres.** Every migration statement in this story must execute on both — see Backend Task 2. |
  | `api/config/filesystems.php` | `default` disk | `env('FILESYSTEM_DISK', 'local')`, `local` root `storage_path('app/private')` | Attachments are stored on the **private** local disk and streamed through an authorized controller — never `public`. |
  | `web/package.json` **lines 12–21** | `react` 19.2.8 · `react-router-dom` **7.18.2** · `@tanstack/react-query` **5.102.3** · `react-hook-form` 7.86.0 · `@hookform/resolvers` 5.9.1 · `zod` **4.4.3** · `axios` 1.19.0 | `useSearchParams` (router 7), `keepPreviousData`/`placeholderData` (Query 5), and Zod **4** API are all present. **Zod 4** — `z.string().email()` still works but `z.email()` is the v4 form; match `web/src/features/auth/loginSchema.ts` lines 3–6, which uses `z.string().email()`. |
  | `web/package.json` **lines 6–11** | scripts | `dev`, `build` (`tsc -b && vite build`), `lint` (`oxlint`), `preview` | **There is no `test` script.** Run `npx vitest run`. |
  | `web/package.json` **line 35** | `vitest` | 4.1.11, configured in `web/vite.config.ts` **lines 7–11** (`globals: true`, `jsdom`, `setupFiles: './src/test/setup.ts'`) | Tests need no per-file `environment` pragma. |
- **`web/src/test/setup.ts` lines 5–17 mock `window.matchMedia`.** Keep it. Any component this story adds that reads `prefers-reduced-motion` depends on it under jsdom.
- **Coordination with Story 04 (Ticket Management, WIS-2), being planned in parallel.** This story **owns** the `customers` table, the `Customer` model, `CustomerResource`, `CustomerPolicy`, and every `/api/customers*` route. Story 04 **consumes** them and adds `tickets.customer_id`. The exact, final shape is pinned in **[§ Contract owned by this story](#contract-owned-by-this-story--story-04-consumes-this-verbatim)** below. **Do not change any name in that section during implementation** — Story 04's plan was written against it.

---

## Story Goal

Replace the `/customers` placeholder with the project's **reference implementation of the 2026 data-table pattern** (`docs/design/brief.md` **line 30** and **lines 165–169**), plus the customer profile it links to, and ship the backend that serves both.

User-visible outcomes:

1. **Customers list** — a server-paginated, server-filtered table. Filter, sort, and page state live in the URL, so a filtered view is a shareable link and the browser Back button works.
2. **Faceted filters** — Company and Tier, with counts computed server-side over the *whole* filtered set, not over the current page.
3. **Column visibility and reorder** persist per user across visits.
4. **Bulk selection** with an action bar; a bulk action shows a confirmation naming **both the count and the action** before it runs.
5. **Create / edit a customer** in a modal. **Name plus at least one of email or phone** is required. A duplicate email or phone is **blocked** with a message that links to the existing record.
6. **Customer profile** — contact details, an **interaction history** derived live from tickets, **notes** (timestamped, attributed, visible to every agent), and **attachments** (size-capped, type-restricted, with actionable rejection messages).
7. **All four async states everywhere** — loading skeleton, error, empty, success — per `docs/design/brief.md` **lines 181–186**.
8. **RTL** — the table's column order fully mirrors and the actions column lands on the visual left, with **one** column definition, not two.

**In scope beyond the obvious:** a **generic `DataTable` component** under `web/src/components/data-table/`, used by this story and consumed unchanged by Story 09 (Knowledge Base, WIS-5) per the intake's "Extra notes". Building it inside `features/customers/` would force Story 09 to either import across features or fork it.

**Explicitly NOT in scope** (from the intake's own "Out of scope"):

- ERP / external CRM sync. Customer records are created and edited only inside Wisal.
- The Customer Portal (customer-facing self-service login). Separate, later story.
- A **merge workflow**. This story flags and blocks a likely duplicate at creation time; it does not merge two existing records.
- **Ticket creation or editing.** The profile's interaction-history panel is **read-only** and is the only place this story touches tickets.
- The header's global search and **New Ticket** button. Story 02 shipped both inert on purpose; **do not wire them here**.
- Arabic strings. The RTL *layout* is this story; the Arabic *catalogue* is WIS-11 (Story 15). Every label this story adds must be a plain English string in one place per component so Story 15 can extract it — **do not** invent a second i18n mechanism.

---

## Context — Read These Files First

1. `docs/design/references/4.Data Table/WisalCustomers-LightLTR.dc.html` — **the primary reference. Build from it; do not invent.** 147 lines, one artboard. **Lines 19–41 are the sidebar and lines 44–61 the header — both already built by Story 02. Ignore them entirely.** Read only:
   - **Line 63** — the page container: `padding:24px 28px; display:flex; flex-direction:column; gap:16px`. **The padding is already on `.shell-main` (index.css lines 419–420) — take the `gap:16px` and the column flow, not the padding.**
   - **Line 64** — the page title block: `Customers` at `22px/700`, subtitle `248 customers` at `13px`, `color:#64748B`, `margin-top:2px`.
   - **Lines 66–69** — the facet chip row: `gap:8px`; each chip `background:#fff; border:1px solid #E2E8F0; border-radius:8px; padding:6px 10px; font-size:12.5px; font-weight:600; color:#334155`, a 6px indigo dot, the label `Company: All`, and a chevron.
   - **Line 71** — the table card: `background:#fff; border:1px solid #E2E8F0; border-radius:10px; min-height:0; overflow:hidden`.
   - **Line 72** — **the column grid: `grid-template-columns: 32px 2fr 1.6fr 1fr 90px 110px 100px`**, header row `padding:10px 14px; font-size:11px; font-weight:700; color:#94A3B8; border-bottom:1px solid #E2E8F0`.
   - **Lines 74–79** — the seven header cells: (empty, for the select checkbox) · `CUSTOMER` · `EMAIL` · `COMPANY` · `OPEN` · `LAST CONTACT` · `TIER`. **Four carry a sort chevron glyph (`M7 9l3-3 3 3 M7 15l3 3 3-3`, stroke `#CBD5E1`) — CUSTOMER, COMPANY, OPEN, LAST CONTACT. EMAIL and TIER do not.** That is the sortable-column list.
   - **Lines 82–86** — one row: `padding:10px 14px; font-size:12.5px; border-bottom:1px solid #F1F5F9`; a 16px checkbox (`border-radius:4px; border:1.5px solid #CBD5E1`); a **28px initials avatar** then the name; email and company at `#475569`; the open count at `#0F172A/600`; last contact at `#64748B`; the tier badge.
   - **Line 87–88** — the **selected** row: `background:#F8FAFC` with a filled checkbox `background:#4F46E5` + white tick.
   - **Tier badge values** — Enterprise `background:#EEF2FF; color:#4F46E5` (line 85), Standard `background:#F1F5F9; color:#64748B` (line 90), Premium `background:#FFFBEB; color:#B45309` (line 105). All `font-weight:700; font-size:10px; border-radius:6px; padding:3px 7px; width:fit-content`.
   - **Lines 123–134** — the pagination footer: `Showing 1–8 of 248` at `12px/#64748B` on the inline start, and 28px page buttons on the inline end; current page `background:#4F46E5; color:#fff`.
2. `docs/design/references/4.Data Table/WisalCustomers-DarkLTR.dc.html` — the dark palette **and the only artboard that shows the bulk-action bar**. Read:
   - **Lines 66–74** — the **bulk-action bar**: `background:rgba(129,140,248,0.12); border:1px solid rgba(129,140,248,0.35); border-radius:10px; padding:10px 14px; gap:12px`; `2 selected` at `13px/700/#A5B4FC`; a 1px divider; **Export** (download glyph), **Tag** (chevron), **Delete** (`color:#F87171`, trash glyph); a spacer; a close `✕` button.
   - **Line 76** — dark table card `background:#1C1D24; border:1px solid #2A2C33`.
   - **Lines 87 and 92** — **selected rows in dark are `background:rgba(129,140,248,0.12)`**, while the zebra rows (lines 102, 112) are `background:#202128`. Two different fills; do not collapse them.
   - **Line 77** — dark header row `color:#64748B; border-bottom:1px solid #2A2C33`; **line 123** dark sort chevron stroke `#3F4148`.
   - **Lines 129–133** — dark pagination: current page `background:#818CF8; color:#121317`.
3. `docs/design/references/4.Data Table/WisalCustomers-EmptyState.dc.html` — **the empty state, verbatim.** Read **lines 78–88**: a 56px `#F1F5F9` circle holding the Customers glyph with a `#DC2626` slash overlay, the heading **"No customers match these filters"** at `15px/700`, the body **"No one at "Vertex Retail" is tagged Enterprise tier yet. Try a different company or clear your filters."** at `13px/#64748B/line-height:1.6`, and two buttons — **"Reset filters"** (outlined) and **"Add Customer"** (indigo). **The body text names the actual active filters** — that is the acceptance criterion, not decoration. Note **line 73**: the subtitle reads `0 customers`, so the count line stays visible in the empty state.
   - **Line 14** defines `.fv:focus-visible{outline:2px solid #4F46E5;outline-offset:2px;border-radius:4px;}` and **the markup uses it** (4 occurrences). Unlike the app-shell exports, this file's focus class is **defined**.
4. `docs/design/references/4.Data Table/WisalCustomers-LoadingState.dc.html` — **the loading skeleton, verbatim.** Read:
   - **Lines 15–20** — the `.sk` rule: `display:inline-block; background:#E2E8F0; border-radius:4px; animation:sk-pulse 1.5s ease-in-out infinite`, the `@keyframes sk-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}`, and **`@media (prefers-reduced-motion: reduce){ .sk{ animation:none; opacity:0.75; } }`**. Port all three. `docs/design/brief.md` **line 195** makes the reduced-motion guard binding.
   - **Line 84** — the skeleton keeps the **real** `Customers` title and skeletons only the count (`width:90px;height:14px`).
   - **Lines 85–88** — the facet chips become two skeletons (`110px` and `130px`, `height:28px`, `border-radius:8px`).
   - **Line 90** — **the header row is NOT skeletoned**; it renders its real labels, with no sort chevrons.
   - **Lines 92–97** — **six** skeleton rows at `padding:12px 14px; gap:10px`, each with a 16px checkbox, a 28px circle + a name bar, then bars of `140/100/20/70` px and a `60×18` tier pill. **Row height must match the real row height** or the table jumps when data lands.
   - **Grep check performed at plan time:** `.sk` and `.fv` are used **only** in `WisalCustomers-LoadingState.dc.html` (51 + 4 occurrences) and `WisalCustomers-EmptyState.dc.html` (4 occurrences), and **both files define both rules in their `<style>` block**. The recurring export defect described in `STATUS.md` **lines 49–53** does **not** bite here. The four Light/Dark LTR/RTL artboards contain **zero** `class=` attributes — every style there is inline, and they carry no `outline`, `tabindex`, or `aria-*` anywhere. **They are a visual reference only; the entire accessible table structure is new work.**
5. `docs/design/references/4.Data Table/WisalCustomers-LightRTL.dc.html` — **read this to understand what mirroring means, then implement it with one column list.** Note:
   - **Line 18** — `dir="rtl"` on the artboard root and the font switches to `'IBM Plex Sans Arabic'`. `web/src/index.css` **line 165** already sets `font-family: Inter, 'IBM Plex Sans Arabic', system-ui…` on `.shell`, so no font work is needed here.
   - **Line 19** — the export hand-mirrors `border-right` → `border-left`. Use logical properties instead.
   - **Line 77** — the export hand-reverses the grid to `100px 90px 1fr 1.6fr 2fr 32px`. **This is the expected *result*, not the technique.** `grid-template-columns` is resolved in the **inline** direction, so a single LTR-ordered track list mirrors automatically inside `dir="rtl"`. **Do not write a second `grid-template-columns` for RTL.**
   - **Line 91** — the row's checkbox cell carries `justify-self:end`, i.e. the select/actions column sits at the visual **left** under RTL, exactly as `docs/design/brief.md` **line 168** requires.
   - **Lines 48, 64, 67, 136** — numerals and the `⌘K` badge are wrapped in `direction:ltr; display:inline-block`. **The pagination summary ("Showing 1–8 of 248") and every numeric cell need the same treatment**, or `1–8` renders as `8–1`.
   - **Export defect to be aware of, not to copy: the RTL artboard drops the EMAIL column entirely** (6 tracks vs. 7). That is an export inconsistency. **Keep EMAIL in both directions.**
6. `docs/design/references/5.Modals/WisalModals-LightLTR.dc.html` — the create/edit and confirm patterns. Read:
   - **Lines 109–136** — the **Edit Customer** modal: 480px wide, `border-radius:16px`, header `18px 22px` with a title at `16px/700` and a close `✕`; body `padding:20px 22px; gap:14px`; fields **Name · Email · Company · Phone**, each a `12.5px/600/#334155` label above a `border:1px solid #E2E8F0; border-radius:8px; padding:9px 12px; font-size:13px` input; a **Tier** three-button segmented control (**Standard** neutral, **Premium** `#FFFBEB/#B45309/border #FDE68A`, **Enterprise** selected as `border:2px solid #4F46E5; background:#EEF2FF; color:#4F46E5`); and a **read-only "Customer since"** field on `background:#F8FAFC`. **This modal is the field list for Backend Task 2's columns — the design and the schema must agree.**
   - **Line 130** — the footer puts **Delete Customer** (`border:1px solid #FECACA; color:#DC2626`) on the inline start and **Cancel** / **Save Changes** on the inline end.
   - **Lines 139–150** — the **confirmation dialog**: 380px, a 36px `#FEF2F2/#DC2626` warning circle, the title **"Delete Amelia Chen?"** — *the specific record is named in the title* — a body naming the consequence, then **Cancel** / **Delete Customer** (`background:#DC2626`).
   - **Lines 97–101** — the attachment dropzone pattern: `border:2px dashed #CBD5E1; border-radius:8px; padding:18px`, an upload glyph, and the text **"Drag files here or click to browse"**.
7. `docs/design/brief.md` — **line 30** (the 2026 data-table consensus this story implements: *server-side pagination, faceted filters, filter state in the URL, column visibility/reorder, bulk-action bar* — "adopted wholesale for Customers and Knowledge Base"), **lines 165–169** (the data-table rules, including the RTL rule at line 168), **lines 181–186** (all four states, plus *"Destructive actions add a **Confirmation** state naming the specific record"*), **lines 189–197** (`outline: none` without a replacement is forbidden; `prefers-reduced-motion` respected; colour never the only signal), **lines 199–206** (RTL mirrors column order and directional icons — not only text alignment), and the token block at **lines 62–126** (spacing 4px base; radius sm 6 / md 10 / lg 16; **badge text on a light tint uses `#B45309` / `#B91C1C`, not the general warning/danger values** — see the `badge_text_on_tint` note).
8. `api/app/Policies/TicketPolicy.php` **lines 8–19** — **the precedent `CustomerPolicy` follows exactly**: a plain class in `App\Policies`, no `HandlesAuthorization` trait, `viewAny(User)` returning `true`, and per-model methods delegating to `User::canSeeTeamQueue()`. Laravel 13 auto-discovers `App\Policies\CustomerPolicy` for `App\Models\Customer` — **no registration in `AppServiceProvider` is required** (verify: `api/app/Providers/AppServiceProvider.php` lines 13–28 registers no policies today).
9. `api/app/Http/Controllers/TicketController.php` **lines 15–22** — the controller shape to match: `use AuthorizesRequests`, `$this->authorize(...)` first, return `Resource::collection(...->paginate(25))` typed as `AnonymousResourceCollection`.
10. `api/app/Http/Resources/UserResource.php` **lines 10–21** and `api/app/Http/Resources/TicketResource.php` **lines 10–24** — the resource style: a flat array, enum values emitted as `->value` alongside a `_label`, related models inlined as a small object, **never the full related resource**.
11. `api/database/migrations/2026_08_25_200001_create_tickets_table.php` — **lines 9–21**. Line 9's comment is *"The Ticket Management story expands this table"*. **This story must not touch this file** and must not add `customer_id` to it. `tickets` currently has only `id, subject, status, priority, assigned_to, timestamps` — which is why the interaction-history endpoint in Backend Task 8 is column-guarded.
12. `api/database/migrations/2026_08_25_200000_create_audit_logs_table.php` **lines 24–26** — the precedent for a driver-conditional migration statement (`if (DB::connection()->getDriverName() === 'pgsql')`). **Backend Task 2's partial unique indexes use the same guard shape.**
13. `api/tests/Feature/TicketScopeTest.php` **lines 1–44** (imports, `uses(RefreshDatabase::class)`, a `beforeEach` seeding users and rows onto `$this->`) and **lines 46–65** (token auth via `createToken('spa')->plainTextToken`, `withHeader('Authorization', "Bearer {$token}")`, `assertJsonCount(2, 'data')`). **Match this file's style exactly.** `api/tests/Pest.php` **line 5** binds `TestCase` to the `Feature` directory only — feature tests need no `namespace`.
14. `api/tests/Feature/Auth/LoginTest.php` **lines 16–33** — the assertion style for a JSON contract: `assertJsonStructure([...])` + `assertJsonPath(...)`. Use it to lock `CustomerResource`'s shape.
15. `api/database/seeders/DatabaseSeeder.php` **lines 16–89** — the four seeded accounts (`agent@wisal.test`, `agent2@wisal.test`, `lead@wisal.test`, `admin@wisal.test`, all password `Password123!`, plus `disabled@wisal.test`) and the four seeded tickets. **Backend Task 9 appends customers to this file; it does not create a second seeder class.**
16. `web/src/features/auth/` — the feature-folder convention this story extends: `loginSchema.ts` **lines 3–8** (a Zod object plus `z.infer` as the single source of the form type), `useLogin.ts` **lines 7–15** (a hook wrapping `useMutation`, exported from the feature, not inlined in the page).
17. [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md) — the precedent for tone, and specifically its **Task 6** rules on logical properties, the physical-`translateX` caveat, and `min-inline-size: 0`. Its **Test Plan** item 4 explains why `navRoutes.test.tsx` sweeps the nav manifest; keep that test passing untouched.
18. **Grep before you start**, to confirm nothing already exists under these names: `grep -ri "customer" api/app api/routes api/database/migrations` (expect: only the modal/design references, zero PHP hits) and `grep -ri "customer" web/src` (expect: only `navItems.tsx` lines 48–56 and `App.tsx` line 46).

---

## Product rules — where this plan resolves a conflict

Each row is a deliberate decision. **Do not silently revert one.**

| Source says | This plan does | Why |
|---|---|---|
| Intake AC: a duplicate email/phone is *"either blocked or flagged for merge review"* | **Blocks** it, with a `422` whose payload carries `duplicate_customer_id`, and a frontend message that **links to the existing record** | The same AC lists merge tooling as out of scope. A flag with nowhere to go is a dead end; a block plus a link to the existing customer is the smallest thing that actually prevents fragmented ticket history. |
| Intake technical hint: *"a partial unique index on (email) or (phone) where not null"* | **Both**, as two partial unique indexes, plus a matching `Rule::unique(...)->whereNull('deleted_at')` in the FormRequest | The index is the guarantee; the validation rule is what produces a readable error instead of a 500. One without the other is either an unfriendly crash or a race-condition hole. |
| Design: the modal has **Delete Customer**, and its confirm text says *"permanently deletes … and all associated ticket history"* | **Soft delete** (`deleted_at`), and the confirm body is rewritten to **"Removes Amelia Chen from the customer list. Their ticket history is preserved and the record can be restored by an administrator."** | Story 04 puts a **NOT NULL** `tickets.customer_id` FK on this table. A hard delete would either orphan or cascade-destroy real ticket history — the exact drift the intake's interaction-history AC exists to prevent. The design copy was written before that FK existed; the schema wins, and the copy is corrected to stay honest. |
| Design bulk bar (DarkLTR lines 69–71): **Export**, **Tag**, **Delete** | **Delete** and **Tag** are real (Tag sets the tier — the only taggable field the schema has). **Export** ships **inert**: `disabled` with `title="Coming soon"` | The intake's bulk AC needs at least one real action with a counted confirmation; Delete and Tag deliver it. CSV export invents a data-export surface no story owns and no AC names. Story 02 established the inert-but-visible precedent for exactly this case. |
| Intake AC: *"an authenticated Agent or above"* may create a customer | `create` and `update` → **every authenticated role**. `delete` (single and bulk) and bulk tier changes → **`User::canSeeTeamQueue()`** (Team Lead + Administrator) | "Agent or above" is explicit for creation. Destructive and bulk actions are not mentioned, and `canSeeTeamQueue()` already exists (`User.php` lines 47–50) as the project's one supervisor test. Inventing a third role predicate here would fragment authorization. |
| Design table shows an **OPEN** ticket-count column and a **LAST CONTACT** column | Both ship in Story 03. `open_tickets_count` is computed and returns **`0`** until Story 04 adds `tickets.customer_id`; `last_contact_at` is a real nullable column, seeded, and **written by Story 05** | Verified: `tickets` has no `customer_id` (`2026_08_25_200001_create_tickets_table.php` lines 12–20). Removing the columns now would mean re-planning the table twice. A column that is correct-but-zero is honest; a column that disappears is a breaking change for Story 04. |
| Intake AC: *"interaction history … derived live from the Ticket entity, not duplicated/denormalized data"* | `GET /api/customers/{customer}/tickets` queries the `tickets` table directly and is **column-guarded** with `Schema::hasColumn('tickets', 'customer_id')`, returning an **empty page** with `"pending_story": "WIS-2"` in `meta` until Story 04 lands | This is the seam between two stories being planned in parallel. A guarded live query satisfies the AC's "derived live" requirement the day the column exists, with **zero** changes to this endpoint. **Do not cache, copy, or denormalize ticket data onto `customers`.** |
| Intake: *"filter state in the URL"* | **`useSearchParams`** from `react-router-dom` is the **only** store for `q`, `company`, `tier`, `sort`, `dir`, `page`, `per_page`. **No `useState` mirror of any of them.** | Shared contract 5. A `useState` copy alongside the URL is how Back-button behaviour and shareable links break; the duplicate state always eventually disagrees. |
| Intake: column visibility/reorder *"persists for that user on next visit"* | `localStorage`, key **`wisal-customers-columns:{user.id}`**, written **only** on an explicit toggle/reorder — never on mount | The user id in the key is what makes it "for that user"; a shared key leaks one user's layout to the next person on the same machine. The never-write-on-mount rule is Story 02's (its `UiPreferencesContext` test asserts `localStorage.length === 0`); breaking it here would look like the same class of bug. |
| Intake: *"attachments … size-capped and type-restricted per system configuration"* | A new **`api/config/attachments.php`** read by the FormRequest; **no literal size or MIME list in the controller** | "Per system configuration" is the AC's own wording. Config is also what lets the error message quote the actual limit rather than a hard-coded number that drifts. |
| Intake: the shared DataTable is *"reused by WIS-5"* | It lives at **`web/src/components/data-table/`**, outside `features/` | Shared contract 5 says a feature folder's `index.ts` is its only public surface — so Story 09 importing from `features/customers/` would be a violation. A component used by two features is shared infrastructure, like `lib/`. |
| `STATUS.md` line 16 says the DB is on the *"Path B SQLite fallback"* | Treat **PostgreSQL as the dev database** and SQLite as the **test** database | Verified in `api/.env` line 23 (`DB_CONNECTION=pgsql`, Supabase host on line 24) against `api/phpunit.xml` (`sqlite` / `:memory:`). STATUS.md is stale on this point. **Do not update `STATUS.md` in this story** — it is outside the two files this plan writes. |

---

## Contract owned by this story — Story 04 consumes this verbatim

> **This section is binding across stories.** Story 04 (Ticket Management, WIS-2) was planned in parallel against exactly these names. Changing a column name, an enum value, or a JSON key here silently breaks a plan that is already written. If implementation forces a change, **stop and report it** rather than renaming locally.

### C1 — `customers` table, final shape

Created by **`api/database/migrations/<ts>_create_customers_table.php`** (Backend Task 2). Nothing else may add a column to `customers` in this story.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `bigIncrements` (`$table->id()`) | no | — | **Integer PK, not UUID.** Story 04's FK targets this. |
| `name` | `string` (255) | **no** | — | Required by AC. |
| `email` | `string` (255) | **yes** | `null` | Stored **lower-cased and trimmed**. Partially unique — see C2. |
| `phone` | `string` (32) | **yes** | `null` | Stored **as entered** (display form, e.g. `+1 (415) 555-0148`). |
| `phone_normalized` | `string` (32) | **yes** | `null` | Derived: digits only, keeping a leading `+`. **Never set by client input** — maintained by the model. Partially unique — see C2. |
| `company` | `string` (255) | yes | `null` | Facet source. |
| `tier` | `string` (20) | no | `'standard'` | Cast to `App\Enums\CustomerTier`. Values: `standard` · `premium` · `enterprise`. |
| `last_contact_at` | `timestamp` | yes | `null` | **Story 05 writes this** when a message lands on one of the customer's tickets. Story 03 only seeds and displays it. |
| `created_by` | `foreignId` → `users.id` | yes | `null` | `nullOnDelete()`. |
| `deleted_at` | `softDeletes` | yes | `null` | **Soft delete.** Every default query excludes trashed rows. |
| `created_at` / `updated_at` | `timestamps` | yes | — | `created_at` renders as the modal's read-only **"Customer since"**. |

Indexes: `index('company')`, `index('tier')`, `index('last_contact_at')`, plus the two partial unique indexes in C2.

### C2 — Duplicate-prevention indexes (exact SQL)

Raw statements, because Laravel's schema builder has no partial-index API. **Both statements are valid on PostgreSQL and on SQLite 3.8+**, so they run unguarded in `up()` — unlike the audit-logs `jsonb` cast, which needed the `pgsql` guard:

```sql
CREATE UNIQUE INDEX customers_email_unique
  ON customers (email) WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX customers_phone_normalized_unique
  ON customers (phone_normalized) WHERE phone_normalized IS NOT NULL AND deleted_at IS NULL;
```

### C3 — What Story 04 adds (and must NOT do here)

Story 04, in **its own new migration** (never editing `2026_08_25_200001_create_tickets_table.php` and never editing this story's migration):

```php
$table->foreignId('customer_id')->nullable()->constrained('customers')->restrictOnDelete();
// … backfill …, then a follow-up change to NOT NULL
$table->index('customer_id');
```

- **`restrictOnDelete()`, not `cascadeOnDelete()`** — `customers` rows are soft-deleted, so a hard delete should be refused loudly rather than silently destroying ticket history.
- Story 04 adds `Customer::tickets(): HasMany` to `api/app/Models/Customer.php` **when it adds the column** — Story 03 deliberately does not define that relation, because the column does not exist yet.
- Story 04 renders a ticket whose customer was soft-deleted via `Customer::withTrashed()`. It does **not** remove the `SoftDeletes` trait.

### C4 — `CustomerResource` JSON, final shape

`api/app/Http/Resources/CustomerResource.php`. Every key below is contractual; **the frontend `Customer` type and Story 04's customer chip both read exactly these**:

```json
{
  "id": 12,
  "name": "Amelia Chen",
  "email": "amelia.chen@northwind.io",
  "phone": "+1 (415) 555-0148",
  "company": "Northwind Retail",
  "tier": "enterprise",
  "tier_label": "Enterprise",
  "initials": "AC",
  "open_tickets_count": 3,
  "last_contact_at": "2026-08-22T09:14:00.000000Z",
  "created_at": "2023-03-14T00:00:00.000000Z",
  "updated_at": "2026-08-22T09:14:00.000000Z"
}
```

- `email`, `phone`, `company`, `last_contact_at` are **nullable**. `tier`, `tier_label`, `initials`, `open_tickets_count` are **never null**.
- `initials` — first letter of the first and last whitespace-separated word of `name`, upper-cased; a single-word name yields one letter. Computed in the resource, **not stored**.
- `open_tickets_count` is **`0`** until Story 04 lands. See C5.
- **`phone_normalized`, `created_by`, and `deleted_at` are never exposed.**

### C5 — `open_tickets_count` definition

Open = a ticket whose `status` is **not** in `['resolved', 'closed']`. Story 03 implements this with a column guard and a literal array; Story 04 replaces the literal with its `TicketStatus` enum **without renaming the JSON key or the query scope**:

```php
// api/app/Models/Customer.php — Story 04 swaps the literal for TicketStatus::openStates()
public function scopeWithOpenTicketCount(Builder $query): Builder
{
    if (! Schema::hasColumn('tickets', 'customer_id')) {
        return $query->selectRaw('0 as open_tickets_count');
    }

    return $query->withCount(['tickets as open_tickets_count' => fn ($q) => $q->whereNotIn('status', ['resolved', 'closed'])]);
}
```

### C6 — Routes owned by this story

All inside the existing `auth:sanctum` group in `api/routes/api.php`. **No other story adds a `/api/customers*` route.**

| Method | Path | Purpose | Policy ability |
|---|---|---|---|
| `GET` | `/api/customers` | Paginated, filtered, sorted list | `viewAny` |
| `GET` | `/api/customers/facets` | Company list + tier counts over the filtered set | `viewAny` |
| `POST` | `/api/customers` | Create | `create` |
| `GET` | `/api/customers/{customer}` | One customer | `view` |
| `PATCH` | `/api/customers/{customer}` | Update | `update` |
| `DELETE` | `/api/customers/{customer}` | Soft delete | `delete` |
| `POST` | `/api/customers/bulk` | `{ action: 'delete' \| 'set_tier', ids, tier? }` | `deleteAny` / `updateAny` |
| `GET` | `/api/customers/{customer}/tickets` | Interaction history (column-guarded) | `view` |
| `GET` · `POST` | `/api/customers/{customer}/notes` | List / add a note | `view` / `addNote` |
| `GET` · `POST` | `/api/customers/{customer}/attachments` | List / upload | `view` / `addAttachment` |
| `GET` | `/api/customers/{customer}/attachments/{attachment}` | Stream download | `view` |
| `DELETE` | `/api/customers/{customer}/attachments/{attachment}` | Remove | `deleteAttachment` |

**Route-order rule:** `/api/customers/facets` and `/api/customers/bulk` must be declared **before** `/api/customers/{customer}`, or `facets` binds as a customer id and returns 404.

### C7 — Frontend surface

`web/src/features/customers/index.ts` is the only public surface. It exports **`CustomersPage`**, **`CustomerProfilePage`**, the **`Customer`** type, and **`useCustomerSearch`** (a lightweight typeahead hook Story 04's New Ticket modal uses to pick a customer — see `WisalModals-LightLTR.dc.html` lines 59–74). Story 04 imports from `'../../features/customers'` and **nothing deeper**.

`web/src/components/data-table/` is shared infrastructure exported for Story 09 (Knowledge Base). Its public props are frozen in Frontend Task 2.

---

## Backend Tasks

Directory layout after this story (new files marked `+`):

```
api/app/
  Enums/            UserRole.php          CustomerTier.php  +
  Models/           User.php  Ticket.php  Customer.php  +  CustomerNote.php  +  CustomerAttachment.php  +
  Policies/         TicketPolicy.php      CustomerPolicy.php  +
  Http/
    Controllers/    TicketController.php  CustomerController.php  +  CustomerNoteController.php  +
                                          CustomerAttachmentController.php  +  CustomerBulkController.php  +
    Requests/       LoginRequest.php      StoreCustomerRequest.php  +  UpdateCustomerRequest.php  +
                                          IndexCustomerRequest.php  +  StoreCustomerNoteRequest.php  +
                                          StoreCustomerAttachmentRequest.php  +  BulkCustomerRequest.php  +
    Resources/      UserResource.php  TicketResource.php  CustomerResource.php  +
                                          CustomerNoteResource.php  +  CustomerAttachmentResource.php  +
api/config/         attachments.php  +
api/database/
  factories/        UserFactory.php       CustomerFactory.php  +
  migrations/       <ts>_create_customers_table.php  +
                    <ts>_create_customer_notes_table.php  +
                    <ts>_create_customer_attachments_table.php  +
```

### 1 — The tier enum

**Create file: `api/app/Enums/CustomerTier.php`** — mirror `api/app/Enums/UserRole.php` lines 5–18 exactly (backed string enum, a `label()` using `match ($this)`).

```php
<?php

namespace App\Enums;

enum CustomerTier: string
{
    case Standard = 'standard';
    case Premium = 'premium';
    case Enterprise = 'enterprise';

    public function label(): string
    {
        return match ($this) {
            self::Standard => 'Standard',
            self::Premium => 'Premium',
            self::Enterprise => 'Enterprise',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
```

`values()` is what the FormRequests pass to `Rule::in(...)` — **do not hand-write the three strings in a validation rule.**

### 2 — Migrations

**Create file: `api/database/migrations/<ts>_create_customers_table.php`** — implements contract **C1** and **C2**.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Owned by the Customer Management story (WIS-4). The Ticket Management
    // story adds tickets.customer_id pointing here; it does not edit this file.
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();              // stored lower-cased
            $table->string('phone', 32)->nullable();          // stored as entered
            $table->string('phone_normalized', 32)->nullable(); // derived; never client-supplied
            $table->string('company')->nullable();
            $table->string('tier', 20)->default('standard');
            $table->timestamp('last_contact_at')->nullable(); // written by the Conversation Thread story
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();

            $table->index('company');
            $table->index('tier');
            $table->index('last_contact_at');
        });

        // Partial unique indexes — the schema builder has no API for these.
        // Valid on both PostgreSQL (dev, .env line 23) and SQLite 3.8+ (tests, phpunit.xml).
        DB::statement('CREATE UNIQUE INDEX customers_email_unique ON customers (email) WHERE email IS NOT NULL AND deleted_at IS NULL');
        DB::statement('CREATE UNIQUE INDEX customers_phone_normalized_unique ON customers (phone_normalized) WHERE phone_normalized IS NOT NULL AND deleted_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
```

- **Do not** add `$table->unique('email')` as well — a full unique index would reject a second row with `NULL` on some drivers and would block re-using an email after a soft delete, which is the whole point of the `WHERE` clause.
- `down()` only drops the table; the indexes go with it. **Do not** write `DROP INDEX` statements — SQLite drops them with the table and a stray `DROP INDEX` on a missing table fails a rollback.

**Create file: `api/database/migrations/<ts>_create_customer_notes_table.php`**

```php
Schema::create('customer_notes', function (Blueprint $table) {
    $table->id();
    $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
    $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->string('author_name');   // snapshot, so a deleted user's note stays attributed
    $table->text('body');
    $table->timestamps();
    $table->index(['customer_id', 'created_at']);
});
```

`author_name` is a deliberate snapshot: the AC requires a note to stay **attributed**, and `nullOnDelete()` on `user_id` would otherwise leave an anonymous note. It duplicates a name, not ticket data — this is not the denormalization the interaction-history AC forbids.

**Create file: `api/database/migrations/<ts>_create_customer_attachments_table.php`**

```php
Schema::create('customer_attachments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
    $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
    $table->string('disk', 32)->default('local');
    $table->string('path');
    $table->string('original_name');
    $table->string('mime_type', 128);
    $table->unsignedBigInteger('size_bytes');
    $table->timestamps();
    $table->index(['customer_id', 'created_at']);
});
```

**Timestamp ordering matters.** All three files must sort **after** `2026_08_25_200001_create_tickets_table.php`, and `create_customers_table` must sort **before** the other two (they FK to it). Generate them with `php artisan make:migration` so the timestamps are monotonic; do not hand-write a filename.

### 3 — Config

**Create file: `api/config/attachments.php`**

```php
<?php

return [
    // Per-file cap. The validator's max: rule is in kilobytes.
    'max_kb' => (int) env('ATTACHMENT_MAX_KB', 10240), // 10 MB

    // Extensions accepted on a customer attachment.
    'allowed_extensions' => ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx'],

    // Disk from config/filesystems.php. MUST stay private — see the local disk,
    // root storage_path('app/private'). Never 'public'.
    'disk' => env('ATTACHMENT_DISK', 'local'),
];
```

Add `ATTACHMENT_MAX_KB=10240` to `api/.env.example` below `FILESYSTEM_DISK=local`. **Do not edit `api/.env`** — it holds live Supabase credentials.

### 4 — Models

**Create file: `api/app/Models/Customer.php`**

```php
<?php

namespace App\Models;

use App\Enums\CustomerTier;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class Customer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'email', 'phone', 'company', 'tier', 'last_contact_at', 'created_by'];

    protected function casts(): array
    {
        return [
            'tier' => CustomerTier::class,
            'last_contact_at' => 'datetime',
        ];
    }
    // …
}
```

Four things this model owns, each of which a naive version gets wrong:

- **Normalisation on save.** `setEmailAttribute` lower-cases and trims (`Str::lower(trim($value)) ?: null`), and `setPhoneAttribute` stores the display value **and** derives `phone_normalized` in the same setter: keep a leading `+`, strip everything that is not a digit, and store `null` when the result is empty. **An empty string must become `null`**, or two customers with a blank phone collide on the unique index. Write both setters, not a `saving` listener — a listener does not run for `Customer::withoutEvents()` paths and is harder to test.
- **`initials()`** — a public accessor used by `CustomerResource`. `Str::of($this->name)->squish()->explode(' ')` → first character of the first and last element, upper-cased, at most two characters.
- **`scopeWithOpenTicketCount()`** — exactly as pinned in contract **C5**, including the `Schema::hasColumn('tickets', 'customer_id')` guard and the comment naming Story 04.
- **Relations:** `notes(): HasMany` (ordered `latest()` at the query site, not in the relation), `attachments(): HasMany`, `creator(): BelongsTo(User::class, 'created_by')`. **No `tickets()` relation** — the column does not exist yet; contract C3 assigns it to Story 04.

Also add a search scope, so the controller stays thin and one definition of "search" serves the list and the typeahead:

```php
public function scopeSearch(Builder $query, ?string $term): Builder
{
    $term = trim((string) $term);
    if ($term === '') {
        return $query;
    }

    $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';

    return $query->where(fn (Builder $q) => $q
        ->where('name', 'like', $like)
        ->orWhere('email', 'like', $like)
        ->orWhere('company', 'like', $like)
        ->orWhere('phone_normalized', 'like', $like));
}
```

**The escaping of `%` and `_` is not optional** — without it, a search for `100%` matches every row. **The nested closure is not optional either**: without it, the `orWhere` chain escapes the surrounding tier/company filters and the filters stop applying.

**Create file: `api/app/Models/CustomerNote.php`** — `$fillable = ['customer_id', 'user_id', 'author_name', 'body']`, `customer(): BelongsTo`, `author(): BelongsTo(User::class, 'user_id')`. **No update or delete path exists for a note in this story** (see the Edge Cases section).

**Create file: `api/app/Models/CustomerAttachment.php`** — `$fillable = ['customer_id', 'uploaded_by', 'disk', 'path', 'original_name', 'mime_type', 'size_bytes']`, `customer(): BelongsTo`, `uploader(): BelongsTo(User::class, 'uploaded_by')`.

**Create file: `api/database/factories/CustomerFactory.php`** — mirror `api/database/factories/UserFactory.php` lines 13–34 (`@extends Factory<Customer>` docblock, a `definition()` returning the array). Use `fake()->unique()->safeEmail()`, `fake()->company()`, and `fake()->randomElement(CustomerTier::values())`. Add two states: `->withoutEmail()` (email `null`, phone set) and `->trashed()` is provided by `SoftDeletes` — do not hand-roll it.

### 5 — Policy

**Create file: `api/app/Policies/CustomerPolicy.php`** — same shape as `api/app/Policies/TicketPolicy.php` lines 8–19: a plain class, no trait, `User` first argument.

```php
<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\CustomerAttachment;
use App\Models\User;

class CustomerPolicy
{
    public function viewAny(User $user): bool { return true; }

    public function view(User $user, Customer $customer): bool { return true; }

    // "Agent or above" is explicit in the story's acceptance criteria.
    public function create(User $user): bool { return true; }

    public function update(User $user, Customer $customer): bool { return true; }

    // Destructive and bulk actions are supervisor-only — same predicate the
    // ticket team queue uses (User::canSeeTeamQueue, User.php lines 47-50).
    public function delete(User $user, Customer $customer): bool { return $user->canSeeTeamQueue(); }

    public function deleteAny(User $user): bool { return $user->canSeeTeamQueue(); }

    public function updateAny(User $user): bool { return $user->canSeeTeamQueue(); }

    public function addNote(User $user, Customer $customer): bool { return true; }

    public function addAttachment(User $user, Customer $customer): bool { return true; }

    public function deleteAttachment(User $user, CustomerAttachment $attachment): bool
    {
        return $user->canSeeTeamQueue() || $attachment->uploaded_by === $user->id;
    }
}
```

**Laravel 13 auto-discovers this policy** (`App\Models\Customer` → `App\Policies\CustomerPolicy`). Verified: `api/app/Providers/AppServiceProvider.php` lines 13–28 registers no policies and `TicketPolicy` is already discovered this way. **Do not add a `Gate::policy()` call.**

### 6 — Form requests

**Create file: `api/app/Http/Requests/StoreCustomerRequest.php`**

```php
public function rules(): array
{
    return [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['nullable', 'email:rfc', 'max:255',
            Rule::unique('customers', 'email')->whereNull('deleted_at')],
        'phone' => ['nullable', 'string', 'max:32'],
        'company' => ['nullable', 'string', 'max:255'],
        'tier' => ['nullable', Rule::in(CustomerTier::values())],
    ];
}
```

Three additions that carry acceptance criteria, none of which the rule array alone gives you:

- **`prepareForValidation()`** — lower-case and trim `email`, and compute the normalized phone into a **request-only** attribute so the uniqueness check below sees the same value the model will store. **Never accept `phone_normalized` from the client** (it is absent from `$fillable` for the same reason).
- **`withValidator()` / `after()`** — the *"name and at least one contact method"* rule. Add an error on **`email`** with the message **"Add an email address or a phone number."** when both `email` and `phone` are blank. Attaching it to a field (not `_form`) is what makes the frontend able to render it inline via `react-hook-form`'s `setError`.
- **Phone uniqueness** cannot be expressed as a plain `Rule::unique('customers', 'phone')` because the stored column is the display form. Check the normalized value explicitly in the same `after()` hook: `Customer::whereNull('deleted_at')->where('phone_normalized', $normalized)->exists()`.
- **The duplicate response must carry the existing record.** Override `failedValidation()` — or, more simply, resolve the duplicate in `after()` and stash its id on the request, then let a small `422` responder include it. The final payload shape is fixed:

```json
{
  "message": "A customer with this email already exists.",
  "errors": { "email": ["A customer with this email already exists."] },
  "duplicate_customer_id": 12,
  "duplicate_customer_name": "Amelia Chen"
}
```

**`duplicate_customer_id` and `duplicate_customer_name` are contractual** — Frontend Task 5 renders the "Open Amelia Chen" link from them, and the AC that forbids silent duplicates is satisfied by that link, not by the 422 alone.

**Create file: `api/app/Http/Requests/UpdateCustomerRequest.php`** — the same rules with `sometimes` on each field and **`->ignore($this->route('customer'))` on the unique rule**, or saving a customer without changing its email rejects itself. Same `after()` contact-method check, evaluated against the **merged** result (existing value + patch), not the patch alone.

**Create file: `api/app/Http/Requests/IndexCustomerRequest.php`** — validates the query string, so a malformed URL produces a `422` instead of an ugly SQL error:

```php
'q' => ['nullable', 'string', 'max:255'],
'company' => ['nullable', 'array', 'max:50'],
'company.*' => ['string', 'max:255'],
'tier' => ['nullable', 'array', 'max:3'],
'tier.*' => [Rule::in(CustomerTier::values())],
'sort' => ['nullable', Rule::in(['name', 'company', 'open_tickets_count', 'last_contact_at', 'created_at'])],
'dir' => ['nullable', Rule::in(['asc', 'desc'])],
'page' => ['nullable', 'integer', 'min:1'],
'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
```

**The `sort` whitelist is a security control, not ergonomics** — passing a raw query parameter into `orderBy()` is a SQL-injection surface. `open_tickets_count` is sortable only because it is a select alias produced by the scope; keep it in the list so the design's sortable **OPEN** column (export line 77) works the day Story 04 lands.

**Create file: `api/app/Http/Requests/BulkCustomerRequest.php`**

```php
'action' => ['required', Rule::in(['delete', 'set_tier'])],
'ids' => ['required', 'array', 'min:1', 'max:200'],
'ids.*' => ['integer', 'exists:customers,id'],
'tier' => ['required_if:action,set_tier', Rule::in(CustomerTier::values())],
```

The **`max:200`** cap is deliberate: the frontend's "select all" only ever selects the current page (≤100), so anything larger is a malformed or hostile request.

**Create file: `api/app/Http/Requests/StoreCustomerNoteRequest.php`** — `'body' => ['required', 'string', 'max:5000']`.

**Create file: `api/app/Http/Requests/StoreCustomerAttachmentRequest.php`** — the AC's "per system configuration" rule, read from config, with messages that name the actual limit:

```php
public function rules(): array
{
    return [
        'file' => [
            'required', 'file',
            'max:'.config('attachments.max_kb'),
            'mimes:'.implode(',', config('attachments.allowed_extensions')),
        ],
    ];
}

public function messages(): array
{
    $mb = round(config('attachments.max_kb') / 1024, 1);

    return [
        'file.max' => "That file is too large. The limit is {$mb} MB.",
        'file.mimes' => 'That file type is not accepted. Allowed types: '
            .strtoupper(implode(', ', config('attachments.allowed_extensions'))).'.',
        'file.required' => 'Choose a file to attach.',
    ];
}
```

**Both messages are acceptance criteria** — the AC demands "a specific, actionable error (not raw stack trace / raw provider error)". A `422` with Laravel's default *"The file must not be greater than 10240 kilobytes"* is neither specific nor in the user's units.

### 7 — Resources

**Create file: `api/app/Http/Resources/CustomerResource.php`** — implements contract **C4** exactly. Follow the `UserResource` style (lines 10–21): a flat array, `->value` plus `_label` for the enum.

```php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'name' => $this->name,
        'email' => $this->email,
        'phone' => $this->phone,
        'company' => $this->company,
        'tier' => $this->tier->value,
        'tier_label' => $this->tier->label(),
        'initials' => $this->initials(),
        'open_tickets_count' => (int) ($this->open_tickets_count ?? 0),
        'last_contact_at' => $this->last_contact_at,
        'created_at' => $this->created_at,
        'updated_at' => $this->updated_at,
    ];
}
```

**Never add `phone_normalized`, `created_by`, or `deleted_at`** — the same reasoning as `TicketResource` withholding the assignee's email (`TicketResource.php` lines 17–20, and the assertion at `tests/Feature/TicketScopeTest.php` lines 59–64).

**Create file: `api/app/Http/Resources/CustomerNoteResource.php`** — `id`, `body`, `author` → `{ id, name }` (falling back to the `author_name` snapshot when `user_id` is null), `created_at`. **No author email.**

**Create file: `api/app/Http/Resources/CustomerAttachmentResource.php`** — `id`, `original_name`, `mime_type`, `size_bytes`, `size_label` (a human string, e.g. `"2.4 MB"`), `uploaded_by` → `{ id, name }`, `created_at`, and `download_url` = `route('customers.attachments.download', [...])`. **Never expose `path` or `disk`** — a storage path is an invitation to probe the filesystem.

### 8 — Controllers

**Create file: `api/app/Http/Controllers/CustomerController.php`** — five actions, matching `TicketController.php` lines 15–22 in shape (`use AuthorizesRequests`, authorize first, return a typed resource).

```php
public function index(IndexCustomerRequest $request): AnonymousResourceCollection
{
    $this->authorize('viewAny', Customer::class);

    $customers = Customer::query()
        ->withOpenTicketCount()
        ->search($request->query('q'))
        ->when($request->query('company'), fn ($q, $c) => $q->whereIn('company', (array) $c))
        ->when($request->query('tier'), fn ($q, $t) => $q->whereIn('tier', (array) $t))
        ->orderBy($request->query('sort', 'name'), $request->query('dir', 'asc'))
        ->paginate(min((int) $request->query('per_page', 25), 100))
        ->withQueryString();

    return CustomerResource::collection($customers);
}
```

- **`->withQueryString()` is required.** Without it the pagination `links` drop every filter, and page 2 of a filtered view silently shows unfiltered rows.
- **`orderBy` receives whitelisted values only** — `IndexCustomerRequest` guarantees it. Add a secondary `->orderBy('id')` so rows with equal sort keys keep a stable order across pages; without it, a customer can appear on both page 1 and page 2.
- The response envelope is Laravel's standard paginated resource collection: **`data`, `links`, `meta`** — same as `GET /api/tickets`. `meta.total`, `meta.current_page`, `meta.per_page`, and `meta.last_page` are what the frontend footer renders.

`facets(IndexCustomerRequest $request)` — the faceted-filter source. **Apply every filter *except* the one being faceted**, which is what makes a facet list usable (otherwise selecting Company: Acme leaves Acme as the only company you can ever pick):

```json
{
  "companies": [{ "value": "Northwind Retail", "count": 42 }],
  "tiers": [{ "value": "enterprise", "label": "Enterprise", "count": 61 }],
  "total": 248
}
```

Companies: `select company, count(*) … whereNotNull('company') … groupBy('company') … orderBy('company')`, capped at **50** entries with the rest folded into nothing (the search box covers the tail). Tiers: **always all three**, with `count: 0` where applicable — a facet that disappears when its count hits zero cannot be un-selected.

`show`, `store`, `update`, `destroy` are conventional. Three specifics:

- `store` sets `created_by = $request->user()->id` **server-side**; the field is not client-writable.
- `store` returns **`201`** with the `CustomerResource`.
- `destroy` calls `$customer->delete()` (soft) and returns **`204`**.

**Create file: `api/app/Http/Controllers/CustomerBulkController.php`** — one `__invoke(BulkCustomerRequest $request)`:

```php
$ids = $request->validated('ids');

if ($request->validated('action') === 'delete') {
    $this->authorize('deleteAny', Customer::class);
    $affected = Customer::whereIn('id', $ids)->delete();
} else {
    $this->authorize('updateAny', Customer::class);
    $affected = Customer::whereIn('id', $ids)->update(['tier' => $request->validated('tier')]);
}

return response()->json(['action' => $request->validated('action'), 'affected' => $affected]);
```

**`affected` is contractual** — the frontend's success toast reads *"3 customers deleted"* from it, not from the length of the id array it sent. A record deleted by someone else between selection and submission must not be counted.

**Create file: `api/app/Http/Controllers/CustomerNoteController.php`** — `index` returns `CustomerNoteResource::collection($customer->notes()->latest()->paginate(20))`; `store` writes `user_id` **and** the `author_name` snapshot from `$request->user()`, returns `201`. **Note bodies are stored raw and rendered as text, never as HTML** (Frontend Task 8).

**Create file: `api/app/Http/Controllers/CustomerAttachmentController.php`** — `index`, `store`, `download`, `destroy`.

```php
public function store(StoreCustomerAttachmentRequest $request, Customer $customer)
{
    $this->authorize('addAttachment', $customer);

    $file = $request->file('file');
    $disk = config('attachments.disk');
    // Laravel generates a random filename; the original name is stored in the
    // DB column, never used as the on-disk path. A user-controlled filename on
    // disk is a traversal and an overwrite waiting to happen.
    $path = $file->store("customer-attachments/{$customer->id}", $disk);

    $attachment = $customer->attachments()->create([
        'uploaded_by' => $request->user()->id,
        'disk' => $disk,
        'path' => $path,
        'original_name' => $file->getClientOriginalName(),
        'mime_type' => $file->getClientMimeType(),
        'size_bytes' => $file->getSize(),
    ]);

    return (new CustomerAttachmentResource($attachment))->response()->setStatusCode(201);
}
```

`download` must **verify the attachment belongs to the route's customer** before streaming (`abort_unless($attachment->customer_id === $customer->id, 404)`), then `Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name)`. Without that check, any authenticated user can read any attachment by pairing a customer they may see with an id they may not. `destroy` deletes the row **and** the file, in that order, and tolerates a missing file (`Storage::delete` returns `false`, it does not throw).

**Interaction history — the Story 04 seam.** Add `tickets()` to `CustomerController`:

```php
public function tickets(Request $request, Customer $customer): JsonResponse|AnonymousResourceCollection
{
    $this->authorize('view', $customer);

    // Derived LIVE from the Ticket entity — never a denormalized copy on the
    // customers table. The Ticket Management story (WIS-2) adds
    // tickets.customer_id; until then this returns an empty page and says so.
    if (! Schema::hasColumn('tickets', 'customer_id')) {
        return response()->json([
            'data' => [],
            'meta' => ['total' => 0, 'current_page' => 1, 'last_page' => 1, 'per_page' => 20, 'pending_story' => 'WIS-2'],
        ]);
    }

    return TicketResource::collection(
        Ticket::where('customer_id', $customer->id)->latest()->paginate(20)
    );
}
```

- It reuses the **existing** `TicketResource` (`api/app/Http/Resources/TicketResource.php` lines 10–24). **Do not write a second ticket resource.**
- **`meta.pending_story`** is what the frontend keys its "Ticket history appears once Ticket Management ships" notice on — it does **not** show the generic empty state, which would wrongly claim the customer has never raised a ticket.
- **This endpoint is not scoped by `Ticket::visibleTo()`** (`api/app/Models/Ticket.php` lines 26–32) deliberately: a customer profile shows *that customer's* whole history, which is the AC. If Story 04 decides an Agent must not see a colleague's ticket here, that is Story 04's call to make on this endpoint — **flag it, do not pre-empt it.**

**File: `api/routes/api.php`** — add inside the existing `auth:sanctum` group (after line 17), in **this order**:

```php
Route::get('/customers/facets', [CustomerController::class, 'facets']);
Route::post('/customers/bulk', CustomerBulkController::class);
Route::apiResource('customers', CustomerController::class)->except(['destroy']);
Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
Route::get('/customers/{customer}/tickets', [CustomerController::class, 'tickets']);
Route::get('/customers/{customer}/notes', [CustomerNoteController::class, 'index']);
Route::post('/customers/{customer}/notes', [CustomerNoteController::class, 'store']);
Route::get('/customers/{customer}/attachments', [CustomerAttachmentController::class, 'index']);
Route::post('/customers/{customer}/attachments', [CustomerAttachmentController::class, 'store']);
Route::get('/customers/{customer}/attachments/{attachment}', [CustomerAttachmentController::class, 'download'])
    ->name('customers.attachments.download');
Route::delete('/customers/{customer}/attachments/{attachment}', [CustomerAttachmentController::class, 'destroy']);
```

**`facets` and `bulk` must precede the resource routes** or `{customer}` swallows them. Verify with `php artisan route:list --path=customers` — `facets` must appear above `customers/{customer}`.

### 9 — Seeder

**File: `api/database/seeders/DatabaseSeeder.php`** — append after the existing ticket block (which ends at line 88). **Do not restructure the user or ticket seeding above it.** Seed the **eight customers from the design export** so a running app matches the reference screenshot, with the tiers and last-contact dates from `WisalCustomers-LightLTR.dc.html` lines 84–120:

| Name | Email | Company | Tier | `last_contact_at` |
|---|---|---|---|---|
| Amelia Chen | amelia.chen@northwind.io | Northwind Retail | enterprise | 2026-08-22 |
| Marcus Webb | marcus.webb@vertex.com | Vertex Solutions | standard | 2026-08-22 |
| Priya Nair | priya.nair@cloudscape.dev | Cloudscape Inc. | enterprise | 2026-08-21 |
| Daniel Osei | d.osei@brightpath.org | BrightPath Foundation | standard | 2026-08-20 |
| Laura Kim | laura.kim@stackforge.io | StackForge | premium | 2026-08-18 |
| Nina Fischer | nina.fischer@globex.eu | Globex Europe | enterprise | 2026-08-15 |
| Omar Haddad | omar.h@medisync.sa | MediSync | standard | 2026-08-14 |
| Grace Lin | grace.lin@paperlane.co | Paperlane Co. | premium | 2026-08-12 |

Then add **`Customer::factory()->count(40)->create()`** so pagination is genuinely exercised (three pages at the default 25). Seed **one customer with a phone and no email** and **one with an email and no phone**, to prove the "at least one contact method" path both ways.

---

## Frontend Tasks

Directory layout after this story (all new):

```
web/src/
  components/data-table/          ← SHARED (Story 09 consumes this unchanged)
    DataTable.tsx                 the grid, header, rows, selection, sort
    DataTableSkeleton.tsx         the 6-row loading state
    DataTableEmpty.tsx            the empty state
    DataTableError.tsx            the error state
    Pagination.tsx                the footer
    ColumnMenu.tsx                visibility toggles + reorder
    BulkActionBar.tsx
    types.ts                      ColumnDef<T> and friends
    index.ts
  components/ui/
    Modal.tsx                     focus trap, Escape, scroll lock, backdrop
    ConfirmDialog.tsx             the destructive-confirm pattern
    index.ts
  features/customers/
    api/customersApi.ts           every HTTP call, one place
    api/queryKeys.ts
    model/customer.ts             the Customer type (mirrors CustomerResource)
    model/customerSchema.ts       Zod — the single source of the form type
    model/columns.tsx             the seven ColumnDefs
    hooks/useCustomerListParams.ts   URL search params <-> typed query args
    hooks/useCustomers.ts
    hooks/useCustomerFacets.ts
    hooks/useCustomer.ts
    hooks/useCustomerTickets.ts
    hooks/useCustomerNotes.ts
    hooks/useCustomerAttachments.ts
    hooks/useCustomerMutations.ts
    hooks/useColumnPreferences.ts
    hooks/useCustomerSearch.ts       exported for Story 04
    components/CustomerFormModal.tsx
    components/CustomerTierBadge.tsx
    components/CustomerAvatar.tsx
    components/FacetFilter.tsx
    components/InteractionHistory.tsx
    components/NotesPanel.tsx
    components/AttachmentsPanel.tsx
    pages/CustomersPage.tsx
    pages/CustomerProfilePage.tsx
    index.ts                      the ONLY public surface
```

### 1 — Types, schema, and the API module

**Create file: `web/src/features/customers/model/customer.ts`** — the TypeScript mirror of contract **C4**. Every optional field is `string | null`, **not** `string | undefined`, because JSON `null` is what the API sends:

```ts
export type CustomerTier = 'standard' | 'premium' | 'enterprise';

export type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tier: CustomerTier;
  tier_label: string;
  initials: string;
  open_tickets_count: number;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; pending_story?: string };
};
```

**Create file: `web/src/features/customers/model/customerSchema.ts`** — the single source for the form type and its validation, following `web/src/features/auth/loginSchema.ts` lines 3–8:

```ts
import { z } from 'zod';

export const customerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Enter a valid email address').max(255).or(z.literal('')),
    phone: z.string().max(32).or(z.literal('')),
    company: z.string().max(255).or(z.literal('')),
    tier: z.enum(['standard', 'premium', 'enterprise']),
  })
  .refine((v) => v.email.trim() !== '' || v.phone.trim() !== '', {
    message: 'Add an email address or a phone number.',
    path: ['email'],
  });

export type CustomerFormValues = z.infer<typeof customerSchema>;
```

- **`.or(z.literal(''))` matters.** An untouched optional input is `''`, not `undefined`; a bare `.optional()` would reject it.
- **The `path: ['email']` on the refine** is what puts the cross-field error under the Email input instead of at the form root — the same field the backend attaches its copy of this error to, so client and server render identically.
- **Send `null`, not `''`, to the API.** Convert in `customersApi`, in one place — an empty-string email would be stored as `''` and collide with every other blank email on the unique index.

**Create file: `web/src/features/customers/api/customersApi.ts`** — every HTTP call, importing the shared `api` from `../../../lib/api` (**never `axios` directly**). Functions: `listCustomers(params)`, `getFacets(params)`, `getCustomer(id)`, `createCustomer(values)`, `updateCustomer(id, values)`, `deleteCustomer(id)`, `bulkAction(payload)`, `listCustomerTickets(id, page)`, `listNotes(id)`, `createNote(id, body)`, `listAttachments(id)`, `uploadAttachment(id, file)`, `deleteAttachment(id, attachmentId)`.

- `listCustomers` serialises array filters as **`company[]=A&company[]=B`** — Laravel's `array` rule reads that form. `axios`'s default serialiser already produces it; **do not** join them with commas.
- `uploadAttachment` builds a `FormData` and lets Axios set the boundary. **Do not set `Content-Type` manually** — a hand-set `multipart/form-data` without the boundary is the single most common upload failure.

**Create file: `web/src/features/customers/api/queryKeys.ts`** — one factory so every invalidation targets the same prefix:

```ts
export const customerKeys = {
  all: ['customers'] as const,
  list: (params: Record<string, unknown>) => ['customers', 'list', params] as const,
  facets: (params: Record<string, unknown>) => ['customers', 'facets', params] as const,
  detail: (id: number) => ['customers', 'detail', id] as const,
  tickets: (id: number, page: number) => ['customers', 'tickets', id, page] as const,
  notes: (id: number) => ['customers', 'notes', id] as const,
  attachments: (id: number) => ['customers', 'attachments', id] as const,
};
```

Mutations invalidate `customerKeys.all` — the list, the facets, and the detail all shift when a customer changes, and three separate invalidations is three chances to forget one.

### 2 — The shared DataTable

**Create file: `web/src/components/data-table/types.ts`** — the props Story 09 will code against. **Freeze these names.**

```ts
export type ColumnDef<T> = {
  id: string;                       // stable key; also the localStorage identity
  header: string;                   // e.g. 'CUSTOMER'
  width: string;                    // a grid track: '2fr' | '90px'
  sortKey?: string;                 // omit => not sortable (EMAIL and TIER omit it)
  align?: 'start' | 'end';
  cell: (row: T) => React.ReactNode;
  /** Never hidden by the column menu — the identity column. */
  locked?: boolean;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: ColumnDef<T>[];          // already ordered and filtered by the caller
  getRowId: (row: T) => number;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  sort: { key: string; dir: 'asc' | 'desc' } | null;
  onSortChange: (key: string) => void;
  onRowActivate?: (row: T) => void; // row click / Enter => navigate
  caption: string;                  // screen-reader table caption
};
```

**Create file: `web/src/components/data-table/DataTable.tsx`** — build from `WisalCustomers-LightLTR.dc.html` lines 71–122, closing the accessibility gap the export leaves wide open (**it renders every row as a `<div>` with no roles, no checkboxes, no focus states**).

Structure and the rules that make it correct:

- **A real `<table>` is not used**; the design's `grid-template-columns` layout with reorderable columns is far simpler as CSS grid. Therefore the semantics must be supplied by hand: a wrapper with `role="table"` and `aria-label={caption}`, a header `role="row"` of `role="columnheader"` cells, and body rows with `role="row"` / `role="cell"`. **A grid with no roles is invisible to a screen reader — this is not optional polish.**
- **One `grid-template-columns` value**, composed from `columns.map(c => c.width).join(' ')` with the leading `32px` select track prepended, set as an inline style on the header and every row. This is the single definition contract that makes RTL free (see Task 4).
- **Sortable headers are `<button>`s** inside the `columnheader`, carrying **`aria-sort="ascending" | "descending" | "none"`** on the header cell. The chevron glyph is `M7 9l3-3 3 3 M7 15l3 3 3-3` (export line 74), stroke `var(--table-sort-idle)`; the active direction renders the single-direction chevron in `var(--text-main)`. **Colour alone must not indicate sort direction** (`brief.md` line 196) — the glyph changes shape, and `aria-sort` carries it for assistive tech.
- **Selection.** The header's select cell holds a tri-state checkbox: checked when every row on the page is selected, **`indeterminate`** when some are. `indeterminate` is a DOM property, not an attribute — set it via a ref in an effect, or it silently does nothing. Each row checkbox has `aria-label={`Select ${row-label}`}`. **Selection is page-scoped**; leaving the page clears it (see Edge Cases).
- **Row activation.** The row is not a link (a `<div role="row">` cannot wrap an `<a>` across cells legally), so activation is `onClick` plus `onKeyDown` for `Enter`, with `tabIndex={0}` on the row and a visible `:focus-visible` ring. **Clicking the checkbox must call `stopPropagation()`** or selecting a row also navigates away from the page.
- **Zebra + selected fills are separate.** Even rows `background: var(--table-row-alt)`; selected rows `background: var(--table-row-selected)`. In light both happen to be `#F8FAFC` (export lines 87, 97); **in dark they differ** — `#202128` vs `rgba(129,140,248,0.12)` (DarkLTR lines 102 and 87). Collapsing them makes selection invisible in dark mode.

**Create file: `web/src/components/data-table/DataTableSkeleton.tsx`** — port `WisalCustomers-LoadingState.dc.html` lines 90–97 exactly: **real header labels, no sort chevrons**, six rows, `padding:12px 14px`, bar widths `140/100/20/70` px and a `60×18` tier pill. Props: `columns` and `rows = 6`. The `.sk` rule (loading export lines 15–20) goes into `web/src/index.css` **including its `prefers-reduced-motion` branch**.

**Create file: `web/src/components/data-table/DataTableEmpty.tsx`** — port the empty export lines 78–88. Props: `title`, `body`, and up to two actions. **`body` is passed in by the caller** so it can name the active filters (Frontend Task 4).

**Create file: `web/src/components/data-table/DataTableError.tsx`** — not in any export; build it from the empty state's geometry with the `danger` token, a message, and a **Try again** button wired to the query's `refetch`. `brief.md` line 185: *"Error (actionable, retryable, no raw stack trace)"* — render `error.response?.data?.message` when the API supplied one, and the fixed string **"Something went wrong loading customers."** otherwise. **Never render `error.message` or a stack.**

**Create file: `web/src/components/data-table/Pagination.tsx`** — export lines 123–134. `Showing {from}–{to} of {total}` plus first/prev/numbered/next controls; the window is `1 … current-1 current current+1 … last` with `…` separators (line 130). Rules:
- The numeric summary wraps its numbers in `<span dir="ltr">` — under RTL, `1–8` otherwise renders reversed (the RTL export does exactly this at line 136).
- The prev/next chevrons are **directional icons**: they must mirror under RTL (`brief.md` line 202). Use a CSS `transform: scaleX(-1)` under `[dir='rtl']`, or swap the path — **do not** leave them pointing the wrong way.
- The current page button carries **`aria-current="page"`**; disabled ends are genuinely `disabled`, not just greyed.

**Create file: `web/src/components/data-table/ColumnMenu.tsx`** — a popover listing every column with a checkbox, plus **Move up / Move down** buttons per row. Two decisions:
- **Buttons, not drag-and-drop.** Drag reorder needs a pointer, fails keyboard and touch, and needs a library this project does not have (`web/package.json` has no DnD dependency). Up/Down buttons satisfy "reorder" for every input method. Each button is labelled `Move ${header} earlier` / `Move ${header} later`, and the change is announced through an `aria-live="polite"` region.
- **The locked column cannot be hidden.** `CUSTOMER` is `locked: true`; its checkbox is `disabled` with `title="The customer name is always shown"`. A table with every column hidden is a bug the user can inflict on themselves in two clicks.

**Create file: `web/src/components/data-table/BulkActionBar.tsx`** — DarkLTR export lines 66–74. Props: `count`, `actions: { id, label, icon, tone?: 'danger', disabled?, title? }[]`, `onClear`. Rules:
- **Renders only when `count > 0`**, and when it appears it **must not push the table down abruptly** — it replaces the facet-chip row's slot rather than inserting above it (compare LightLTR line 66 with DarkLTR line 66: the bar occupies the same position the chips do).
- **`aria-live="polite"`** on the `{count} selected` text, so a screen-reader user hears the count change.
- The **Export** action ships `disabled` with `title="Coming soon"` per the Product-rules table, and carries a comment naming it as deliberately inert.

### 3 — Tokens and CSS

**File: `web/src/index.css`** — add the table tokens to **all four** blocks (bare `:root` lines 20–47, the `prefers-color-scheme` block lines 49–75, `[data-theme="dark"]` lines 77–100, `[data-theme="light"]` lines 102–125), in the same order the existing tokens appear.

```css
/* Data table — WisalCustomers-*.dc.html (docs/design/references/4.Data Table) */
--table-header-fg: #94A3B8;        /* LightLTR line 72 */
--table-row-border: #F1F5F9;       /* LightLTR line 82 */
--table-row-alt: #F8FAFC;          /* LightLTR line 87 — zebra */
--table-row-selected: #F8FAFC;     /* LightLTR line 87 — selected */
--table-sort-idle: #CBD5E1;        /* LightLTR line 74 */
--table-checkbox-border: #CBD5E1;  /* LightLTR line 83 */
--bulk-bar-bg: #EEF2FF;            /* LightRTL line 66 */
--bulk-bar-border: #C7D2FE;
--bulk-bar-fg: #4F46E5;
--tier-standard-bg: #F1F5F9;  --tier-standard-fg: #64748B;   /* LightLTR line 90 */
--tier-premium-bg:  #FFFBEB;  --tier-premium-fg:  #B45309;   /* LightLTR line 105 — badge_text_on_tint */
--tier-enterprise-bg: #EEF2FF; --tier-enterprise-fg: #4F46E5; /* LightLTR line 85 */
--skeleton-bg: #E2E8F0;            /* LoadingState line 16 */
```

Dark values (from `WisalCustomers-DarkLTR.dc.html`): `--table-header-fg: #64748B` (line 77), `--table-row-border: #2A2C33` (line 87), **`--table-row-alt: #202128`** (line 102), **`--table-row-selected: rgba(129,140,248,0.12)`** (line 87), `--table-sort-idle: #3F4148` (line 123), `--table-checkbox-border: #3F4148` (line 82), `--bulk-bar-bg: rgba(129,140,248,0.12)`, `--bulk-bar-border: rgba(129,140,248,0.35)`, `--bulk-bar-fg: #A5B4FC` (lines 66–67), `--tier-premium-bg: rgba(251,191,36,0.14)` / `--tier-premium-fg: #FBBF24` (line 125), `--tier-enterprise-bg: rgba(129,140,248,0.14)` / `--tier-enterprise-fg: #A5B4FC`, `--tier-standard-bg: #2A2C33` / `--tier-standard-fg: #94A3B8`, `--skeleton-bg: #2A2C33`.

**The premium and danger badge foregrounds in light mode are `#B45309` and `#B91C1C`, not `#D97706` / `#DC2626`.** `docs/design/brief.md` lines 108–110 (`badge_text_on_tint`) records that the general values measure **3.07:1** and **4.42:1** as badge text on their tints and fail AA. Using the general token here is a silent accessibility regression that looks identical at a glance.

All table CSS uses **logical properties** — `padding-inline`, `border-inline-end`, `inset-inline-start`, `text-align: start`, `justify-self: end`. **No `margin-left`, `padding-right`, or `text-align: left` anywhere in this story's CSS.**

### 4 — URL state and the list query

**Create file: `web/src/features/customers/hooks/useCustomerListParams.ts`** — the one adapter between the URL and typed query arguments. **This hook is the only place `useSearchParams` is read for the list.**

```ts
export type CustomerListParams = {
  q: string;
  company: string[];
  tier: CustomerTier[];
  sort: string;          // default 'name'
  dir: 'asc' | 'desc';   // default 'asc'
  page: number;          // default 1
  per_page: number;      // default 25
};
```

Rules that are each a bug if broken:

- **Defaults are never written to the URL.** `/customers` must stay clean until the user filters; only non-default values are serialised. Otherwise the first render rewrites the URL and adds a history entry before the user has done anything.
- **Every mutation of a filter resets `page` to 1.** Filtering while on page 7 of an unfiltered list otherwise lands on an empty page and looks like a data loss bug.
- **`setParams` uses `replace: true` for typing in the search box** (debounced 300 ms) and `replace: false` for a deliberate filter/page change. Pushing a history entry per keystroke makes Back unusable.
- **`sort` is validated against the same whitelist the backend uses**, and an unknown value falls back to `name`. A hand-edited URL must not produce a 422 the user cannot escape.
- The hook returns `[params, setParams, isFiltered]`, where `isFiltered` is true when `q`, `company`, or `tier` is non-empty — the empty state and the **Reset filters** button both key off it.

**Create file: `web/src/features/customers/hooks/useCustomers.ts`**

```ts
export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => listCustomers(params),
    placeholderData: keepPreviousData,
  });
}
```

**`placeholderData: keepPreviousData`** (TanStack Query v5 — the v4 `keepPreviousData: true` flag is gone) is what stops the table flashing its skeleton on every page change. Pair it with the query's `isPlaceholderData` to dim the table at 60% opacity while a page is in flight, so the UI still signals that something is loading.

**Create file: `web/src/features/customers/hooks/useCustomerFacets.ts`** — same params, `customerKeys.facets`, its own `staleTime` of 60 s. **The facet request is a second round trip and must not block the table**: render the chips in their own skeleton (loading export lines 85–88) while it resolves.

### 5 — The Customers page

**Create file: `web/src/features/customers/pages/CustomersPage.tsx`** — from `WisalCustomers-LightLTR.dc.html` lines 63–135.

Layout, top to bottom: title block → facet row **or** bulk bar → table card → pagination footer. `display: flex; flex-direction: column; gap: 16px` (export line 63) and **no page padding** — `.shell-main` already supplies it (index.css lines 419–420).

- **Title block** (export line 64) — `<h1>Customers</h1>` at `22px/700` and a subtitle reading **`{meta.total} customers`**. The count comes from the *server's* `meta.total` for the current filter, never from `rows.length`. During loading, skeleton **only** the count and keep the real `Customers` heading (loading export line 84) — a skeletoned `<h1>` breaks the page's heading outline for a screen reader.
- **Actions**: an **Add Customer** primary button sits at the inline end of the title row. (The export shows it only in the empty state at line 85; a list with rows still needs a create affordance, and the empty state's own button must open the same modal.)
- **Facet row** (export lines 66–69) — one `FacetFilter` per facet. Each chip is a `<button aria-expanded aria-haspopup="listbox">` opening a checkbox list; the label reads `Company: All` with nothing selected, `Company: Northwind Retail` with one, and `Company: 3 selected` with more. Each option shows its server count.
- **The four states, in this order:**
  1. `isLoading` → `DataTableSkeleton`.
  2. `isError` → `DataTableError` with a **Try again** wired to `refetch`.
  3. `data.data.length === 0` → `DataTableEmpty`. **The body text names the active filters**, exactly as the export does at line 82. Build it from `params`: with filters, *"No customers match {Company: Vertex Retail · Tier: Enterprise}. Try a different filter or clear them."*; with **no** filters, a different copy — *"No customers yet. Add your first customer to start tracking their tickets."* — and **only the "Add Customer" button**, because "Reset filters" with nothing to reset is a dead control.
  4. Otherwise the table.
- **Bulk bar** — replaces the facet row while `selectedIds.length > 0`. Actions: **Delete** (`tone: 'danger'`) and **Tag** (a tier submenu) for `canSeeTeamQueue()` roles; **Export** disabled. **For an Agent, render the bar with the count and the close button but no destructive actions** — hiding the whole bar would make selection look broken, and the server is the real gate anyway (the same reasoning as the comment at `navItems.tsx` lines 102–104).
- **Every bulk action routes through `ConfirmDialog`** — never fires directly. The dialog title names **both the count and the action**: *"Delete 3 customers?"* / *"Set tier to Enterprise for 3 customers?"*, with the singular form when the count is 1. That is the acceptance criterion, word for word.
- **Row activation navigates** to `/customers/{id}`.

### 6 — Column preferences

**Create file: `web/src/features/customers/hooks/useColumnPreferences.ts`**

```ts
type ColumnPrefs = { order: string[]; hidden: string[] };
// key: `wisal-customers-columns:${userId}`
```

- **Read once on mount inside `useState`'s initialiser**, wrapped in `try/catch` — the same defensive shape as the extracted `getInitialTheme` in `UiPreferencesContext`. A hardened browser throws on read, and an uncaught throw here blanks the whole page.
- **Write only inside the toggle/reorder callbacks. Never in a `useEffect` on mount.** Story 02 established this rule and its provider test asserts `localStorage.length === 0` for the untouched case; a mount-write here is the same defect in a new file.
- **Reconcile against the live column list on read.** An id in storage that no longer exists is dropped; a column added by a later release that is absent from storage is appended in its declared position. Without this, adding a column in Story 09's shared-table work makes it invisible to every returning user — a bug that only appears for people who once opened the menu.
- **Storage is a preference, not state.** The rendered order is derived: `columns` filtered by `hidden` and sorted by `order`, computed in a `useMemo` in `CustomersPage`, then handed to `DataTable` already ordered (per `DataTableProps`).

**Create file: `web/src/features/customers/model/columns.tsx`** — the seven `ColumnDef<Customer>`s, in the export's order, with the export's exact track widths (line 72):

| id | header | width | sortKey | cell |
|---|---|---|---|---|
| `name` | `CUSTOMER` | `2fr` | `name` | `<CustomerAvatar>` (28px initials circle) + `customer.name` |
| `email` | `EMAIL` | `1.6fr` | — | `customer.email ?? '—'`, `color: var(--text-muted)` |
| `company` | `COMPANY` | `1fr` | `company` | `customer.company ?? '—'` |
| `open` | `OPEN` | `90px` | `open_tickets_count` | the number at `font-weight:600`, `color: var(--text-main)` |
| `last_contact` | `LAST CONTACT` | `110px` | `last_contact_at` | `Aug 22, 2026` via `Intl.DateTimeFormat`, or `—` |
| `tier` | `TIER` | `100px` | — | `<CustomerTierBadge>` |

`name` is **`locked: true`**. The select column's `32px` track is owned by `DataTable` and is not a `ColumnDef` — it can be neither hidden nor reordered.

- **Dates use `Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })`, never a hand-rolled month array.** Story 15 switches the locale; a hard-coded `['Jan','Feb',…]` cannot follow it.
- **Never render a raw ISO timestamp**, and never `new Date(x).toLocaleDateString()` without an explicit options object — its default varies by browser.
- **`CustomerAvatar`** takes `initials` straight from the resource (contract C4). **Do not compute initials in the frontend** — two implementations of the same rule drift, and the server's is already the one used elsewhere.

### 7 — The create/edit modal

**Create file: `web/src/components/ui/Modal.tsx`** — the project's first modal, so it carries the whole pattern: rendered in a portal to `document.body`, `role="dialog" aria-modal="true"` with `aria-labelledby` pointing at the title, focus moved to the first field on open and **returned to the trigger on close**, focus trapped inside while open, closes on **Escape** and backdrop click, body scroll locked while open and **released on unmount**.

**Do not use the native `<dialog>` element.** Story 02 rejected it for the drawer for the same reason: its top-layer rendering fights the token palette and its default backdrop is not themeable, for no gain the portal does not already provide.

The **scroll-lock release on unmount** is the specific failure worth naming: a modal closed by a route change (clicking a link inside it) unmounts without running an `onClose` path, and a lock set outside a cleanup leaves the page permanently unscrollable.

**Create file: `web/src/features/customers/components/CustomerFormModal.tsx`** — from `WisalModals-LightLTR.dc.html` lines 109–136. One component for both create and edit, keyed by an optional `customer` prop.

- `react-hook-form` + `zodResolver(customerSchema)`, matching `LoginPage`'s usage of the same pair.
- Fields in the design's order: **Name · Email · Company · Phone · Tier**. Tier is the three-button segmented control (modal lines 121–125) implemented as a **`radiogroup`** — three `<button role="radio" aria-checked>` in a `role="radiogroup" aria-label="Tier"`, arrow-key navigable. Three plain buttons where only one is styled-as-selected is invisible to assistive tech.
- **Edit mode only**: the read-only **"Customer since"** row (modal line 127) rendering `created_at`, and the **Delete Customer** button on the footer's inline start (line 130) which opens `ConfirmDialog`.
- **Server-error mapping is the duplicate AC.** On a `422`, walk `error.response.data.errors` and call `setError(field, { message })` for each. When the payload carries **`duplicate_customer_id`**, render the message plus a **"Open {duplicate_customer_name}"** link to `/customers/{duplicate_customer_id}` directly beneath the field. **This link is the acceptance criterion** — a bare "already exists" message leaves the agent with no way to find the record they should have used.
- The submit button is disabled while `isPending` and shows a busy label, mirroring `LoginPage`'s submit behaviour.
- **On success**: close, invalidate `customerKeys.all`, and show a confirmation. **Do not optimistically insert the new row** — it would land in a sort/filter position the server may not agree with, and would appear on a page it does not belong to.

**Create file: `web/src/components/ui/ConfirmDialog.tsx`** — from modal export lines 139–150. Props `{ title, body, confirmLabel, tone, onConfirm, onCancel, isPending }`. **The title must name the specific record or the exact count** (`brief.md` line 186). Focus lands on **Cancel**, not Confirm — a destructive default that catches a stray Enter is a footgun. The confirm button uses the `danger` token and shows a busy state while the mutation runs.

### 8 — The customer profile

**Create file: `web/src/features/customers/pages/CustomerProfilePage.tsx`** — route `/customers/:customerId`. **There is no design export for this screen**; compose it from patterns that do exist — the modal's field styling (lines 109–128) for the details card, the table card's `background/border/radius` (LightLTR line 71) for each panel, and the empty-state geometry (empty export lines 78–88) for each panel's empty case.

Layout: a header row (avatar, name, company, tier badge, **Edit** button, **Back to customers** link), then a two-column grid at ≥1024px collapsing to one column below — reuse `--shell-breakpoint` from `index.css` line 46; **do not introduce a second breakpoint value**. Left column: **Interaction history**. Right column: **Contact details**, **Notes**, **Attachments**.

- **Interaction history** (`InteractionHistory.tsx`) — `useCustomerTickets`. Most recent first (the endpoint's `latest()` guarantees it). Each row: subject, status, priority, created date, linking to `/tickets/{id}` — a route Story 04 owns, so **render the link but expect it to fall through to the `*` redirect at `App.tsx` line 68 until Story 04 lands**; do not disable it. When `meta.pending_story === 'WIS-2'`, render the **pending** notice — *"Ticket history appears here once Ticket Management ships."* — **not** the generic empty state, which would falsely assert the customer has raised no tickets.
- **Notes** (`NotesPanel.tsx`) — a textarea plus **Add note**, then the list, newest first, each showing the author's name and a relative-then-absolute timestamp. **Render the body as text** (`{note.body}` in JSX, which escapes it), **never `dangerouslySetInnerHTML`**. Preserve newlines with `white-space: pre-wrap`. Notes are append-only in this story: no edit, no delete.
- **Attachments** (`AttachmentsPanel.tsx`) — the dropzone from modal export lines 97–101 (`border:2px dashed`, "Drag files here or click to browse"), a real `<input type="file">` visually hidden but focusable behind a `<label>` (**not `display:none`**, which removes it from the tab order), and drag-and-drop with `dragover`/`drop` handlers that call `preventDefault()` — without it the browser navigates away to the dropped file.
  - **Validate client-side before uploading**, against the same limits: extension and size. A 10 MB upload that the server rejects wastes the user's time twice. **The server rule stays authoritative** — the client check is a courtesy, not the enforcement.
  - **Render the server's `422` message verbatim** — it is already written to be actionable (Backend Task 6). Do not replace it with a generic one.
  - Each attachment row: name, `size_label`, uploader, date, a **Download** link to `download_url` (which carries the Bearer token via the shared Axios instance — fetch it as a blob and trigger the save, since a plain `<a href>` sends no Authorization header), and a **Remove** button behind `ConfirmDialog` for the uploader or a supervisor.

### 9 — Routes

**File: `web/src/App.tsx`** — replace **line 46** and add the child route. Everything else in the file is unchanged:

```tsx
<Route path="/customers" element={<CustomersPage />} />
<Route path="/customers/:customerId" element={<CustomerProfilePage />} />
```

- Both stay **inside** the existing layout route (lines 21–66) so they render within `AppLayout`.
- **No `RequireAuth roles={...}` wrapper** — every role may view customers; the destructive gates are the policy's, server-side.
- **Import from the feature's barrel** — `import { CustomersPage, CustomerProfilePage } from './features/customers';` — never from a deep path (shared contract 5).
- **Do not touch `navItems.tsx`.** The `Customers` entry already exists at lines 48–56, and `navRoutes.test.tsx` (which sweeps the manifest) must keep passing unchanged. `/customers/:customerId` is intentionally **not** a nav item.

---

## Edge Cases & Failure Modes

- **A customer with no email and no phone.** Blocked in three places: `customerSchema`'s `.refine` (Frontend Task 1), `StoreCustomerRequest::after()` (Backend Task 6), and — for anything that bypasses both — nothing at the DB level, because a NOT NULL check spanning two columns is not portable to SQLite. **Recorded uncertainty:** a direct `Customer::create()` in a seeder or tinker session can still produce a contactless record. That is acceptable; every user-facing path is guarded.
- **Two blank emails.** `''` and `''` collide on `customers_email_unique`; `NULL` and `NULL` do not. The setter converting `''` → `null` (Backend Task 4) is what prevents the second customer with no email from being rejected as a duplicate. **This is the single most likely implementation bug in this story.**
- **Two blank phones.** Identical failure via `phone_normalized`. `+`, `()`, and spaces all normalise away — `"( )"` must become `null`, not `""`.
- **Duplicate email differing only in case.** `Amelia@x.io` vs `amelia@x.io`. Prevented by lower-casing in the setter *and* in `prepareForValidation()`. Lower-casing in only one of them means validation passes and the insert then hits the index with a **500**.
- **Duplicate against a soft-deleted customer.** The partial indexes both carry `AND deleted_at IS NULL`, and `Rule::unique(...)->whereNull('deleted_at')` matches. So an email freed by a soft delete is reusable — deliberate, and the reason the plain `unique()` rule is forbidden in Backend Task 6.
- **Race between validation and insert.** Two agents submitting the same email simultaneously both pass validation; one insert then violates the index. Catch `QueryException` on unique violation in `store`/`update` and return the same `422` shape (including `duplicate_customer_id`, resolved by re-querying). **A 500 here is a visible bug under normal two-agent use.**
- **`GET /api/customers/facets` shadowed by `{customer}`.** Route order (Backend Task 8). The symptom is a 404 that looks like a missing controller. Verify with `php artisan route:list --path=customers`.
- **Filters lost on page 2.** `->withQueryString()` on the paginator. Without it, `links.next` drops `q`/`company`/`tier` and page 2 shows unfiltered rows — which reads as a data bug, not a pagination bug.
- **Unstable pagination.** Sorting by `company` with many ties lets a row appear on two pages and another on none. Fixed by the secondary `->orderBy('id')`.
- **Sort by an unknown column.** `IndexCustomerRequest`'s `Rule::in` whitelist. Unvalidated, it is a SQL-injection surface; validated, a hand-edited URL yields a 422, and `useCustomerListParams` falls back to `name` before that can happen from the UI.
- **`open_tickets_count` before Story 04.** `Schema::hasColumn` returns false, the scope selects the literal `0`, the column renders `0` for everyone. **Sorting by it is a no-op until then** — expected, not a defect.
- **`Schema::hasColumn` cost.** It hits the information schema on every request. Cache it per-request in a static, and note in a comment that Story 04 deletes the guard entirely.
- **Interaction history for a customer whose tickets an Agent may not own.** This endpoint deliberately does **not** apply `Ticket::visibleTo()` (`Ticket.php` lines 26–32). Recorded explicitly so Story 04 can revisit it as a product decision rather than discovering it as a leak.
- **Selection surviving a filter change.** Selecting three rows, then filtering them away, would submit a bulk action against rows the user can no longer see. **Clear `selectedIds` whenever `params` changes** — an effect on the serialised params, not on the rows array (which changes identity on every refetch and would clear selection during a background refresh).
- **A bulk action on a record deleted by someone else.** The endpoint returns `affected`, which will be lower than `ids.length`. The toast reports the **server's** number. Never claim more.
- **Bulk delete as an Agent.** The bar renders without destructive actions, but a crafted request still reaches the endpoint — `deleteAny` returns 403. Assert this in the test plan; it is the acceptance criterion behind "server-side authorization is the real gate".
- **Column preferences from a stale release.** An id in `localStorage` that no longer exists, or a new column absent from storage. Reconcile on read (Frontend Task 6) or a returning user loses a column permanently.
- **`localStorage` throws.** Private mode and hardened browsers throw on read *and* write. Both paths need `try/catch`; an uncaught write in the toggle handler crashes the page on a click that should be trivial.
- **Every column hidden.** Prevented by `locked: true` on `name` (Frontend Task 6).
- **RTL pagination text.** `Showing 1–8 of 248` renders as `8–1` without `dir="ltr"` on the numeric spans. The RTL export does exactly this at line 136; copy the technique.
- **RTL chevrons.** Prev/next and the sort chevrons are directional icons. `brief.md` line 202 requires them to mirror; a logical property does not mirror an SVG path — a `transform: scaleX(-1)` under `[dir='rtl']` does.
- **RTL column order.** Solved by having exactly **one** `grid-template-columns`. **If a second, RTL-specific track list appears anywhere, the implementation is wrong** — the RTL export's reversed list at line 77 is the expected result, not the technique.
- **Horizontal overflow.** Seven columns at 360px will not fit. `.shell-main` already provides `overflow-x: auto` (index.css line 418), so the table scrolls **inside** it — but only if the table card gets `min-inline-size: 0` and the page adds no second scroll container. **The page body must never scroll horizontally** (Story 02's criterion, still binding).
- **Uploaded filename as a path.** `../../.env` as an original name. `$file->store(...)` generates a random name and the original is stored only in a DB column that is never used as a path. **Never `storeAs($path, $file->getClientOriginalName())`.**
- **Attachment id from another customer.** `abort_unless($attachment->customer_id === $customer->id, 404)` in both `download` and `destroy`. Without it, the nested route is decorative and any id is readable.
- **Attachment row present, file missing on disk.** A restored database with an empty storage directory. `download` must return a **404 with a readable message**, not a stack trace from the streamer.
- **Upload larger than PHP's own limits.** `upload_max_filesize` / `post_max_size` below `attachments.max_kb` makes PHP discard the body before Laravel validates, producing an **empty `$_POST` and a confusing "file is required"** error rather than the size message. Note the required `php.ini` values in the verification steps and keep the default `max_kb` (10 MB) at or below a typical `upload_max_filesize`.
- **Note attribution after the author is deleted.** `user_id` goes null; the `author_name` snapshot keeps the note attributed, satisfying the AC.
- **Note containing HTML or script.** Rendered as text through JSX. **No `dangerouslySetInnerHTML` anywhere in this story.**
- **Empty state that cannot be escaped.** With filters, the empty state offers **Reset filters**; without them, that button must not render, because there is nothing to reset and a dead button is worse than no button.
- **Search debounce vs. history.** An un-debounced or `push`-mode search box writes one history entry per keystroke and makes Back unusable. Debounce 300 ms and use `replace: true`.
- **`per_page` beyond 100.** Capped in both `IndexCustomerRequest` (`max:100`) and the controller's `min(..., 100)`. Belt and braces, because a paginator asked for 10 000 rows is a denial-of-service on a shared database.

---

## Test Plan

### Backend — Pest, in `api/tests/Feature/`

Match `api/tests/Feature/TicketScopeTest.php` exactly: `uses(RefreshDatabase::class)` at the top, a `beforeEach` seeding users onto `$this->`, and Bearer-token auth via `createToken('spa')->plainTextToken`. `api/tests/Pest.php` line 5 binds `TestCase` to `Feature/`, so no namespace is needed.

1. **Create file: `api/tests/Feature/CustomerCrudTest.php`**
   - `it creates a customer with a name and an email` — `201`, and `assertJsonStructure(['data' => ['id','name','email','phone','company','tier','tier_label','initials','open_tickets_count','last_contact_at','created_at','updated_at']])`. **This test is the C4 contract lock; if it fails, Story 04 breaks.**
   - `it creates a customer with a name and only a phone`.
   - `it rejects a customer with neither an email nor a phone` — `422` with an error on `email`.
   - `it rejects a customer with no name` — `422`.
   - `it never exposes phone_normalized, created_by, or deleted_at` — assert the three keys are absent from the payload, in the style of `TicketScopeTest.php` lines 59–64.
   - `it stores email lower-cased and derives a normalized phone` — create with `Amelia@X.IO` and `+1 (415) 555-0148`; assert the DB row holds `amelia@x.io` and `+14155550148`, and that the API returns the **display** phone unchanged.
   - `it updates a customer without tripping its own unique rule` — PATCH the same email back; expect `200`.
   - `it soft-deletes a customer` — `204`, `assertSoftDeleted('customers', ...)`, and the row is gone from `GET /api/customers`.
2. **Create file: `api/tests/Feature/CustomerDuplicateTest.php`**
   - `it blocks a duplicate email and returns the existing customer id` — `422`, `assertJsonPath('duplicate_customer_id', $existing->id)`.
   - `it blocks a duplicate email differing only in case`.
   - `it blocks a duplicate phone written in a different format` — `+1 (415) 555-0148` vs `14155550148`.
   - `it allows two customers with no email` — the `NULL`-vs-`''` case. **The regression test for the most likely bug in this story.**
   - `it allows two customers with no phone`.
   - `it allows reusing the email of a soft-deleted customer`.
3. **Create file: `api/tests/Feature/CustomerListTest.php`**
   - `it paginates with a default page size of 25` — seed 30, assert `assertJsonCount(25, 'data')` and `assertJsonPath('meta.total', 30)`.
   - `it filters by company and by tier`.
   - `it searches across name, email, and company`.
   - `it treats a percent sign in the search term literally` — seed `Acme 100% Ltd` and `Other`; search `100%`; expect exactly one row. **Guards the LIKE escaping.**
   - `it keeps filters on the pagination links` — assert `links.next` contains the filter parameters (the `withQueryString()` guard).
   - `it rejects an unknown sort column` — `?sort=password` → `422`.
   - `it returns facet counts computed over the filtered set, and all three tiers even at zero`.
   - `it returns zero for open_tickets_count while tickets has no customer_id` — the Story-04 seam, asserted so a later change is deliberate.
4. **Create file: `api/tests/Feature/CustomerPolicyTest.php`**
   - `it lets an agent create and update a customer` — `201` / `200`.
   - `it forbids an agent from deleting a customer` — `403`.
   - `it lets a team lead delete a customer` — `204`.
   - `it forbids an agent from running a bulk delete` — `403` on `POST /api/customers/bulk`. **The "nav filtering is not access control" criterion, proved at the endpoint.**
   - `it lets a team lead bulk delete and reports the affected count` — `assertJsonPath('affected', 3)`.
   - `it lets a team lead bulk set a tier`.
   - `it rejects a bulk request with more than 200 ids` — `422`.
   - `it requires authentication for every customer route` — sweep the routes unauthenticated, expect `401` on each (mirrors `ApiContractTest.php` lines 7–15).
5. **Create file: `api/tests/Feature/CustomerNoteTest.php`**
   - `it records a note with a timestamp and the author` — `201`; the payload's `author.name` is the acting user.
   - `it shows one agent's note to another agent` — the exact AC.
   - `it keeps a note attributed after its author is deleted` — delete the user, assert the note still returns the snapshot name.
   - `it rejects an empty note body` — `422`.
6. **Create file: `api/tests/Feature/CustomerAttachmentTest.php`** — `Storage::fake('local')` in a `beforeEach`.
   - `it accepts an allowed file within the size cap` — `UploadedFile::fake()->create('brief.pdf', 100)`; `201`; `Storage::disk('local')->assertExists(...)`.
   - `it rejects an oversized file with a message naming the limit in MB` — assert the message contains `MB`, **not** `kilobytes`.
   - `it rejects a disallowed type with a message listing the allowed types`.
   - `it never uses the client filename as the storage path` — upload `../../../.env`; assert the stored `path` contains neither `..` nor `.env`, while `original_name` preserves it.
   - `it refuses to download an attachment belonging to another customer` — `404`.
   - `it lets the uploader delete their own attachment and an agent not delete someone else's` — `204` then `403`.
7. **Create file: `api/tests/Feature/CustomerTicketHistoryTest.php`**
   - `it returns an empty page flagged with the pending story while tickets has no customer_id` — `assertJsonPath('meta.pending_story', 'WIS-2')`. **This test is expected to be updated by Story 04; say so in a comment in the file.**
8. **Regression** — every existing Pest file must still pass untouched: `ApiContractTest.php`, `TicketScopeTest.php`, `Auth/LoginTest.php`, `Auth/LogoutTest.php`, `Auth/PasswordPolicyTest.php`. **Record the total from a `php artisan test` run *before* any change and match it after** (plan 02 reported 21 tests across these five files; confirm against the run, do not trust the number).

### Frontend — Vitest + Testing Library, run with `npx vitest run`

Match the patterns in `web/src/app/layouts/AppLayout.test.tsx` lines 1–40: `vi.mock('../../lib/api', …)` preserving the real module via `importActual`, a `SignedInAs` helper that logs a seeded user in through the real `AuthProvider`, and a fresh `QueryClient` per test.

9. **Create file: `web/src/features/customers/hooks/useCustomerListParams.test.tsx`** (unit, inside `MemoryRouter`):
   - `it does not write defaults into the URL` — mount at `/customers`; assert the search string stays empty. **The regression test for the mount-write class of bug.**
   - `it resets page to 1 when a filter changes`.
   - `it round-trips array filters as company[]`.
   - `it falls back to the default sort for an unknown sort key`.
10. **Create file: `web/src/features/customers/hooks/useColumnPreferences.test.tsx`**:
    - `it persists a visibility toggle and reads it back`.
    - `it writes nothing to localStorage on mount` — assert `localStorage.length === 0`.
    - `it drops an unknown column id and appends a new one` — the reconciliation rule.
    - `it survives a throwing localStorage` — stub `setItem` to throw; assert no crash and the in-memory state still updates.
    - `it refuses to hide the locked column`.
11. **Create file: `web/src/components/data-table/DataTable.test.tsx`**:
    - `it renders one row per record with the table roles` — `getAllByRole('row')`, `getAllByRole('columnheader')`.
    - `it sets aria-sort on the sorted column only` — exactly one header with a non-`none` value.
    - `it puts the header checkbox in an indeterminate state for a partial selection` — reads the DOM **property**, not an attribute.
    - `it does not activate the row when the checkbox is clicked` — the `stopPropagation` guard.
    - `it activates a row on Enter`.
    - `it renders the columns in the order given` — pass a reordered array; assert the header text order.
12. **Create file: `web/src/features/customers/pages/CustomersPage.test.tsx`** (mock `customersApi`, not `axios`):
    - `it renders the skeleton while loading` and `it renders the error state with a retry that refetches`.
    - `it renders the empty state naming the active filters, with a reset action` — assert the filter values appear in the body text.
    - `it renders the no-filter empty state without a reset action` — assert **Reset filters** is absent.
    - `it renders rows and the server total in the subtitle` — assert the subtitle reads the API's `meta.total`, not `rows.length`.
    - `it shows the bulk bar with the count when rows are selected` and `it clears the selection when a filter changes`.
    - `it names the count and the action in the bulk confirmation` — select 3, choose Delete, assert the dialog title contains **"3"** and **"Delete"**. **The acceptance criterion, asserted literally.**
    - `it hides destructive bulk actions from an agent` — render as `role: 'agent'`; the bar shows the count but no Delete.
13. **Create file: `web/src/features/customers/components/CustomerFormModal.test.tsx`**:
    - `it requires a name`.
    - `it requires an email or a phone` — submit with both blank; assert the message under the Email field.
    - `it maps a 422 onto its field` — mock a rejection carrying `errors.email`; assert the message renders inline.
    - `it renders a link to the existing record on a duplicate` — mock `duplicate_customer_id: 12`; assert a link whose `href` is `/customers/12`.
    - `it returns focus to the trigger on close`.
    - `it closes on Escape`.
14. **Create file: `web/src/features/customers/pages/CustomerProfilePage.test.tsx`**:
    - `it shows the pending-story notice instead of an empty state when meta.pending_story is set`.
    - `it lists notes newest first with author and timestamp`.
    - `it renders a note body as text` — post a note containing `<img onerror=...>`; assert no element with that tag exists.
    - `it shows the server's rejection message for an oversized attachment` — mock a 422 with the MB message; assert it renders verbatim.
15. **Regression** — every pre-existing frontend test must still pass **untouched**: `LoginPage.test.tsx` (12), `AuthContext.test.tsx` (2), `navItems.test.ts` (4), `AppLayout.test.tsx` (8), `AppLayout.drawer.test.tsx` (5), `UiPreferencesContext.test.tsx` (4), plus the `it.each` sweep in `navRoutes.test.tsx`. **`navRoutes.test.tsx` is the one at risk**: it renders every nav path, so `/customers` now renders the real page instead of `PagePlaceholder`. **Read it before changing `App.tsx`** — if it asserts a `page-placeholder` testid for `/customers`, that single expectation is the one legitimate edit in this section, and it must assert the real page's `<h1>Customers</h1>` instead. **Do not weaken the sweep itself.**
16. **Manual only (Verification Step 6):** dark-mode fills, RTL mirroring, the 360px layout, drag-and-drop upload, and the reduced-motion skeleton. jsdom resolves neither computed CSS nor real `dir` layout. **Do not fake these with a snapshot test that asserts nothing real.**

---

## Migration / Rollback

Three new tables and no change to any existing one — the safest shape available, and the reason `tickets` is left entirely alone.

**Forward:**

```
cd api
php artisan migrate
php artisan migrate:status     # the three customer migrations show [Ran]
php artisan db:seed            # only on a dev database you are willing to reset
```

**Rollback:** `php artisan migrate:rollback --step=3` drops `customer_attachments`, `customer_notes`, and `customers`, in that order. **Order matters** — the two child tables FK to `customers`; rolling back only the `customers` migration fails on PostgreSQL with a dependency error.

**Half-applied states and what they look like:**

- **`create_customers_table` ran, the two child tables did not.** The list works; the profile's Notes and Attachments panels return a 500 on a missing relation. Roll forward, do not patch around it.
- **The table was created but a `DB::statement` index failed.** `Schema::create` is committed before the raw statements run and Laravel does not wrap a migration in a transaction on every driver. Symptom: duplicates are accepted despite passing validation, under concurrency. Verify explicitly — on PostgreSQL `\d customers` lists both indexes; on SQLite `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='customers'`.
- **The seeder ran twice.** `DatabaseSeeder::run()` uses `User::create` and `Customer::create` with fixed emails; a second run violates both the users' unique email and `customers_email_unique`. **Reset with `php artisan migrate:fresh --seed` rather than re-seeding onto a populated database** — and never against the Supabase URL in `api/.env` without confirming that is intended.
- **Attachments on disk after a rollback.** `migrate:rollback` drops the rows; the files under `storage/app/private/customer-attachments/` survive as orphans. Harmless, and worth deleting manually on a dev machine.

**Nothing in this story is a breaking change for Story 01 or Story 02**: no existing table, route, resource, or component is modified except `web/src/App.tsx` line 46 (a placeholder swap) and additive blocks in `web/src/index.css`, `api/routes/api.php`, and `api/database/seeders/DatabaseSeeder.php`.

---

## Verification Steps

PHP commands run in `api/`, Node commands in `web/`. On this machine PHP is Herd's: run it from **PowerShell** as `& "C:\Users\ibrah\.config\herd\bin\php84\php.exe" artisan …`.

1. **Backend tests pass:** `php artisan test` — every new Pest test green, and the pre-existing five feature files still green with the same count as the pre-change baseline. Zero failures.
2. **Migrations are reversible:** `php artisan migrate` → `php artisan migrate:rollback --step=3` → `php artisan migrate` again, with no error. Then confirm both partial indexes exist by name (`customers_email_unique`, `customers_phone_normalized_unique`).
3. **Routes resolve in the right order:** `php artisan route:list --path=customers` — `customers/facets` and `customers/bulk` appear **above** `customers/{customer}`, and every route in contract **C6** is present exactly once.
4. **Frontend tests, types, and lint clean:** `npx vitest run` (all new tests plus the 35 pre-existing `it()` blocks across the six existing test files and the `navRoutes` sweep), then `npm run build` (`tsc -b && vite build`) with no errors, then `npm run lint` with none.
5. **Devtools still excluded:** `ReactQueryDevtools` must not appear in `web/dist/assets/*.js` after the build — Story 01's criterion, and Frontend Task 9 edits the file that carries the `import.meta.env.DEV` guard (`App.tsx` line 71).
6. **App runs end to end:** `php artisan serve` in `api/` and `npm run dev` in `web/`. Sign in as `agent@wisal.test` / `Password123!`.
   - **List:** `/customers` shows the seeded rows, the subtitle reads the server total, and three pages exist at 25 per page.
   - **URL state:** apply Company and Tier facets and a search term — the URL gains `q`, `company[]`, `tier[]`; **copy the URL into a new tab and the same filtered view loads**; Back returns to the previous filter, not to an empty one.
   - **Sorting:** click **CUSTOMER**, then **LAST CONTACT** — the order changes, `aria-sort` follows, and page resets to 1.
   - **Columns:** hide **COMPANY**, move **TIER** before **OPEN**, reload — both preferences survive. Sign in as `admin@wisal.test` in a different browser profile and confirm **that** account starts from the default layout.
   - **Bulk:** select three rows as `lead@wisal.test` — the bar reads **"3 selected"**, Delete opens a dialog titled **"Delete 3 customers?"**, and confirming reports the count. As `agent@wisal.test`, the bar shows the count with **no** Delete.
   - **Create:** **Add Customer** with a name only → the inline "Add an email address or a phone number." error. Add `amelia.chen@northwind.io` → the duplicate error with a working **"Open Amelia Chen"** link. Add a fresh email → the row appears.
   - **Empty:** filter to a combination with no rows → the empty state **names those filters**, and **Reset filters** returns to the full list.
   - **Profile:** open a customer. Contact details render; **Interaction history shows the "once Ticket Management ships" notice** (not an empty state); add a note and confirm it is timestamped and attributed; sign in as a second agent and confirm the note is visible; upload a PDF; try a `.exe` and a >10 MB file and confirm both messages name the type list and the MB limit.
7. **Theme, direction, responsiveness, keyboard, motion:**
   - **Dark:** the table card is `#1C1D24`, zebra rows `#202128`, and **a selected row is visibly a different fill** from a zebra row. Tier badges keep their contrast.
   - **RTL:** set `dir="rtl"` on `<html>`. **Column order fully mirrors, the select/actions column lands on the visual left**, the pagination summary still reads `1–8 of 248` (not reversed), and the prev/next chevrons point the correct way. **No element overflows.**
   - **Responsive:** at **360px** the table scrolls **inside its own container** and the **page body has no horizontal scrollbar**.
   - **Keyboard:** Tab through the page — the facet chips, every header sort button, every row checkbox, every row, the pagination controls, and the column menu are all reachable with a visible focus ring. Open the create modal: focus enters it, Tab is trapped inside, Escape closes it and focus returns to **Add Customer**.
   - **Reduced motion:** enable it at the OS level — the skeleton stops pulsing and renders at `opacity: 0.75` (loading export line 19).
8. **Backend untouched by the frontend work:** re-run `php artisan test` after the frontend tasks. A failure means something under `api/` was edited that should not have been.

---

## Done Criteria

- [x] `customers`, `customer_notes`, and `customer_attachments` exist exactly as pinned in contract **C1**, created by three new migrations; **`2026_08_25_200001_create_tickets_table.php` is untouched** and no `customer_id` column was added to `tickets` by this story.
- [x] Both partial unique indexes from **C2** exist by name and are verified on the running database; **no plain `unique()` index on `email` or `phone` exists.**
- [ ] `CustomerResource` emits **exactly** the keys in **C4**, asserted by a structure test, and **never** exposes `phone_normalized`, `created_by`, or `deleted_at`.
- [x] `App\Enums\CustomerTier` is the only definition of the three tier values; no controller, request, or seeder hard-codes them.
- [x] `CustomerPolicy` follows the `TicketPolicy` shape, delegates its supervisor checks to `User::canSeeTeamQueue()`, and is **auto-discovered** — no `Gate::policy()` call was added.
- [x] Every route in **C6** exists once, inside the existing `auth:sanctum` group, with `facets` and `bulk` declared **before** `{customer}`; `php artisan route:list --path=customers` confirms the order.
- [x] A duplicate email or phone is **blocked** with a `422` carrying `duplicate_customer_id` and `duplicate_customer_name`, and the UI renders a working link to that record. Case differences and phone formatting differences are both caught; two customers with **no** email (or no phone) are both **allowed**.
- [x] Name plus at least one contact method is enforced in **both** the Zod schema and the FormRequest, and the error lands on the **Email** field in both.
- [x] The list is **server**-paginated, **server**-filtered, and **server**-sorted; `sort` is whitelisted server-side; the paginator carries `withQueryString()`; a secondary `orderBy('id')` makes paging stable.
- [x] Facet counts come from `GET /api/customers/facets`, are computed over the filtered set **excluding the facet's own filter**, and always list all three tiers even at zero.
- [x] `q`, `company`, `tier`, `sort`, `dir`, `page`, and `per_page` live **only** in the URL — there is no `useState` mirror of any of them — defaults are never written to the URL, and changing a filter resets `page` to 1.
- [x] Column visibility and order persist under `wisal-customers-columns:{user.id}`, are written **only** on an explicit change (`localStorage.length === 0` after a plain visit, asserted), reconcile against the live column list on read, and the `CUSTOMER` column cannot be hidden.
- [ ] The bulk bar appears on selection, announces its count politely, and **every** bulk action opens a confirmation naming **both the count and the action**; the toast reports the server's `affected`. An Agent gets a 403 from the endpoint, not just a hidden button.
- [x] All four async states ship on the list **and** on each profile panel. The empty state **names the active filters** and offers **Reset filters** only when there are filters to reset. The error state is retryable and shows **no** raw error or stack.
- [x] The interaction-history panel reads **live** from the `tickets` table via a column-guarded query; **nothing about tickets is stored on `customers`**; while `tickets.customer_id` is absent it returns `meta.pending_story: "WIS-2"` and the UI shows the pending notice rather than an empty state.
- [x] Notes are timestamped, attributed (surviving the author's deletion via the `author_name` snapshot), visible to every agent, and rendered as **text** — `dangerouslySetInnerHTML` appears nowhere in this story.
- [ ] Attachments are capped and type-restricted from **`config/attachments.php`**; rejection messages name the limit **in MB** and list the allowed types; the client filename is never used as a storage path; an attachment cannot be downloaded or deleted through another customer's route.
- [x] The generic table lives at `web/src/components/data-table/` with the `ColumnDef` / `DataTableProps` surface frozen in Frontend Task 2, so Story 09 can consume it without forking it; nothing outside `features/customers/index.ts` is imported from that feature.
- [x] The table exposes `role="table"` / `row` / `columnheader` / `cell`, sets `aria-sort` on exactly one header, drives the header checkbox's `indeterminate` **property**, and gives every row checkbox a distinct accessible label.
- [x] There is exactly **one** `grid-template-columns` definition; RTL mirrors column order with no second track list, the select/actions column lands on the visual **left**, numeric spans carry `dir="ltr"`, and the pagination and sort chevrons mirror.
- [ ] All new CSS uses logical properties — **no `margin-left`, `padding-right`, or `text-align: left`** — and **no `outline: none` without a replacement in the same rule**.
- [x] New tokens exist in **all four** blocks of `web/src/index.css`; the light-theme Premium badge uses **`#B45309`** (not `#D97706`) per `brief.md`'s `badge_text_on_tint` note; zebra and selected row fills are **distinct tokens** and visibly differ in dark mode.
- [x] The skeleton matches the loading export — real header labels, six rows at the real row height — and stops animating under `prefers-reduced-motion: reduce`.
- [x] The modal traps focus, closes on Escape and backdrop click, returns focus to its trigger, and releases the body scroll lock on unmount; the destructive confirm focuses **Cancel** and names the specific record.
- [x] `/customers` renders `CustomersPage` and `/customers/:customerId` renders `CustomerProfilePage`, both inside the layout route; **`web/src/app/navigation/navItems.tsx` is unchanged** and `navRoutes.test.tsx` still passes.
- [ ] The page adds no padding of its own and no second horizontal scroll container; at 360px the table scrolls inside its card and the **page body does not**.
- [ ] `npx vitest run`, `npm run build`, and `npm run lint` are clean; `ReactQueryDevtools` is absent from `web/dist/assets/*.js`.
- [ ] `php artisan test` is green, including every pre-existing Auth, ApiContract, and TicketScope test, unmodified.
- [ ] `.squad/plans/customer-management/00-overview.md` lists this story with its dependencies and the contracts it establishes. **`.squad/plans/00-index.md` was not edited** — it is merged centrally.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 04.**
