# Story 20 — Organization Settings: Branches, Departments & Branding (Story: WIS-20)

---

## Prerequisites

- **Story 08 completed** ([`../users-roles-admin/08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md)) — this story is built entirely on Story 08's admin plumbing and adds no new boundary. It reuses, unchanged: the `administrator` middleware on the whole `/api/admin/*` group (`api/routes/api.php:173`), `App\Services\AuditTrail` and its constant convention (`api/app/Services/AuditTrail.php:23–69`), the `settings` table and `Setting` model (`api/app/Models/Setting.php:15–29`), and the `users.department` free-text column (`api/database/migrations/2026_08_28_090000_add_department_to_users_table.php:19`) — **which this story neither drops nor renames** (Decision 3).
- **Story 18 completed** ([`../integrations-erp/18-story-integrations-erp-admin.md`](../integrations-erp/18-story-integrations-erp-admin.md)) — the closest precedent and the one to copy from. It is the most recent brand-new admin nav entry with no `PagePlaceholder` predecessor: `navItems.tsx:113–123`, `App.tsx:197–208`, `IntegrationController` (`api/app/Http/Controllers/Admin/IntegrationController.php:25–48`), `IntegrationPolicy` (`api/app/Policies/IntegrationPolicy.php:14–29`), a zod-schema-per-feature (`web/src/features/integrations/model/integrationSchema.ts:16–28`), and a single-export `index.ts` (`web/src/features/integrations/index.ts:1–2`).
- **Story 03 completed** — the shared `DataTable` and its `ColumnDef` surface (`web/src/components/data-table/types.ts:5–29`), explicitly marked a frozen surface. This story adds no field to it. `CustomerAttachmentController::store` (`api/app/Http/Controllers/CustomerAttachmentController.php:31–46`) is the upload precedent, and `api/config/attachments.php` the config precedent — but the logo does **not** reuse its private disk (Decision 5).
- **Story 15 completed** ([`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)) — `useT`, the `NAMESPACES` tuple (`web/src/i18n/instance.ts:40–57`), the `resources` map (`:59–96`), and `web/src/i18n/catalogueParity.test.ts:27–38`, which locks EN/AR key-set parity for every namespace including the one this story adds.
- **Story 02 completed** — the App Shell this screen mounts inside: `shell-brand` (`web/src/app/layouts/AppLayout.tsx:86–97`, styled at `web/src/index.css:551–561`) is the node the custom logo replaces, and `UiPreferencesContext` (`web/src/app/providers/UiPreferencesContext.tsx:94–102`) is the only place in the app that already writes to `document.documentElement` — the brand override joins it there rather than opening a second channel.
- **Coordination — WIS-11's surface is off limits.** The AR/EN switcher is not touched, duplicated, or re-themed. This story adds a namespace and strings; it changes nothing about how the locale is chosen.

---

## Story Goal

Give an Administrator one tabbed **Organization** screen that manages the company's internal structure and visual identity:

1. **Branches** — create, edit and deactivate a branch (name, region, timezone, active flag), with a live count of the agents assigned to it.
2. **Departments** — the same, with a **required** parent branch, and a UI that stays coherent when no branch exists yet.
3. **Branding** — upload or remove a logo, override the primary colour, see a live WCAG AA contrast verdict and a live preview, and reset to default. The override reaches the running app's chrome, not just the preview card.

Client requirement Category 12's remaining three bullets (`docs/requirements/client-requirements-raw.md`) are closed by this story; the AR/EN + RTL bullet was closed by WIS-11.

**Explicitly NOT in scope**, each recorded here so a later story can pick it up rather than this one growing:

- **No per-branch or per-department permission matrix.** This story manages the entities; it introduces no access rule keyed on them. `TicketPolicy`, `UserPolicy` and the ticket-visibility scope are untouched.
- **No multi-tenant billing or plan-tier UI.** Internal organisational structure only.
- **No typography or font customisation.** Logo and primary colour only, per the client's literal bullet.
- **No branch or department column on `tickets`** (Decision 4 — the intake delegates this call to planning, and it is being declined with a reason).
- **No portal-side branding.** `/api/portal/*` gains no route and reads no branding key. Story 17's audience keeps Story 17's chrome.
- **No delete** for a branch or a department (Decision 10).

---

## Context — Read These Files First

1. `docs/design/references/21.WisalOrgSettings-Branches/` — all four variants. The `-LightLTR` export carries three artboards: **POPULATED**, **EMPTY**, and **ADD/EDIT MODAL**. Table grid is `grid-template-columns:1.6fr 1fr 0.8fr 0.9fr 90px` (identical in all 10 occurrences). Columns: `NAME` · `REGION` · `AGENTS` · `STATUS` · `ACTIONS`.
2. `docs/design/references/20.WisalOrgSettings-Departments/` — same three artboards. Grid is `grid-template-columns:1.4fr 1.2fr 0.8fr 0.9fr 90px` (5 occurrences). Columns: `NAME` · `BRANCH` · `AGENTS` · `STATUS` · `ACTIONS`. The second artboard is the **no-branch-yet** state and the third is the modal **with the branch selector disabled** — build both, they are named acceptance criteria.
3. `docs/design/references/19.WisalOrgSettings-Branding/` — three artboards: **CUSTOMIZED**, **DEFAULT (UNMODIFIED)**, and **CONTRAST WARNING**. Read the raw markup around the string `Primary color`: the swatch is a `38×38` `border-radius:8px` box with `border:1px solid #E2E8F0`, followed by a `type="text"` input holding the hex. **Do not treat the artboard's quoted contrast ratios as fixtures** — see Decision 8.
4. `api/routes/api.php` — read **lines 165–203**, the whole `Route::prefix('admin')->middleware('administrator')` group. Note the comment at `:167–172` (the gate is on the group, never per-route) and at `:186–197` (why `{type}` is left unconstrained). The new routes go inside this group, at the end, following the Integrations block.
5. `api/tests/Feature/Admin/AdminAuthorizationTest.php` — read the whole file, it is short. **`:42` is the line this story must edit**: `str_replace(['{user}', '{type}'], [(string) $targetId, 'erp'], $route->uri())`. A route carrying `{branch}` or `{department}` leaves the literal placeholder in the URI, model binding 404s, and the "denies an Agent on EVERY /api/admin/* route" assertions at `:67` / `:78` fail for the wrong reason. `beforeEach` at `:10–18` is where the concrete rows are created.
6. `api/app/Services/SystemSettings.php` — read `definitions()` at **`:30–69`** and `all()` at **`:106–129`**. `all()` iterates `definitions()` and nothing else, which is the whole reason Decision 1 works: a `settings` row whose key is not in the catalogue is invisible to `GET /api/admin/settings` and to `SystemSettingsPage`. Read `update()` from `:139` onward and note the `array_key_exists($key, static::definitions())` guard — the security catalogue cannot be written through with a branding key either.
7. `api/app/Http/Resources/UserResource.php:15–30` and `api/tests/Feature/ApiContractTest.php:109–130`. The contract test asserts `data.department === 'Support Ops'` against a factory user created with the **string** column. Adding keys is fine; making `department` derive from the new relation breaks that lock.
8. `web/src/index.css` — the token blocks. Read **`:44–45`**, **`:177–178`**, **`:291–292`**, **`:400–401`** for `--bg-page` / `--bg-card` in each of the four theme blocks (light `:root`, `@media (prefers-color-scheme: dark)`, `[data-theme="dark"]`, `[data-theme="light"]`). Then read **`:51`** (`--btn-bg: #4F46E5`), **`:66`** (`--nav-active-fg`), **`:84`** (`--bulk-bar-fg`), their dark counterparts at **`:184`** / **`:298`** (`#818CF8`), their `[data-theme="light"]` counterparts at **`:407`** / **`:419`** / **`:432`**, and the bare literal at **`:895`** (`outline: 2px solid #4F46E5`). Grep `4F46E5\|818CF8` — **34 hits**. Only the four named above are overridden (Decision 9).
9. `web/src/index.css:2495–2660` — the Story 19 AI-Assist block, as the model for a new CSS section: a header comment naming the artboards, every colour a token defined in **all four** blocks, and **logical properties only** (`inline-size`, `padding-inline`, `border-inline-end`) so RTL needs no second rule. Verify by grepping the new block for `left`/`right`/`margin-l`/`padding-r`/`text-align` — the AI block returns zero.
10. `web/src/features/users-roles-admin/pages/UsersPage.tsx:107–213` — the page shell to mirror: `page-title-row`, `page-subtitle`, `page-title-actions`, `table-card`, and the four async states routed through `DataTableSkeleton` / `DataTableError` / `DataTableEmpty` / `DataTable`.
11. `web/src/features/users-roles-admin/components/UserFormModal.tsx:39–44` and `:98` — the `useForm` + `zodResolver` + `<form onSubmit={handleSubmit(onSubmit)} noValidate>` shape every modal in this repo uses. `web/src/components/ui/Modal.tsx:20–27` is the `Modal` surface (`open`, `onClose`, `titleId`, `title`, `children`, `width`) — focus trap, Escape, backdrop click and scroll lock are already handled; do not re-implement them.
12. `web/src/features/tickets/components/thread/ReplyComposer.tsx:200–228` — the only `role="tablist"` in the codebase, styled by `.composer-mode-tabs` at `web/src/index.css:3677`. It is **not** a reusable component; this story writes its own tab strip and does not refactor that one.
13. `web/src/lib/api.ts:31` and `:39` — the axios instance and the `Authorization: Bearer` request interceptor. The token lives in a module-scoped variable, never a cookie. **This is the fact that forces Decision 5.**
14. `api/config/filesystems.php:41–48` (the `public` disk, `url` = `APP_URL` + `/storage`) and `:76–78` (the `storage:link` mapping). `api/app/Http/Middleware/SecurityHeaders.php:15–18` — every `/api/*` response carries `Content-Security-Policy: default-src 'none'`; a file served from `/storage/...` by the web server **does not**, which forces Decision 6.
15. Grep for `renderWithClient` under `web/src/features/` — five `testUtils.tsx` helpers exist (`agent-productivity`, `knowledge-base`, `notifications`, `portal`, `tickets/components/thread`). `web/src/features/integrations/pages/IntegrationsPage.test.tsx:1–30` shows the alternative this story follows instead: a local `vi.mock('../../../lib/api')` with a per-file row factory.

---

## Decisions

These are settled. Do not re-litigate them during implementation.

**Decision 1 — No `organization_settings` table. Branding lives in Story 08's `settings` table.**
The intake says "an `organization_settings` (or similar) table". The `settings` table already is that table: one row per key, `value` as `json`/`jsonb` (`api/database/migrations/2026_08_28_090100_create_settings_table.php`), with an `updated_by` FK. Two keys are added — **`branding.primary_color`** and **`branding.logo_path`** — read and written by a new `App\Services\OrganizationBranding` service. They are deliberately **not** added to `SystemSettings::definitions()`: `all()` (`SystemSettings.php:106–129`) and `update()` both iterate `definitions()`, so a non-catalogue row is invisible to `GET /api/admin/settings` and unwritable through `PATCH /api/admin/settings`. One table, one storage pattern, and the security-settings screen stays a security-settings screen. **No migration is needed for branding at all.**

**Decision 2 — `branches` and `departments` are real tables; `departments.branch_id` is `NOT NULL`.**
The intake's constraint is "a department must belong to exactly one branch (FK not nullable once a branch exists)". A nullable-then-tightened column is two migrations and a window in which the invariant is false. Instead the column is `NOT NULL` from creation, and the "no branch exists yet" case is handled where it actually occurs — in the UI, by disabling the selector, and on the server, by a `required|exists:branches,id` rule that cannot pass when the table is empty. There is no default branch row and no sentinel id.

**Decision 3 — `users.department` (free text) is kept, unrenamed and unread by this story.**
`ApiContractTest.php:109–130` asserts `data.department === 'Support Ops'` on `/api/user` for a factory user created with the string column, and `UserAdminService` writes it at `:50` / `:95`. Two nullable FKs are **added** — `users.branch_id`, `users.department_id` — and `UserResource` **adds** `branch_id`, `branch_name`, `department_id`, `department_name` while `department` keeps reading the string column. A backfill migration maps existing data forward (Task 3) but does not clear the string column. Dropping it is a follow-up for a story that also updates the contract test; **not this one**.

**Decision 4 — `tickets` gains no branch or department column.**
The intake delegates this ("decide the exact scope … during planning"). Declining, with a reason: none of the three artboards contains a ticket. The only cross-entity reading the design needs is the **AGENTS** count per branch and per department, which `withCount` over `users` serves. A `tickets.branch_id` would touch `TicketResource` (whose `sla` key-set is frozen by a cross-cutting rule), the queue's URL-filter state, and Story 04's ticket-visibility scope — none of which any acceptance criterion here exercises. Recorded as a follow-up on the overview.

**Decision 5 — the logo is stored on the `public` disk, not the private `local` disk.**
`web/src/lib/api.ts:39` attaches the bearer token from a module-scoped variable; an `<img src="/api/…">` sends no such header, so a private-disk streamed route (the `CustomerAttachmentController` pattern) cannot render in an `<img>`. Options were a blob fetch plus an object URL, or a public URL. A company logo shown in the app chrome is not confidential, so: `Storage::disk('public')->putFile('branding', $file)` yields a hashed path, `branding.logo_path` stores it, and `Storage::disk('public')->url($path)` is returned as `logo_url`. **`php artisan storage:link` becomes a deployment prerequisite** (`api/config/filesystems.php:76–78` already declares the mapping). Not the private-disk rule in `api/config/attachments.php` — that rule exists for customer attachments, which *are* confidential.

**Decision 6 — SVG is rejected. Accepted extensions are `png`, `jpg`, `jpeg`, `webp`.**
Decision 5 puts the file on a URL served by the web server, which bypasses `SecurityHeaders` (`api/app/Http/Middleware/SecurityHeaders.php:18`) and its `default-src 'none'`. An SVG opened at that URL as a top-level document executes its own scripts — stored XSS on the app's own origin, reachable by anyone with the link. Administrator-only upload narrows who can plant it, not who can be hit by it. **This diverges from the design's hint copy**, which reads "Recommended: SVG or PNG, 256×256px, transparent background". Ship the string as **"Recommended: PNG, JPG or WEBP, 256×256px, transparent background"** and leave the reason in a comment on the config. The rendered logo is always an `<img src>`; **never** inline the file's bytes into the DOM.

**Decision 7 — the swatch is an `<input type="color">`.**
The artboard draws a decorative `<div>` beside a hex text input, which gives a keyboard user no way to pick a colour. `input[type="color"]` renders as exactly that 38×38 swatch, is natively keyboard-accessible, and stays two-way bound to the hex field. Style it to the artboard's box (`38×38`, `border-radius:8px`, `border:1px solid var(--border-card)`).

**Decision 8 — contrast is computed at runtime; the artboard's numbers are wrong and must not be used as fixtures.**
The artboards claim `#0E7490` "Passes WCAG AA contrast on white (6.29:1) and dark backgrounds (6.23:1)". Both figures were checked against the WCAG 2.1 relative-luminance formula: `#0E7490` is **5.35:1** on `#FFFFFF` and **3.13:1** on `#1C1D24` (`--bg-card` dark, `web/src/index.css:178`) — i.e. the design's own "passing" example **fails AA on dark**. The artboard copy is illustrative. Implement a real `contrastRatio(hex, hex)` helper, compare the chosen colour against `#FFFFFF` and `#1C1D24`, and warn when **either** is below `4.5`. Unit-test the helper against published WCAG pairs (`#000000`/`#FFFFFF` = 21:1, `#767676`/`#FFFFFF` ≈ 4.54:1), never against the artboard's strings.

**Decision 9 — the override reaches exactly four token definitions.**
`grep '4F46E5\|818CF8' web/src/index.css` returns 34 hits. Recolouring all of them is the fastest way to violate the intake's hard constraint that "branding changes must not break existing WCAG AA contrast guarantees elsewhere". Most hits are **AA-tuned foreground/background pairs** — `--tier-enterprise-bg/-fg` (`:87`), `--status-open-fg/-bg` (`:97`), `--role-agent-bg/-fg` (`:149`), `--avatar-indigo-bg/-fg` (`:154`), `--mention-bg/-fg` (`:166`) — where changing one half alone breaks the pair. The override applies to, and only to:

| Token | Light (`:root`) | Dark |
|---|---|---|
| `--btn-bg` | `web/src/index.css:51` | `:184`, `:298` |
| `--nav-active-fg` | `:66` | dark blocks' `#A5B4FC` |
| `--bulk-bar-fg` | `:84` | dark blocks |
| the focus outline | `:895` (bare literal → becomes `var(--brand-primary)`) | same rule |

Everything else keeps its authored value. Say so in the CSS section comment.

**Decision 10 — no delete; edit and deactivate.**
The `ACTIONS` cell in both table artboards holds **two** buttons: an edit pencil (`d="M4 20h4l11-11-4-4L4 16z M14.5 5.5l4 4"`) and a red (`#DC2626`) circle-with-a-minus (`<circle r="9">` + `d="M8 12h8"`) — a deactivate glyph, not a trash can. This matches Story 08's "there is no Delete action anywhere". Deactivation is `PATCH` with `is_active: false`; no `DELETE` route is registered for either entity, so orphaned departments and orphaned `users.branch_id` values are unreachable by construction.

**Decision 11 — tab state lives in the URL as a route segment.**
One route `path="/organization/:tab?"` (react-router-dom 7 supports the optional segment), `tab ∈ {branches, departments, branding}`, absent ⇒ `branches`. An unknown value redirects to `/organization`. One `OrganizationPage` element for all three, so switching tabs does not remount the shell. This honours the cross-cutting "state lives in the URL, never in component state" rule and gives the Departments empty state's **"Go to Branches"** link a real href.

---

## Backend Tasks

### 1 — Migrations: `branches` and `departments`

**Create file:** `api/database/migrations/2026_09_03_110000_create_branches_table.php`

```php
Schema::create('branches', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    // Nullable: the design's "Remote Team" row renders REGION as "—".
    $table->string('region')->nullable();
    // An IANA identifier ('Asia/Riyadh'), validated with the `timezone`
    // rule. Not an offset — offsets move twice a year.
    $table->string('timezone')->default('UTC');
    $table->boolean('is_active')->default(true);
    $table->timestamps();

    $table->unique('name');
    $table->index('is_active');
});
```

**Create file:** `api/database/migrations/2026_09_03_110100_create_departments_table.php`

```php
Schema::create('departments', function (Blueprint $table) {
    $table->id();
    // NOT nullable, and restrictOnDelete rather than cascade: no DELETE
    // route exists for a branch (Decision 10), and if one is ever added
    // it must fail loudly rather than silently take departments with it.
    $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
    $table->string('name');
    $table->boolean('is_active')->default(true);
    $table->timestamps();

    // Two branches may each have a "Billing"; one branch may not have two.
    $table->unique(['branch_id', 'name']);
    $table->index('is_active');
});
```

### 2 — Migration: the two nullable FKs on `users`

**Create file:** `api/database/migrations/2026_09_03_110200_add_branch_and_department_to_users_table.php`

Both columns nullable, both `nullOnDelete()`, placed `after('department')`. The docblock must state that **`users.department` is deliberately left in place** and point at `ApiContractTest.php:109` (Decision 3) — the same way `2026_08_28_170000_add_locale_to_users_table.php:9` records that the Story 01 users migration is never edited.

```php
$table->foreignId('branch_id')->nullable()->after('department')
    ->constrained('branches')->nullOnDelete();
$table->foreignId('department_id')->nullable()->after('branch_id')
    ->constrained('departments')->nullOnDelete();
```

`down()` drops the FK constraints before the columns (`dropConstrainedForeignId`), or the rollback fails on PostgreSQL.

### 3 — Migration: backfill the existing free-text departments

**Create file:** `api/database/migrations/2026_09_03_110300_backfill_departments_from_users.php`

`up()`, all inside `DB::transaction`:

1. `$names = DB::table('users')->whereNotNull('department')->where('department', '!=', '')->distinct()->pluck('department');`
2. If `$names` is empty, return — a fresh install has nothing to migrate and must not get a phantom branch.
3. Otherwise insert **one** branch, `['name' => 'Main Branch', 'region' => null, 'timezone' => 'UTC', 'is_active' => true]`, and capture its id.
4. Insert one `departments` row per distinct name under that branch id.
5. `UPDATE users SET branch_id = ?, department_id = ? WHERE department = ?` per name.

`down()` nulls `users.branch_id` / `users.department_id` and deletes only the rows this migration created (match `departments.branch_id` = the Main Branch id, then the branch). **Do not truncate either table** — a rollback after an admin has added real branches must not destroy them.

Seed-data note: `api/database/seeders/DatabaseSeeder.php:74–138` creates 14 users across 4 distinct department strings (`Support Ops`, `Billing Support`, `Platform`, `Technical Support`). After `migrate:fresh --seed` the backfill runs **before** the seeder, so on a fresh database it sees zero users and no-ops — the seeder itself must therefore create the branches and departments. Extend `DatabaseSeeder` to insert 4 branches matching the artboards (`Downtown HQ` / `Riyadh, SA`, `North Branch` / `Jeddah, SA`, `East Support Center` / `Dammam, SA`, `Remote Team` / `null` region and `is_active: false`) plus the 4 departments from the Departments artboard, and to set `branch_id` / `department_id` on the 14 users so the **AGENTS** count column is non-zero in a running app.

### 4 — Models

**Create file:** `api/app/Models/Branch.php` — `$fillable = ['name', 'region', 'timezone', 'is_active']`, `casts()` returning `['is_active' => 'boolean']`, `departments(): HasMany`, `users(): HasMany`.

**Create file:** `api/app/Models/Department.php` — `$fillable = ['branch_id', 'name', 'is_active']`, the same boolean cast, `branch(): BelongsTo`, `users(): HasMany`.

**File:** `api/app/Models/User.php` — add the two relations and widen `$fillable`. **Name the relation methods carefully:** `department` already exists as an attribute (`$fillable` at `:25`). A `department()` relation and a `department` attribute can coexist in Eloquent, but `$user->department` then returns the **attribute**, so the relation is silently unreachable by property access. To avoid that trap, name the relations **`branch()`** and **`departmentRef()`**, and add `branch_id` / `department_id` to `$fillable`. State the reason in a one-line comment — a later reader will otherwise "fix" the odd name.

**Create files:** `api/database/factories/BranchFactory.php`, `api/database/factories/DepartmentFactory.php`. The department factory's `branch_id` must default to `Branch::factory()`, so a test can create a department without knowing about branches.

### 5 — Policies

**Create files:** `api/app/Policies/BranchPolicy.php`, `api/app/Policies/DepartmentPolicy.php`. Copy `IntegrationPolicy` (`api/app/Policies/IntegrationPolicy.php:14–29`) verbatim in shape: `viewAny`, `create`, `update`, each `return $user->isAdministrator();`, with the same docblock explaining that this is redundant with the route gate **on purpose**. Laravel 11 auto-discovers `App\Policies\BranchPolicy` for `App\Models\Branch`; **no registration in `AppServiceProvider` is required** — the two `Gate::` calls there (`api/app/Providers/AppServiceProvider.php:82`, `:88`) exist only for a gate with no model and for a model whose policy lives on a different class.

Branding reuses `UserPolicy@manageSettings`, the ability `SettingsController` already authorizes against (`api/app/Http/Controllers/Admin/SettingsController.php:31`, `:38`). No new ability, no new policy.

### 6 — `App\Services\OrganizationBranding`

**Create file:** `api/app/Services/OrganizationBranding.php`

```php
final class OrganizationBranding
{
    public const PRIMARY_COLOR_KEY = 'branding.primary_color';
    public const LOGO_PATH_KEY = 'branding.logo_path';

    /** @return array{primary_color: string|null, logo_path: string|null, logo_url: string|null, updated_at: string|null} */
    public function current(): array;

    /** Null clears the override and restores the token default. */
    public function setPrimaryColor(?string $hex, User $actor, Request $request, AuditTrail $audit): void;

    public function setLogoPath(?string $path, User $actor, Request $request, AuditTrail $audit): void;
}
```

- Reads and writes through the `Setting` model exactly as `SystemSettings` does — `Setting::updateOrCreate(['key' => …], ['value' => …, 'updated_by' => …])` — so the `updated_by` FK and the timestamps come for free.
- `logo_url` is `Storage::disk('public')->url($path)` when a path is stored, else `null`. The **client** decides what `null` means (the built-in mark); the server never invents a default URL.
- One `AuditTrail::record()` call per key that actually changed, mirroring `SystemSettings::update()`'s "writing the same value twice is not an event" rule.
- Wrap a colour + logo change in one `DB::transaction`.

**File:** `api/app/Services/AuditTrail.php` — add three constants after the Story 18 block (`:63–69`), following the existing naming:

```php
public const BRANCH_CHANGED = 'branch.changed';
public const DEPARTMENT_CHANGED = 'department.changed';
public const BRANDING_CHANGED = 'branding.changed';
```

### 7 — Form requests

**Create file:** `api/app/Http/Requests/SaveBranchRequest.php`

```php
'name' => ['required', 'string', 'max:120', Rule::unique('branches', 'name')->ignore($this->route('branch'))],
'region' => ['nullable', 'string', 'max:120'],
'timezone' => ['required', 'timezone'],
'is_active' => ['sometimes', 'boolean'],
```

`authorize(): true` (the group gate plus the controller's `$this->authorize()` are the boundary, as in `StoreCustomerAttachmentRequest.php:9–12`). `Rule::unique(...)->ignore(...)` is what lets a `PATCH` re-save an unchanged name.

**Create file:** `api/app/Http/Requests/SaveDepartmentRequest.php`

```php
'branch_id' => ['required', 'integer', 'exists:branches,id'],
'name' => ['required', 'string', 'max:120'],
'is_active' => ['sometimes', 'boolean'],
```

Plus a `withValidator` closure enforcing the composite unique `(branch_id, name)` while ignoring the row being updated — a bare `Rule::unique` cannot express "unique within this branch" and would reject a legitimate second "Billing" in a different branch. `required` on `branch_id` is what makes the empty-`branches` case a **422**, not a silent null (Decision 2).

**Create file:** `api/app/Http/Requests/SaveBrandingRequest.php`

```php
// Case-insensitive 6-digit hex, '#' required. Null clears the override.
'primary_color' => ['present', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
```

`present` + `nullable`, not `sometimes`: "reset to default" must be expressible, and an absent key must not silently mean "keep". **No contrast rule server-side** — the artboard's warning copy says "You can still save, but consider choosing a darker shade", so a failing ratio is a warning, never a 422.

**Create file:** `api/app/Http/Requests/UploadBrandingLogoRequest.php`

```php
'logo' => [
    'required', 'file', 'image',
    'max:'.config('branding.max_kb'),
    'mimes:'.implode(',', config('branding.allowed_extensions')),
],
```

`messages()` in the shape of `StoreCustomerAttachmentRequest.php:25–35`. Note that `image` alone would **accept** SVG on some Laravel versions; the explicit `mimes:` list is the guard that matters (Decision 6).

**Create file:** `api/config/branding.php`

```php
return [
    // The validator's max: rule is in kilobytes.
    'max_kb' => (int) env('BRANDING_LOGO_MAX_KB', 512),

    // SVG is deliberately absent. The logo is served from the `public`
    // disk (Story 20, Decision 5), i.e. by the web server rather than
    // through SecurityHeaders middleware, so an uploaded SVG opened at
    // its own URL would execute its own scripts on this origin.
    'allowed_extensions' => ['png', 'jpg', 'jpeg', 'webp'],

    // Public on purpose — a bearer-token <img> cannot authenticate.
    'disk' => 'public',
];
```

Add `BRANDING_LOGO_MAX_KB=512` to `api/.env.example` beside the existing `ATTACHMENT_*` entries.

### 8 — Resources

**Create file:** `api/app/Http/Resources/BranchResource.php`

```php
return [
    'id' => $this->id,
    'name' => $this->name,
    'region' => $this->region,
    'timezone' => $this->timezone,
    'is_active' => $this->is_active,
    // withCount('users') in the controller; `?? 0` so the key never
    // vanishes if a caller forgets the count.
    'agent_count' => $this->users_count ?? 0,
    'created_at' => $this->created_at?->toJSON(),
];
```

**Create file:** `api/app/Http/Resources/DepartmentResource.php` — the same shape plus `branch_id` and `branch_name` (`$this->whenLoaded('branch')`, falling back to `null`). The table's **BRANCH** column reads `branch_name`; do not make the client join.

**Create file:** `api/app/Http/Resources/BrandingResource.php` — `primary_color`, `logo_url`, `updated_at`. **No `logo_path`**: the on-disk path is an internal detail and leaking it invites a client to build its own URL.

**File:** `api/app/Http/Resources/UserResource.php` — **add four keys, rename none** (Decision 3):

```php
'department' => $this->department,          // UNCHANGED: the free-text column.
'branch_id' => $this->branch_id,
'branch_name' => $this->branch?->name,
'department_id' => $this->department_id,
'department_name' => $this->departmentRef?->name,
```

### 9 — Controllers

**Create file:** `api/app/Http/Controllers/Admin/BranchController.php` — `index`, `store`, `update`. Model `Branch`, requests `SaveBranchRequest`, resource `BranchResource`, `AuthorizesRequests` and a constructor-injected `AuditTrail`, all in the shape of `IntegrationController` (`api/app/Http/Controllers/Admin/IntegrationController.php:25–48`).

- `index`: `Branch::query()->withCount('users')->orderBy('name')->get()` — **no pagination.** Neither artboard has a pagination footer and branch cardinality is small. One query, `withCount` rather than N+1.
- `store` / `update`: write inside `DB::transaction`, then one `AuditTrail::record(AuditTrail::BRANCH_CHANGED, …)` carrying the changed attributes. `update` returns `200` with the fresh resource; `store` returns `201`.

**Create file:** `api/app/Http/Controllers/Admin/DepartmentController.php` — the same three actions. `index` is `Department::query()->with('branch')->withCount('users')->orderBy('name')->get()`.

**Create file:** `api/app/Http/Controllers/Admin/BrandingController.php` — four actions:

- `show` → `authorize('manageSettings', User::class)`, return `BrandingResource` from `OrganizationBranding::current()`.
- `update(SaveBrandingRequest)` → `setPrimaryColor`, return the fresh resource.
- `uploadLogo(UploadBrandingLogoRequest)` → `putFile('branding', …)` on the configured disk (Laravel generates the random name; **never** use the client filename, the reason spelled out at `CustomerAttachmentController.php:34–36`), **delete the previously stored file** if one existed, then `setLogoPath`. Return the fresh resource.
- `destroyLogo` → `Storage::disk(...)->delete($path)` (tolerant of a missing file, as noted at `CustomerAttachmentController.php:74–76`), `setLogoPath(null)`, return the fresh resource with `logo_url: null`.

**Create file:** `api/app/Http/Controllers/OrganizationBrandingController.php` — **not** under `Admin/`, a single `__invoke`. Returns `BrandingResource` to any active authenticated user. This is the read the whole SPA does on boot; gating it behind `administrator` would leave every agent on the default palette. No `authorize()` call — the `auth:sanctum` + `active` group is the gate, matching the Knowledge Base read routes' reasoning at `api/routes/api.php:206–210`.

### 10 — Routes

**File:** `api/routes/api.php`

Inside the existing `Route::prefix('admin')->middleware('administrator')` group (`:173`), **after** the Integrations block that ends at `:202`:

```php
// ---- Organization (Story 20, WIS-20) ---------------------------
//
// No DELETE on either entity: deactivation is PATCH is_active=false
// (Decision 10), which is what keeps departments and users.branch_id
// from ever being orphaned.
Route::get('/branches', [BranchController::class, 'index']);
Route::post('/branches', [BranchController::class, 'store']);
Route::patch('/branches/{branch}', [BranchController::class, 'update']);

Route::get('/departments', [DepartmentController::class, 'index']);
Route::post('/departments', [DepartmentController::class, 'store']);
Route::patch('/departments/{department}', [DepartmentController::class, 'update']);

Route::get('/branding', [BrandingController::class, 'show']);
Route::patch('/branding', [BrandingController::class, 'update']);
Route::post('/branding/logo', [BrandingController::class, 'uploadLogo']);
Route::delete('/branding/logo', [BrandingController::class, 'destroyLogo']);
```

And **outside** the admin group, on the plain `auth:sanctum` group beside the Channels route (`:163`):

```php
// Read-only, every ACTIVE authenticated user — the SPA reads this on
// boot to apply the brand override. Admin-gating it would leave every
// agent on the default palette.
Route::get('/organization/branding', OrganizationBrandingController::class);
```

### 11 — Extend `AdminAuthorizationTest`

**File:** `api/tests/Feature/Admin/AdminAuthorizationTest.php`

This is a required edit, not an optional one. In `beforeEach` (`:10–18`) create a concrete `Branch` and `Department`; at **`:42`** extend the substitution:

```php
$uri = str_replace(
    ['{user}', '{type}', '{branch}', '{department}'],
    [(string) $targetId, 'erp', (string) $branchId, (string) $departmentId],
    $route->uri()
);
```

`adminRoutes()` needs the two extra ids, so widen its signature (it is a plain function at `:28`, called at `:51`, `:70`, `:81`, `:90`). Then extend the contracted-endpoint assertion at `:50–65` with the ten new URIs. Without this edit the three "denies …" tests fail with `404`, and the failure will look like a routing bug rather than a test-fixture gap.

---

## Frontend Tasks

### 12 — Feature scaffold

**Create files** under `web/src/features/organization/`, mirroring `web/src/features/integrations/`'s layout:

```
api/organizationApi.ts       api/queryKeys.ts
model/types.ts               model/branchSchema.ts
model/departmentSchema.ts    model/brandingSchema.ts
model/contrast.ts            model/contrast.test.ts
hooks/useBranches.ts         hooks/useSaveBranch.ts
hooks/useDepartments.ts      hooks/useSaveDepartment.ts
hooks/useBranding.ts         hooks/useSaveBranding.ts
components/BranchModal.tsx        components/BranchesTab.tsx
components/DepartmentModal.tsx    components/DepartmentsTab.tsx
components/BrandingTab.tsx        components/StatusPill.tsx
components/RowActions.tsx
pages/OrganizationPage.tsx
index.ts
```

`index.ts` exports **only** `OrganizationPage` — the single-public-surface rule (`web/src/features/integrations/index.ts:1–2`).

`api/queryKeys.ts`, following `web/src/features/integrations/api/queryKeys.ts:7–10` and its docblock about not nesting under `ticketKeys`:

```ts
export const organizationKeys = {
  all: ['organization'] as const,
  branches: () => [...organizationKeys.all, 'branches'] as const,
  departments: () => [...organizationKeys.all, 'departments'] as const,
  branding: () => [...organizationKeys.all, 'branding'] as const,
};
```

Nothing in this feature changes a ticket, so `ticketKeys.all` is never invalidated from here. Saving a branch invalidates `branches()` **and** `departments()` — a department row renders `branch_name`, so a renamed branch must not leave a stale label.

### 13 — `model/contrast.ts` and the AA verdict

**Create file:** `web/src/features/organization/model/contrast.ts`

```ts
/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number;

/** WCAG 2.1 contrast ratio, 1..21, always >= 1. */
export function contrastRatio(a: string, b: string): number;

/** The two backgrounds the app actually paints behind brand-coloured text. */
export const LIGHT_BG = '#FFFFFF'; // --bg-card, web/src/index.css:45
export const DARK_BG = '#1C1D24';  // --bg-card, web/src/index.css:178

export type ContrastVerdict = {
  onLight: number;
  onDark: number;
  passes: boolean; // both >= 4.5
};
export function evaluate(hex: string): ContrastVerdict;
```

Round for display to two decimals, but compare on the **unrounded** value — a `4.497` that displays as `4.50` must still fail. See Decision 8: the artboard's own example `#0E7490` yields `5.35` / `3.13` and therefore `passes: false`.

### 14 — `pages/OrganizationPage.tsx`

The page shell for all three tabs. Structure mirrors `UsersPage.tsx:107–213`.

- Title `t('title')` — "Organization Settings"; subtitle `t('subtitle')` — "Manage branches, departments, and custom branding for your organization."
- A tab strip: `<div className="org-tabs" role="tablist" aria-label={t('tabs.label')}>` holding three `<Link role="tab" aria-selected={…}>` to `/organization`, `/organization/departments`, `/organization/branding`. Links, not buttons — Decision 11 puts the tab in the URL, and a `<Link>` is what makes it middle-clickable and gives the Departments empty state's "Go to Branches" a real target. The `aria-selected` + `role="tab"` pairing follows `ReplyComposer.tsx:200–228`.
- `const { tab = 'branches' } = useParams()`. An unrecognised value renders `<Navigate to="/organization" replace />`.
- Renders exactly one of `<BranchesTab />` / `<DepartmentsTab />` / `<BrandingTab />`.

**File:** `web/src/App.tsx` — add one route after the `/integrations` block (`:197–208`), inside the same layout route, with the same comment shape:

```tsx
{/* Story 20 (WIS-20). Administrator-only. This guard is UX only — the
    `administrator` middleware on the whole /api/admin/* group is the
    boundary, and AdminAuthorizationTest proves it. */}
<Route
  path="/organization/:tab?"
  element={
    <RequireAuth roles={['administrator']}>
      <OrganizationPage />
    </RequireAuth>
  }
/>
```

**File:** `web/src/app/navigation/navItems.tsx` — append one entry after the Integrations entry (`:113–123`), before the array closes at `:124`. `labelKey: 'nav.organization'`, `label: 'Organization'`, `to: '/organization'`, `group: 'admin'`, `roles: ['administrator']`. The artboards' sidebar lists Organization last under ADMIN, after Integrations — match that order.

**File:** `web/src/i18n/locales/{en,ar}/common.json` — add `nav.organization` to the existing `nav` block (EN `"Organization"`, AR `"المؤسسة"`). `visibleNavItems` (`navItems.tsx:129–131`) needs no change.

### 15 — `BranchesTab.tsx`

- `useBranches()` → `GET /api/admin/branches`. All four async states through `DataTableSkeleton` / `DataTableError` / `DataTableEmpty` / `DataTable`, as `UsersPage.tsx:185–213` does.
- Columns, exactly the artboard's five, with the grid `1.6fr 1fr 0.8fr 0.9fr 90px` expressed as `ColumnDef.width` (`web/src/components/data-table/types.ts:8`): `NAME` (`locked: true`), `REGION` (renders `region ?? '—'`), `AGENTS` (`agent_count`), `STATUS` (`<StatusPill>`), `ACTIONS` (`align: 'end'`, `width: '90px'`). Declaring ACTIONS last with `align: 'end'` is what makes it mirror to the visual left under `dir="rtl"` with no RTL-specific rule — the reasoning Story 08 recorded for its seventh column.
- `DataTable` requires `selectedIds` / `onSelectionChange` / `sort` / `onSortChange` (`types.ts:18–29`). Neither artboard shows a checkbox column or a sort caret, so pass `selectedIds={[]}`, a no-op `onSelectionChange`, `sort={null}`, a no-op `onSortChange`, and omit `sortKey` on every column — the frozen surface is satisfied without adding a field to it.
- Empty state copy, verbatim from the EMPTY artboard: title `"No additional branches yet"`, body `"All tickets and agents currently stay assigned to your default branch. Add a branch to start organizing your team by location."`, action `"+ Add branch"`.
- Header action `"+ Add branch"` as `dt-btn dt-btn-primary fv`, matching `UsersPage.tsx:130`.

### 16 — `BranchModal.tsx`

`Modal` (`web/src/components/ui/Modal.tsx:20–27`) + `useForm` + `zodResolver`, per `UserFormModal.tsx:39–44`, `:98`. One component serving both Add and Edit, called through two thin named wrappers if the call sites read better — the pattern Story 08 chose over two copies.

Fields, verbatim from the modal artboard: **Branch name** (text, required), **Region** (text, optional), **Timezone** (select, default `Asia/Riyadh`, label rendered as `"Asia/Riyadh (GMT+3)"`), **Active** (checkbox). Footer: **Cancel** / **Save branch**.

**Create file:** `model/branchSchema.ts`, in the shape of `integrationSchema.ts:16–28` — a `createBranchSchema(t)` factory taking a **required** translator, for the reason that file's docblock gives.

```ts
export function createBranchSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, { message: t('error.nameRequired') }).max(120),
    region: z.string().trim().max(120).or(z.literal('')),
    timezone: z.string().min(1),
    is_active: z.boolean(),
  });
}
```

The timezone option list: a module constant of IANA identifiers with their display labels. Do **not** call `Intl.supportedValuesOf('timeZone')` — it yields ~400 entries in browser order and the artboard shows a short curated list. Every label ships through the `organization` namespace.

Server 422s render inline, mapped onto the offending field via `setError`. A duplicate name is the realistic one (`SaveBranchRequest`'s `Rule::unique`).

### 17 — `DepartmentsTab.tsx` and `DepartmentModal.tsx`

Same shape, grid `1.4fr 1.2fr 0.8fr 0.9fr 90px`, columns `NAME` · `BRANCH` (`branch_name`) · `AGENTS` · `STATUS` · `ACTIONS`.

**The no-branch-yet state is a named acceptance criterion — build all of it:**

- The tab needs `useBranches()` as well as `useDepartments()`, because the *branches* list is what decides the state.
- `branches.length === 0` renders the banner from the second artboard above the table: `"You need to add at least one branch before you can create a department."` plus a **"Go to Branches"** link to `/organization` (a real `<Link>`, per Decision 11).
- The empty state below it: `"No departments yet"` / `"Departments organize agents within a branch. Add a branch first, then create your first department."`
- `"+ Add department"` stays **enabled** — the third artboard is the modal opened in exactly this state.
- Inside the modal, the **Branch** select is `disabled` with a single option reading `"No branches available"` and the helper text `"Add a branch first to assign this department."` **Save department** is disabled too; a submit is impossible, which is what keeps `branch_id`'s `required|exists` rule from ever being the user's first feedback.

`model/departmentSchema.ts`: `branch_id: z.number().int().positive()` — a plain `z.number()` would let `0` through from an empty `<select>`.

### 18 — `BrandingTab.tsx`

Two cards side by side, per the artboards: the form card and the **Live preview** card.

**Logo section.** Heading `"Logo"`; status line `"Custom logo uploaded"` when `logo_url` is set, `"Wisal default mark"` when it is not; hint `"Recommended: PNG, JPG or WEBP, 256×256px, transparent background"` (Decision 6 — this string diverges from the artboard on purpose; leave a comment saying so). Buttons **Upload new** (a hidden `<input type="file">` driven by a visible button, `accept="image/png,image/jpeg,image/webp"`) and **Remove**, which is disabled when no custom logo is stored.

**Primary colour section.** An `<input type="color">` styled to the artboard's `38×38` / `border-radius:8px` swatch (Decision 7), two-way bound to a `type="text"` hex input. Below it the verdict line from `evaluate()`:

- passing → `"✓ "` + `t('branding.contrastPass', { light, dark })`, in `var(--contrast-pass-fg)`;
- failing → the artboard's warning, in `var(--contrast-warn-fg)`: `t('branding.contrastWarn', { hex, ratio })` = `"Contrast warning: {{hex}} on white is {{ratio}}:1 — well below the 4.5:1 required for WCAG AA. Text and icons using this color may be unreadable. You can still save, but consider choosing a darker shade."`

The verdict recomputes on **every keystroke**, off local state, before any save — "live" is the requirement. It **never blocks Save changes** (the copy says so explicitly).

**Actions.** **Save changes** (`PATCH /api/admin/branding`) and **Reset to default** (`primary_color: null` plus `DELETE /api/admin/branding/logo` when a logo is stored).

**Live preview card.** A miniature of the sidebar brand row — the logo (or the built-in `<svg>` from `AppLayout.tsx:88–95`) beside `t('common:brand')` — painted with the **draft** colour from local state, not the saved value, plus the caption `"This preview updates instantly as you change the logo or color — no separate preview step needed."`

**Never render the uploaded file as inline SVG markup.** Always `<img src={logo_url}>`. Decision 6 rejects SVG at upload; this is the second layer.

### 19 — Applying the override to the running app

**Create file:** `web/src/app/providers/BrandingProvider.tsx`

- `useQuery` on `GET /api/organization/branding` — the non-admin route from Task 9, so an agent gets the brand too. `staleTime: Infinity`; this changes about once a year.
- On a non-null `primary_color`, set the override on `document.documentElement`, which is where `UiPreferencesContext.tsx:94–102` already writes `data-theme`, `dir` and `lang`. One channel, not two:

```ts
const root = document.documentElement;
if (primaryColor) root.style.setProperty('--brand-primary', primaryColor);
else root.style.removeProperty('--brand-primary');
```

- Children pass straight through; **no loading gate**. Blocking the app on a branding fetch would make a slow settings query look like a broken login.
- Mount it in `web/src/App.tsx` **inside** `AuthProvider` (the request needs the bearer token) and **outside** the routes.

**File:** `web/src/index.css` — the four token definitions from Decision 9. In each of the four theme blocks, add a `--brand-primary` default and redefine only the four consumers in terms of it:

```css
/* :root (light) — web/src/index.css:44 onward */
--brand-primary: #4F46E5;
--btn-bg: var(--brand-primary);
--nav-active-fg: var(--brand-primary);
--bulk-bar-fg: var(--brand-primary);
```

with `--brand-primary: #818CF8` in the `@media (prefers-color-scheme: dark)` block (`:177`) and the `[data-theme="dark"]` block (`:291`), and `#4F46E5` again in `[data-theme="light"]` (`:400`). The inline `setProperty` on `<html>` outranks all four, in both themes, because an element style beats any selector — which is what makes one stored colour work in light and dark without a second stored value.

Also change the bare literal at **`:895`** from `outline: 2px solid #4F46E5` to `outline: 2px solid var(--brand-primary)`. The artboards' own `.fv:focus-visible` rule uses the primary colour, so the focus ring following the brand is the design's intent.

**Leave the other 30 hits alone**, and say why in the section comment (Decision 9): `--tier-enterprise-*` (`:87`), `--status-open-*` (`:97`), `--role-agent-*` (`:149`), `--avatar-indigo-*` (`:154`), `--mention-*` (`:166`), `--chart-series-1` (`:3474`) and the rest are AA-tuned pairs or chart palettes, and recolouring half a pair is precisely the contrast regression the intake forbids.

### 20 — CSS section

**File:** `web/src/index.css` — one new section at the end, headed like the Story 19 block at `:2495–2502`: a comment naming all twelve artboard files, then the rules.

New tokens, each defined in **all four** blocks (light `:root` ~`:44`, dark media ~`:177`, `[data-theme="dark"]` ~`:291`, `[data-theme="light"]` ~`:400`) — the rule Story 08 and Story 19 both followed, and what Verification step 10 checks:

| Token | Light | Source |
|---|---|---|
| `--org-status-active-bg` / `-fg` | `#ECFDF5` / `#059669` | Branches artboard, ACTIVE pill |
| `--org-status-inactive-bg` / `-fg` | `#F1F5F9` / `#64748B` | same, INACTIVE pill |
| `--org-tab-active-fg` / `--org-tab-idle-fg` | from the artboard tab strip | all three artboards |
| `--org-row-action-border` | `#E2E8F0` | ACTIONS cell buttons |
| `--org-row-action-danger-fg` | `#DC2626` | deactivate glyph |
| `--contrast-pass-fg` | `#059669` | Branding, passing verdict |
| `--contrast-warn-fg` / `-bg` | `#7F1D1D` / `#FEF2F2` | Branding, CONTRAST WARNING artboard |

Take the dark values from the `-DarkLTR` exports; do not invent them.

**Logical properties only** — `inline-size`, `padding-inline`, `border-inline-end`, `margin-inline` — so the `-LightRTL` / `-DarkRTL` artboards are these same rules mirrored. Grep the finished block for `left`, `right`, `margin-l`, `padding-r`, `text-align`: the Story 19 block returns zero and so must this one. The edit pencil and the deactivate circle are both direction-neutral glyphs and must **not** be flipped.

### 21 — i18n: a new `organization` namespace

**Create files:** `web/src/i18n/locales/en/organization.json` and `.../ar/organization.json`.

**File:** `web/src/i18n/instance.ts` — three edits, following the Story 18 `integrations` entry exactly: the two imports beside `:19` / `:37`, `'organization'` appended to `NAMESPACES` (`:40–57`), and `organization: enOrganization` / `arOrganization` in both halves of `resources` (`:59–96`). `ns:` at `:150` already spreads `NAMESPACES`, so it needs no edit.

Key groups: `title`, `subtitle`, `tabs.*`, `branches.*` (columns, empty state, modal fields, actions), `departments.*` (including `noBranchBanner`, `goToBranches`, `branchUnavailable`, `branchUnavailableHint`), `branding.*` (including `contrastPass`, `contrastWarn`, `logoHint`, `previewCaption`), `actions.edit`, `actions.deactivate`, `status.active`, `status.inactive`.

**Every key ships in both files.** `web/src/i18n/catalogueParity.test.ts:27–38` iterates `NAMESPACES`, so the moment the namespace is registered its AR column stops being optional — and its second assertion rejects an empty string, so a placeholder `""` will not get you past it either.

**File:** `web/scripts/i18n-allowlist.json` — add `"src/features/organization"` to `roots`. The nine current roots do not include it, so nothing would scan these files otherwise. Adding the root **now** is cheaper than letting WIS-17 find the literals later; write every string through `useT('organization')` from the first commit. The `AI` chip precedent (a deliberate Latin literal) does not apply here — nothing on this screen is exempt.

---

## Edge Cases & Failure Modes

- **A department is created while `branches` is empty.** `SaveDepartmentRequest`'s `branch_id => required|exists:branches,id` returns **422**; it cannot resolve against an empty table. The UI never gets there: `DepartmentsTab` disables the selector and the submit when `branches.length === 0` (Task 17). Two layers, and the server one is the boundary.
- **A branch is renamed while a department list is on screen.** Saving a branch invalidates `organizationKeys.departments()` as well as `branches()` (Task 12), because `DepartmentResource.branch_name` is denormalised into the row.
- **A branch is deactivated while it still holds active departments.** Permitted, and deliberately so — `is_active` on a branch is an organisational flag, not a cascade. Departments keep their own flag. There is no `DELETE`, so no orphan is reachable (Decision 10). The `restrictOnDelete` on `departments.branch_id` (Task 1) is the backstop if a delete route is ever added.
- **Two branches, same name.** `branches.name` is `unique` (Task 1) and `SaveBranchRequest` mirrors it with `Rule::unique(...)->ignore($this->route('branch'))` — the `ignore` is what lets a `PATCH` that changes only the region succeed.
- **Two departments, same name, different branches.** Allowed: the unique index is composite `(branch_id, name)`. The same name in the *same* branch is rejected by the `withValidator` closure in `SaveDepartmentRequest` (Task 7). A bare `Rule::unique('departments','name')` would wrongly reject the first case, which is why it is not used.
- **A malformed hex.** `#GGGGGG`, `4F46E5` without the hash, a 3-digit `#FFF`: all rejected by `regex:/^#[0-9A-Fa-f]{6}$/` (Task 7) and by `brandingSchema` client-side. `<input type="color">` cannot produce one, but the text field can.
- **`primary_color: null`.** The reset path, not an error: `present|nullable` accepts it, `OrganizationBranding::setPrimaryColor(null)` clears the row, and `BrandingProvider` calls `removeProperty('--brand-primary')` (Task 19) so the four tokens fall back to their per-theme authored values. Verify in **both** themes — a stale inline property is the failure mode here.
- **A colour that fails AA is saved anyway.** Supported by design. The artboard's own copy is "You can still save, but consider choosing a darker shade", so there is no server-side contrast rule (Task 7) and Save is never disabled (Task 18). The warning is the deliverable, not a gate.
- **The artboard's contrast numbers are wrong.** Verified: `#0E7490` is `5.35:1` on `#FFFFFF` and `3.13:1` on `#1C1D24`, not the `6.29` / `6.23` the artboards print — and it therefore *fails* AA on dark while the artboard labels it passing. Compute, never transcribe (Decision 8). `contrast.test.ts` asserts published WCAG pairs instead.
- **An oversized or wrong-typed logo.** `max:512` KB and `mimes:png,jpg,jpeg,webp` (Task 7), with the message shape of `StoreCustomerAttachmentRequest.php:25–35`. An SVG is rejected with the same "not accepted" message and no special case — Decision 6 explains why in the config comment.
- **An SVG renamed to `.png`.** The `mimes:` rule reads the real MIME type, not the extension, so it is rejected. The `image` rule alone would not be enough on every Laravel version, which is why both are present.
- **A second logo upload.** `uploadLogo` deletes the previously stored file before writing the new path (Task 9), or the `public` disk accumulates orphans that nothing will ever reference or clean.
- **`storage:link` was never run.** `logo_url` resolves to a URL that 404s and the sidebar shows a broken image. This is a **deployment** failure, not a code path: it is called out in Migration / Rollback and in Verification step 2. `Storage::disk('public')->url()` cannot detect it.
- **A logo file deleted from disk out of band.** `logo_url` still points at it and the `<img>` 404s. Accepted: the alternative is an `exists()` stat on every branding read, on the app's boot path. The Remove button clears the row regardless, because `Storage::delete` tolerates a missing file (`CustomerAttachmentController.php:74–76`).
- **A new `{branch}` / `{department}` route parameter.** `AdminAuthorizationTest.php:42` substitutes only `{user}` and `{type}`; without the Task 11 edit the three "denies …" tests report **404 instead of 403** and read like a routing bug. This is a known trap, written down so it is not rediscovered.
- **`users.department` vs the `department()` relation.** `department` is a real attribute on `users` (`User.php:25`), so a relation of the same name is shadowed on property access. The relation is named **`departmentRef()`** (Task 4) and `UserResource` reads `$this->departmentRef?->name` into a new `department_name` key while `department` keeps returning the string (Task 8). Getting this wrong breaks `ApiContractTest.php:109–130`, which asserts the string value.
- **The backfill on a fresh database.** `migrate:fresh --seed` runs migrations before seeders, so the backfill sees zero users and correctly no-ops instead of creating a phantom "Main Branch". The seeder owns fresh-install data (Task 3).
- **The backfill rolled back after real branches were added.** `down()` deletes only the rows it created, matched by the Main Branch id. A `truncate` would destroy an administrator's real work.
- **A non-administrator loads the app.** They never see the nav entry (`roles: ['administrator']`, Task 14) and `RequireAuth` blocks the route, but they **do** read `GET /api/organization/branding` (Task 10) and get the brand override. That asymmetry is deliberate: branding is company-wide, managing it is not.
- **A brand colour with poor contrast against the button *text*.** `--btn-bg` pairs with `--btn-text` (`#FFFFFF` light, `#1C1D24` dark, `web/src/index.css:184–185`). Those are the same two colours `evaluate()` already measures against, so the single check covers both readings — the colour as text on a surface, and as a surface behind text. Noted so nobody adds a redundant third comparison.
- **An unknown tab segment.** `/organization/nonsense` renders `<Navigate to="/organization" replace />` rather than an empty shell (Task 14).

---

## Test Plan

**Backend** — a new directory `api/tests/Feature/Organization/`, Pest, following `api/tests/Feature/Ai/`. `api/tests/Pest.php:12` already extends `Tests\TestCase` across `Feature` and `Unit`, so no bootstrapping is needed beyond `uses(RefreshDatabase::class)`. No fake binding is required — this story makes no outbound call.

1. `BranchCrudTest.php` — an administrator creates a branch (**201**), lists it (`agent_count` present and correct with two users attached), patches the region (**200**), and deactivates it via `is_active: false`. Assert an `AuditLog` row with `branch.changed` per write and **none** for a re-save of identical values.
2. `BranchValidationTest.php` — a duplicate name is **422**; the same name re-saved on the **same** branch via `PATCH` is **200** (the `Rule::unique()->ignore()` path); a missing name is 422; `timezone: 'Mars/Olympus'` is 422; `region: null` is accepted.
3. `DepartmentCrudTest.php` — create under a branch, list with `branch_name` populated, patch, deactivate. Assert `department.changed` audit rows.
4. `DepartmentBranchRequiredTest.php` — the constraint, stated as a test. With `branches` **empty**, `POST /api/admin/departments` is **422** and `departments` stays empty. `branch_id: 999999` is 422. Two departments with the same name in **different** branches both succeed; the same name twice in **one** branch is 422.
5. `BrandingTest.php` — `GET` with nothing stored returns `primary_color: null` and `logo_url: null`; `PATCH` with `#0E7490` persists and reads back; `PATCH` with `primary_color: null` clears it; `#GGGGGG` and `4F46E5` are both **422**. Assert exactly one `branding.changed` audit row per real change and **no** row for an unchanged re-save. Assert `GET /api/admin/branding` never returns a `logo_path` key.
6. `BrandingLogoTest.php` — `Storage::fake('public')`. A `UploadedFile::fake()->image('logo.png')` uploads (**200**), `logo_url` is non-null, and the stored name is **not** `logo.png` (the random-name guarantee). A second upload deletes the first file — assert with `Storage::disk('public')->assertMissing($firstPath)`. `DELETE` clears the row and returns `logo_url: null`. A `fake()->create('logo.svg', 10, 'image/svg+xml')` is **422** — the Decision 6 guarantee as a test. A 600 KB file is 422 against the 512 KB cap.
7. `OrganizationBrandingReadTest.php` — `GET /api/organization/branding` returns **200** for an **agent** and a **team lead** (branding is company-wide), **401** unauthenticated, and **401** for a deactivated user (the `active` middleware). It carries **no** `administrator` middleware — assert on `gatherMiddleware()`, the way `AdminAuthorizationTest.php:97–110` does.
8. `api/tests/Feature/Admin/AdminAuthorizationTest.php` — **extend, do not rewrite** (Task 11). Widen `adminRoutes()` and the `:42` substitution, then add the ten new URIs to the contracted-endpoint assertion at `:50–65`. The three "denies …" loops then cover the new routes with no further edit, which is the point of deriving them from the router.
9. `api/tests/Feature/ApiContractTest.php` — **extend.** (a) A key-set lock on `GET /api/admin/branches`, `/departments` and `/branding`, in the shape of the Story 18 lock at `:190`. (b) The `UserResource` addition: assert `department`, `branch_id`, `branch_name`, `department_id`, `department_name` are all present **and** that `data.department` still equals the free-text string — the Decision 3 guarantee, sitting right beside the existing assertion at `:109–130`.
10. `api/tests/Feature/Organization/BackfillDepartmentsTest.php` — the migration, tested directly. Seed users with three distinct `department` strings, run the backfill, and assert: one branch named `Main Branch`, three departments under it, every user's `department_id` matching its string, and **`users.department` still populated**. Then assert the no-op path: with zero users carrying a department, the backfill creates **no** branch.

**Frontend** — Vitest + Testing Library. Follow `web/src/features/integrations/pages/IntegrationsPage.test.tsx:1–30`: a local `vi.mock('../../../lib/api')` plus a per-file row factory, rather than adding a sixth `testUtils.tsx`.

11. `web/src/features/organization/model/contrast.test.ts` — **unit, no DOM.** `#000000`/`#FFFFFF` = 21, `#FFFFFF`/`#FFFFFF` = 1, `#767676`/`#FFFFFF` ≈ 4.54 (the published AA boundary), symmetry (`ratio(a,b) === ratio(b,a)`). Then the Decision 8 assertion: `evaluate('#0E7490')` yields `onDark` below 4.5 and `passes: false` — the artboard's own example, pinned so nobody "corrects" the helper to match the artboard's printed numbers.
12. `web/src/features/organization/pages/OrganizationPage.test.tsx` — the tab strip renders three `role="tab"` links; `/organization` marks Branches `aria-selected`; `/organization/branding` renders the branding form and **not** the branches table; `/organization/nonsense` redirects to `/organization`. Use `MemoryRouter initialEntries`.
13. `web/src/features/organization/components/BranchesTab.test.tsx` — the four async states: skeleton while pending, error with a retry, the artboard's empty copy on `[]`, and rows on data. Assert `region: null` renders `—` and `agent_count` renders its number.
14. `web/src/features/organization/components/DepartmentsTab.test.tsx` — **the highest-consequence frontend test.** With `branches: []`: the "You need to add at least one branch…" banner renders, "Go to Branches" links to `/organization`, `+ Add department` is **enabled**, and opening the modal shows the branch select `disabled` with `"No branches available"` and a **disabled** submit. With one branch: the banner is gone, the select is enabled and lists it. This is the acceptance criterion the intake calls out by name.
15. `web/src/features/organization/components/BrandingTab.test.tsx` — typing `#0E7490` shows the **warning** (per test 11, it fails on dark) and **Save changes stays enabled**; typing `#3730A3` shows the passing line; the live preview swatch tracks the draft value before any save; **Remove** is disabled with no stored logo and enabled with one; the logo hint reads the PNG/JPG/WEBP string, not the artboard's SVG one (Decision 6, pinned).
16. `web/src/app/providers/BrandingProvider.test.tsx` — a stored colour sets `--brand-primary` on `document.documentElement`; a `null` colour removes it; a failed query removes nothing and renders children anyway (no loading gate).
17. `web/src/i18n/catalogueParity.test.ts` — **no edit needed.** It iterates `NAMESPACES` (`:27`), so registering `organization` in `instance.ts` enrols it automatically. It is green today and must stay green — that is what makes the AR column of Task 21 non-optional.
18. `web/src/app/layouts/AppLayout.test.tsx` — **extend.** The Organization entry is in the `admin` group and visible to an `administrator`, and is absent from `visibleNavItems('agent')` and `visibleNavItems('team_lead')`.

---

## Migration / Rollback

- **Forward:** in `api/` — `php artisan migrate` runs four new migrations (two `create`, one `add column`, one data backfill) and edits **no** existing migration. Then **`php artisan storage:link`**, which Decision 5 makes a hard prerequisite for the logo to resolve; `api/config/filesystems.php:76–78` already declares the mapping. No new Composer dependency.
- **Rollback:** `php artisan migrate:rollback --step=4`. The backfill's `down()` reverses itself first (nulling the two user FKs and deleting only its own rows), then `users.branch_id` / `department_id` are dropped, then `departments`, then `branches`. `users.department` is untouched throughout, so the app returns exactly to its Story 08 behaviour and `ApiContractTest.php:109–130` keeps passing at every step.
- **Branding needs no rollback.** It lives in `settings` rows (Decision 1). `DELETE FROM settings WHERE key LIKE 'branding.%'` restores the defaults, and the four CSS tokens fall back to their authored per-theme values with no deploy.
- **Half-applied — migration ran, code reverted:** three unused tables and two unused nullable columns. Harmless; nothing reads them.
- **Half-applied — code shipped, migration did not:** every `/api/admin/branches` and `/departments` call 500s on a missing table, and the Organization screen is dead. Branding still works, because it needs no migration. **Migrate before deploy**, as with every other story here.
- **Half-applied — code and migration shipped, `storage:link` did not:** everything works except an uploaded logo, which renders as a broken image. Recoverable at any time by running the command; no data is lost, because `branding.logo_path` and the file on disk are both already correct.
- **Kill switch:** there is no feature flag, and none is needed. An administrator who never opens the screen leaves `branches` and `departments` empty and both `branding.*` keys unset — in which state every list is `[]`, `BrandingProvider` removes nothing, and the app is byte-identical to its pre-story behaviour. That is the rollback that matters, and Verification step 8 checks it.

---

## Verification Steps

1. **Backend builds:** in `api/` — `php artisan config:clear && php artisan migrate`. Then `php artisan migrate:fresh --seed` and confirm: `branches` holds 4 rows matching the artboards (`Remote Team` with a null region and `is_active = false`), `departments` holds 4 under the right branches, and the 14 seeded users carry non-null `branch_id` / `department_id` so the **AGENTS** column is non-zero.
2. **Storage link:** in `api/` — `php artisan storage:link`, then confirm `api/public/storage` resolves to `api/storage/app/public`. Skipping this is the one failure that looks like a frontend bug.
3. **Route audit:** in `api/` — `php artisan route:list --path=admin -v`. All ten new routes must carry `auth:sanctum` **+** `ActiveUserOnly` **+** `EnsureAdministrator`. Then `php artisan route:list --path=organization -v` and confirm `GET /api/organization/branding` carries `auth:sanctum` + `ActiveUserOnly` and **not** `EnsureAdministrator`.
4. **Backend tests:** in `api/` — `php artisan test --filter=Organization` for the new suite, then `php artisan test --filter=AdminAuthorization` (the Task 11 edit), then the **full** `php artisan test`. The baseline is **419/419 green on local Postgres** (`api/phpunit.xml:53–58` targets `wisal_testing`); this story must not reduce it.
5. **Frontend runs:** in `web/` — `npm run build` (tsc + vite), then `npm run dev`. Sign in as an administrator, open **Organization** from the sidebar, and walk all three tabs.
6. **Frontend tests:** in `web/` — `npx vitest run`.
7. **Lint + i18n gate:** in `web/` — `npm run lint` (oxlint + `node scripts/check-no-literals.mjs`). Zero violations. `src/features/organization` is a newly enforced root (Task 21), so a single literal left in a `.tsx` fails here — which is the intended outcome.
8. **Regression — the untouched path:** on a database with no branches, no departments and no branding keys, confirm every tab renders its empty state, the sidebar shows the built-in mark, and the palette is unchanged. Then `git stash` the `index.css` token edit and confirm the app still renders — proving the four `var(--brand-primary)` substitutions carry correct fallbacks.
9. **Manual — the live contrast warning:** on the Branding tab type `#FDE68A`. The warning must appear **as you type**, quoting a ratio near `1.3:1`, and **Save changes must stay enabled** (the artboard's copy promises both). Save it, reload, and confirm the sidebar's active nav item and the primary button both took the colour — and that the status pills, role badges and tier chips did **not** (Decision 9).
10. **Manual — RTL and dark:** switch to Arabic and to dark mode with all three tabs populated, and compare against `WisalOrgSettings-*-DarkRTL.dc.html`. The tables mirror, the `ACTIONS` column lands on the visual left, the edit pencil and the deactivate circle do **not** flip, and the branding preview card mirrors with the swatch on the trailing edge. Then re-check the contrast verdict for a colour that passes on white and fails on dark — the warning must fire in **both** themes, because one stored colour is measured against both backgrounds.
11. **Manual — the no-branch-yet path:** with `branches` empty, open Departments. Confirm the banner, that **Go to Branches** navigates to the Branches tab, that `+ Add department` opens, and that the modal's branch select is disabled with `"No branches available"` and cannot be submitted.
12. **Manual — the logo round trip:** upload a PNG, confirm it appears in the sidebar **and** the preview card; upload a second one and confirm the first file is gone from `api/storage/app/public/branding/`; press **Remove** and confirm the built-in mark returns. Then try to upload an `.svg` and confirm the rejection message.

---

## Done Criteria

- [x] An Administrator-only **Organization** entry sits last in the sidebar's ADMIN group, and `/organization/:tab?` renders one page shell with three `role="tab"` links whose selection lives in the URL.
- [x] **Branches** tab: create, edit and deactivate a branch (name, region, timezone, active), on the shared `DataTable` with the artboard's five columns and all four async states, including the artboard's empty copy.
- [x] **Departments** tab: the same, with a **required** parent branch — and the full no-branch-yet path (banner, working **Go to Branches** link, disabled selector reading "No branches available", disabled submit), verified by test 14.
- [x] A department cannot exist without a branch: `departments.branch_id` is `NOT NULL` and `POST /api/admin/departments` against an empty `branches` table is **422** with no row written (test 4).
- [x] **Branding** tab: logo upload and remove, a colour swatch plus hex field, a **live** WCAG AA verdict recomputed per keystroke, a live preview card, and reset-to-default.
- [x] The AA warning is computed, never transcribed: `contrastRatio` is unit-tested against published WCAG pairs, and `evaluate('#0E7490')` returns `passes: false` despite the artboard printing it as passing (Decision 8, test 11).
- [x] A failing contrast never blocks saving — **Save changes** stays enabled and no server-side contrast rule exists, matching the artboard's "You can still save".
- [x] A saved primary colour reaches the running app through `--brand-primary` on `<html>` and recolours **exactly** `--btn-bg`, `--nav-active-fg`, `--bulk-bar-fg` and the focus outline — and leaves the 30 other `#4F46E5`/`#818CF8` definitions, every one of them an AA-tuned pair or a chart series, untouched (Decision 9).
- [x] `SVG` is rejected at upload with the standard "not accepted" message (test 6), the hint copy reads PNG/JPG/WEBP, and the logo is only ever rendered as `<img src>`.
- [x] Branding is stored as two `settings` rows and adds **no** table; `GET /api/admin/settings` and `SystemSettingsPage` are unchanged, and `logo_path` never appears in a response (test 5).
- [x] `users.department` still holds its free-text value and `GET /api/user` still returns `department: 'Support Ops'` for a factory user; `branch_id`, `branch_name`, `department_id`, `department_name` are **added** keys (test 9b).
- [x] The backfill maps existing department strings onto real rows without clearing the string column, and creates **no** phantom branch on a fresh database (test 10).
- [x] All ten new `/api/admin/*` routes carry `auth:sanctum` + `active` + `administrator`, proven by the extended `AdminAuthorizationTest` — whose `:42` substitution now binds `{branch}` and `{department}` (test 8). `GET /api/organization/branding` deliberately carries no `administrator` gate and answers an agent (test 7).
- [x] `tickets` gained no branch or department column, no permission rule is keyed on either entity, no `DELETE` route exists for either, and `/api/portal/*` is untouched.
- [x] Every new string ships in `organization.json` for **both** `en` and `ar`; `src/features/organization` is an enforced root in `web/scripts/i18n-allowlist.json`; `catalogueParity.test.ts` is green.
- [x] `php artisan test` is 419+/419+ green, and `npx vitest run` + `npm run lint` are green.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 21.**
