# organization-settings — plan overview

Entry point for the **organization-settings** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 20 | [20-story-organization-settings.md](20-story-organization-settings.md) | Organization Settings — Branches, Departments & Branding | WIS-20 | Stories 01, 02, 03, 08, 15, 18 |

## Dependency notes

**This story closes the remaining three bullets of client requirement Category 12** (multi-branch,
multi-department, custom branding). The fourth bullet — Arabic & English with RTL — was closed by
WIS-11 and is **not** touched here. Planned at **full** depth: every path, line range and command
was verified against real code at plan time.

- **Depends on** [`../users-roles-admin/08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md).
  Story 08 is the whole foundation: the `administrator` middleware on the `/api/admin/*` group is
  reused unchanged (this story adds **no** new authorization boundary), `AuditTrail` gains three
  constants alongside Story 18's, and the `settings` table is where branding is stored — **no
  `organization_settings` table is created**. Story 08's `users.department` free-text column is
  **kept, unrenamed, and still the value `UserResource.department` returns**, because
  `ApiContractTest.php:109–130` asserts it.
- **Depends on** [`../integrations-erp/18-story-integrations-erp-admin.md`](../integrations-erp/18-story-integrations-erp-admin.md)
  as the shape to copy: the most recent brand-new admin nav entry with no `PagePlaceholder`
  predecessor, plus its controller / policy / zod-schema / single-export-`index.ts` conventions.
  This story also **must extend** Story 18's line in `AdminAuthorizationTest.php:42` — that
  `str_replace` binds only `{user}` and `{type}`, and two new route parameters arrive here.
- **Depends on** [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md)
  for the shared `DataTable`. Its `ColumnDef` surface is marked frozen and **gains no field**: the
  two tables pass empty selection and null sort rather than growing the contract.
- **Depends on** [`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md).
  A new **`organization`** namespace is registered in `instance.ts`, which enrols it in
  `catalogueParity.test.ts` automatically — so the AR column is mandatory from the first commit.
- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md).
  Unlike Story 08, **`navItems.tsx` IS edited here** — there is no `/organization` placeholder
  route to replace, so the nav entry and the `App.tsx` route are both new (the Story 18 situation).
- **Coordinates with** [`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md):
  `src/features/organization` is added to `web/scripts/i18n-allowlist.json`'s enforced roots by
  **this** story, so WIS-17 inherits zero literals from this screen rather than a cleanup job.

**Shared contracts this story establishes**, which later stories consume rather than redefine:

- **`branches` and `departments` tables.** `departments.branch_id` is `NOT NULL` with
  `restrictOnDelete` — a department belongs to exactly one branch, enforced by the schema and not
  by convention. **No `DELETE` route exists for either entity**; deactivation is
  `PATCH is_active=false`, which is what makes an orphan unreachable.
- **`users.branch_id` and `users.department_id`** — both nullable FKs, both `nullOnDelete`. The
  free-text `users.department` column survives beside them. `UserResource` **adds** `branch_id`,
  `branch_name`, `department_id`, `department_name` and renames nothing.
- **`branding.primary_color` and `branding.logo_path`** — two `settings` rows, deliberately absent
  from `SystemSettings::definitions()` so they stay invisible to `GET /api/admin/settings`.
  `App\Services\OrganizationBranding` is the only read/write path.
- **`--brand-primary`** — one CSS custom property on `<html>`, set by `BrandingProvider`. It feeds
  exactly four token definitions (`--btn-bg`, `--nav-active-fg`, `--bulk-bar-fg`, the focus
  outline). The other 30 `#4F46E5`/`#818CF8` definitions in `index.css` are AA-tuned fg/bg pairs
  or chart series and are **deliberately not** overridable — a later story must not "finish the
  job" by wiring them up.
- **`GET /api/organization/branding`** — the one branding read that is **not** admin-gated, because
  every agent renders the brand. Managing branding stays administrator-only.
- **Frontend `web/src/features/organization/index.ts`** exporting `OrganizationPage`, at
  `/organization/:tab?` with `tab ∈ {branches, departments, branding}`.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **`tickets` gains no branch or department column.** The intake delegated the call to planning and
  it was declined: no artboard in this story contains a ticket, the only cross-entity read the
  design needs is the per-branch and per-department **AGENTS** count (`withCount` over `users`),
  and a `tickets.branch_id` would reach into `TicketResource`, the queue's URL-filter state and
  Story 04's visibility scope for no acceptance criterion here. A future "route tickets by branch"
  story owns it.
- **Dropping `users.department`.** Blocked on `ApiContractTest.php:109–130`, which asserts the
  string value. Whichever story drops the column also updates that lock.
- **Per-branch / per-department permissions.** An RBAC extension of WIS-8, explicitly out of scope
  in the intake. This story manages the entities only.
- **Portal-side branding.** Story 17's audience keeps Story 17's chrome; no `/api/portal/*` route
  reads a branding key. The logo already lives on a public URL, so a later story can adopt it
  without a storage change.
