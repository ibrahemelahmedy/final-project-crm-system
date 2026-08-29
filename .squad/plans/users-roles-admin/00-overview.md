# users-roles-admin — plan overview

Entry point for the **users-roles-admin** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 08 | [08-story-users-roles-administration.md](08-story-users-roles-administration.md) | Users & Roles Administration | WIS-8 | Stories 01, 02, 03 |

## Dependency notes

**This story is the management layer on top of Story 01's authentication, not a redesign of it.**
Story 08 is planned at **contract level**: scope, endpoints, and acceptance criteria are final;
task-level file paths are regenerated immediately before implementation.

- **Depends on** [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md):
  `UserRole`'s three cases (`agent` · `team_lead` · `administrator`) are the whole role model —
  this story adds no fourth role and renames no value. It also inherits `users.is_active`,
  `users.last_login_at`, the `AuditLog` model with its `record()` helper, and the login-time
  `is_active` check.
- **Depends on** [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md):
  the `/users` placeholder route this story replaces is already wrapped in
  `RequireAuth roles={['administrator']}`, and the `Users` nav entry is already administrator-gated,
  so **`navItems.tsx` is not edited by this story.**
- **Depends on** [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md)
  for the shared DataTable and the server-side pagination / faceted-filter / URL-filter-state
  pattern. The Users list reuses it; a second table pattern would fail an explicit acceptance
  criterion.
- **Consumed by** [`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md)
  and every later admin action, which write through this story's shared `AuditTrail` service rather
  than logging per-feature.
- **Consumed by** [`../agent-dashboard/07-story-agent-dashboard.md`](../agent-dashboard/07-story-agent-dashboard.md):
  the Admin dashboard's three entry-point cards link to `/users`, `/sla-rules`, and this story's
  audit-log route, and Story 07's inline role checks on `/api/dashboard/team/*` and
  `/api/dashboard/admin/*` are consolidated onto this story's centralized gate.

**Shared contracts this story establishes**, which later stories consume rather than redefine:

- **`App\Services\AuditTrail`** and the audit event-name constants (`user.created`,
  `user.updated`, `user.role_changed`, `user.deactivated`, `user.activated`, `setting.changed`).
  **Every story logging a sensitive action calls this one service.** Story 01's existing
  `login.*` / `logout` events are unchanged.
- **`App\Services\UserAdminService`** — the only place deactivation happens. It flips `is_active`
  and runs `$user->tokens()->delete()` (all tokens, unlike Story 01's logout, which deletes only
  `currentAccessToken()`) **inside one transaction**.
- **`UserPolicy` + the `EnsureAdministrator` gate** — the centralized RBAC check every admin
  endpoint in the app uses. Stories 02–09 depend on this being correct and in one place.
- **`ActiveUserOnly` middleware** on the `auth:sanctum` group — every authenticated endpoint in the
  app inherits it, which is what makes deactivation and role changes bite on the **next request**
  rather than the next login.
- **`/api/admin/*` endpoint group** — users CRUD, deactivate/activate, audit logs, settings.
- **New migrations owned here:** `users.department` (nullable) and a `settings` table. The Story 01
  users migration is **never edited**.
- **`AuditLog` is append-only** — enforced at the model level and by exposing no update or delete
  route. The database-role grant is applied only if the deployment target is confirmed as
  PostgreSQL (local development runs SQLite per `STATUS.md`).
- **Frontend `web/src/features/users-roles-admin/index.ts`** exporting `UsersPage`, `AuditLogPage`,
  `SystemSettingsPage`, at `/users`, `/users/audit-log`, `/users/settings`.

## Implementation status

**Story 08 is implemented** (2026-08-28). What actually landed, where it differs from the plan, and
what a later story must not undo:

### Backend

- Migrations: `2026_08_28_090000_add_department_to_users_table` (adds `users.department` plus an
  index on `role`), `2026_08_28_090100_create_settings_table`,
  `2026_08_28_090200_make_audit_logs_append_only`. The Story 01 users migration is untouched.
- **One migration beyond the plan's list, added because the plan told me to check:**
  `2026_08_28_090300_add_audit_log_viewer_indexes`. The plan flagged "a date-range filter without
  an index scan is a correctness risk to verify with `EXPLAIN`". Verified on 20k rows: Story 01's
  `['event', 'created_at']` index serves an event filter (Index Scan, ~0.1ms), but a date range
  alone and an actor+date range both fell back to a Seq Scan (~7ms, growing linearly on an
  unbounded table) because `event` leads that index. Adding `created_at` and
  `['user_id', 'created_at']` puts all three combinations on an Index Scan Backward (0.07-0.17ms)
  and removes the sort step for the mandatory `ORDER BY created_at DESC`.
- **The DB-level append-only clause resolved to YES, via a trigger rather than a grant.** `.env`
  confirms `DB_CONNECTION=pgsql`, so the deployment target IS PostgreSQL. A `REVOKE` was not
  viable — the app connects as the table owner, and an owner ignores its own revoked grants — so
  `audit_logs` carries a `BEFORE UPDATE OR DELETE` trigger that raises instead. The migration
  no-ops on SQLite, which is what the test suite runs, so the model- and route-level guards stay
  the unconditional layers.
- `App\Services\AuditTrail` (event-name constants + the one write path), `UserAdminService`
  (create / update / change-role / deactivate / activate, each transactional), `SystemSettings`
  (the settings catalogue, its validation rules, and its persistence).
  **`AuditTrail::SLA_RULE_CHANGED` is declared here for Story 06 to call.**
- `App\Policies\UserPolicy`, `App\Http\Middleware\EnsureAdministrator` (alias `administrator`),
  `App\Http\Middleware\ActiveUserOnly` (alias `active`, on the whole `auth:sanctum` group).
- Controllers under `app/Http/Controllers/Admin/`: `AdminUserController`, `AuditLogController`,
  `SettingsController`.
- **Two endpoints beyond the planned contract**, both read-only facet suppliers for the filter
  chips, following Story 03's `/customers/facets` precedent: `GET /api/admin/users/facets` and
  `GET /api/admin/audit-logs/facets`.
- **Story 07 consolidation, as planned but narrower than the wording implies:**
  `/api/dashboard/admin/summary` now carries the shared `administrator` middleware and its inline
  check is gone. `/api/dashboard/team/*` keeps `DashboardController::assertRole()`, because
  "team lead OR administrator" is a two-role predicate the single-role gate does not express. That
  is a scoping rule local to that controller, not a second definition of the admin boundary.
- `tests/TestCase.php` gained `asToken()` / `asUser()`. They call
  `$this->app['auth']->forgetGuards()` first: Laravel reuses one application instance per test and
  the `sanctum` guard caches the user it resolved on the first request, so swapping the
  Authorization header alone silently keeps returning the first user. Any later story that switches
  identity mid-test must use these rather than a bare `withHeader`.

### Frontend

- `web/src/features/users-roles-admin/` with `index.ts` as the only public surface, exporting
  `UsersPage`, `AuditLogPage`, `SystemSettingsPage`.
- `App.tsx` renders `UsersPage` at `/users` — **`PagePlaceholder` is gone from that route** — plus
  `/users/audit-log` and `/users/settings` inside the same `RequireAuth roles={['administrator']}`.
  `navItems.tsx`, `AppLayout.tsx`, and `UiPreferencesContext.tsx` were not touched.
- **`InviteUserModal` and `EditUserModal` are thin named wrappers over one `UserFormModal`**, the
  same call Story 03's `CustomerFormModal` makes. Two full copies would be two places to fix the
  role select.
- The Users table adds a **seventh `ACTIONS` column** to the design's six. It is declared last with
  `align: 'end'`, so the shared DataTable's single `grid-template-columns` and `text-align: end`
  mirror it to the visual left under `dir="rtl"` with no RTL-specific rule. **There is no Delete
  action anywhere** — the API exposes no route for one.
- **`lib/api.ts` gained a response interceptor and a `setUnauthorizedHandler` hook**;
  `AuthContext` registers it, clears auth state on a non-login 401, and exposes
  `sessionEndedReason`, which `LoginPage` renders. A 403 is deliberately left alone — an
  authorization answer is not an ended session.
- Theme tokens for the role badge, status pill, and avatar tints are defined in **all four** blocks
  in `index.css`, taken from the `-LightLTR` and `-DarkLTR` exports.
- Story 07's Admin dashboard audit-log card is repointed from `/users` to `/users/audit-log`.

### Seed data

`DatabaseSeeder` now creates **14 internal users across exactly 4 departments**, matching the
design's header count, including one deactivated user and one never-signed-in invitee (so the
LAST ACTIVE column's `Never` branch is reachable in a running app).

### Verification

- `php artisan migrate:fresh --seed` on PostgreSQL: clean; `users.department` and `settings` exist,
  14 users / 4 distinct departments, and the trigger rejects a raw `UPDATE` and `DELETE` on
  `audit_logs`.
- `php artisan route:list --path=admin -v`: all 11 `/api/admin/*` routes plus
  `/api/dashboard/admin/summary` carry `auth:sanctum` + `ActiveUserOnly` + `EnsureAdministrator`.
- Backend: 61 `Admin/*` tests pass; `Auth/*`, `TicketScope`, `Dashboard/*`, `ApiContract`, and
  `TicketMessage` — 112 tests — pass with no regression.
- Frontend: `npx vitest run` — 37 files / 224 tests pass. `npx tsc -b` clean. `npm run lint` adds
  no new findings.
- **Known pre-existing failure, NOT introduced here:** 10 `Customer*` tests fail at `HEAD` because
  `StoreCustomerRequest` makes `tier` nullable while `CustomerResource.php:20` reads
  `$this->tier->value` — `Customer::create()` without a tier leaves the in-memory attribute null
  even though the DB default fills the column. Story 03's code; untouched by this story.
