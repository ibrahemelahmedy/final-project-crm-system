# Story 08 — Users & Roles Administration (Story: WIS-8)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 07.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** — [`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md).
  **This story extends Story 01's role model; it does not redesign it.** Supplies:
  - `api/app/Enums/UserRole.php` — `Agent` (`agent`), `TeamLead` (`team_lead`), `Administrator`
    (`administrator`), plus `label()` and `homeRoute()`. **These three cases are the whole role
    model. Do not add a fourth and do not rename a value.**
  - `api/database/migrations/0001_01_01_000000_create_users_table.php` — `users` already has
    `role` (string, default `agent`), `is_active` (boolean, default true), `last_login_at`,
    `email_verified_at`.
  - `api/app/Models/AuditLog.php` — `public $timestamps = false`, fillable
    `user_id · event · email · ip_address · user_agent · context · created_at`, `context` cast to
    array, and the static helper `record(string $event, ?User $user, Request $request, array $context = [])`.
  - `api/database/migrations/2026_08_25_200000_create_audit_logs_table.php` — `context` is promoted
    to `jsonb` on pgsql; index on `['event', 'created_at']`.
  - `AuthenticatedSessionController` — the `is_active` check that blocks login for a deactivated
    user and records the `login.inactive` event.
  - `UserResource` — `id · name · email · role · role_label · home_route · is_active`.
- **Story 02 completed** — [`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md).
  Supplies `AppLayout`, and the **`/users` placeholder route this story replaces** — already
  wrapped in `RequireAuth roles={['administrator']}`, with the matching `Users` nav entry in
  `navItems.tsx` already gated to `administrator`.
- **Story 03 completed** — [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md).
  Owns the shared **DataTable** component and the server-side pagination / faceted-filter /
  URL-filter-state pattern. **This story reuses that pattern; it does not invent a second one.**
- **Coordination:** Story 06 (`../sla-rules-automation/06-story-sla-rules-automation.md`) writes SLA
  rule changes into the audit trail. This story owns the **viewer** and the shared write helper;
  Story 06 calls it.

---

## Story Goal

Build the administration layer on top of Story 01's authentication: internal-user CRUD, role
assignment, deactivation with immediate effect, an append-only audit-log viewer, and validated
system configuration.

1. An Administrator can list, search, filter, and page through internal users, and can invite,
   edit, and deactivate them.
2. Every user has **exactly one** role at all times. A role-less user cannot be created.
3. Deactivating a user **revokes all of their Sanctum tokens in the same transaction** — their very
   next request returns 401, not merely their next login attempt.
4. Changing a user's role takes effect on that user's **next request**, not their next login.
5. Every sensitive action (user created / deactivated / reactivated / role changed / SLA rule
   changed / configuration changed) is written to the audit log with actor, action, target, and
   timestamp.
6. An Administrator can browse the audit log filtered by actor, action type, and date range, with
   **server-side** pagination. The log is not editable or deletable through the UI or the API.
7. Every Users/Admin API endpoint refuses non-Administrators **server-side**, independent of what
   the nav shows.
8. System configuration values are validated before saving (a password minimum length can never be
   set to `0`).

**Explicitly NOT in scope:**

- The login/session mechanism itself — Story 01's concern.
- Per-record permission overrides. The model is **RBAC**, not ACL.
- The Customer Portal's separate customer-facing user model.
- Self-service profile editing for non-admins.
- Password reset email flows.

---

## Context — Read These Files First

Verified to exist at plan time. For anything a future story owns, the owning plan is named instead
of a path.

1. `docs/design/references/7.Admin Reports/WisalUsers-LightLTR.dc.html` — **153 lines, the primary
   reference.** Header "Users" with the "14 internal users" subtitle and the **Invite User**
   button; the three filter chips **Role: All · Department: All · Status: Active**; the column set
   `USER · EMAIL · ROLE · STATUS · DEPARTMENT · LAST ACTIVE`; the role badge rendered as
   `TEAM LEAD` / `AGENT` / `ADMINISTRATOR`; the `Active` / `Inactive` status pill; relative
   last-active text (`Just now`, `12m ago`, `2d ago`); and the footer `Showing 1–6 of 14`.
2. `WisalUsers-LightRTL.dc.html`, `-DarkLTR.dc.html`, `-DarkRTL.dc.html` in the same folder —
   **all four variants exist**, so RTL and dark are a port, not an invention. Confirm the actions
   column moves to the visual left in RTL, per the brief's data-table rule.
3. **Grep before porting any CSS.** `-LightLTR`, `-LightRTL`, and `-DarkRTL` carry `class="fv"`;
   `-DarkLTR` carries `class="fvd"`. Grep every `class="…"` against the file's `<style>` block
   before assuming a rule exists — the recurring export defect in `STATUS.md`.
4. `docs/design/references/5.Modals/` — the create/edit form and the destructive-action
   confirmation pattern. The deactivate confirmation **names the specific user**.
5. `docs/design/brief.md` — **"Data table (Customers, Knowledge Base articles)"** (server-side
   pagination, faceted filters, URL filter state, bulk-action bar, RTL column mirroring),
   **"Required states per view"**, **"Accessibility"** (focus never removed without a replacement;
   the Active/Inactive pill needs a label, not just a colour).
6. `.squad/stories/users-roles-admin/WIS-8/intake.md` — the acceptance criteria the Done Criteria
   map to 1:1. `attachments/` is empty.
7. `api/app/Models/AuditLog.php` — read `record()` in full; it already strips `password` and
   `password_confirmation` from `context`. **Extend this helper; do not write a second one.**
8. `api/database/migrations/0001_01_01_000000_create_users_table.php` — **`department` does not
   exist** on `users` today, though the design's DEPARTMENT column requires it.
9. `api/routes/api.php` — the existing `auth:sanctum` group the admin routes join behind an
   additional role gate. `api/tests/Feature/Auth/LoginTest.php` and
   `api/tests/Feature/TicketScopeTest.php` — the Pest precedents for auth and role-scoped 403
   assertions.
10. `web/src/App.tsx` — the `/users` route and its `RequireAuth roles={['administrator']}` wrapper.
    This story swaps the `element` and adds sibling admin routes inside the same guard.
11. [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md)
    — its DataTable contract and URL-search-param convention, before writing the Users list.

---

## Shared contracts this story establishes

Later stories may cite these. This story owns them.

**Backend — users**

| Endpoint | Method | Notes |
|---|---|---|
| `/api/admin/users` | `GET` | server-side pagination, filters `role`, `status`, `department`, `q` |
| `/api/admin/users` | `POST` | invite; **`role` is required**, no default is applied |
| `/api/admin/users/{user}` | `PATCH` | name, email, role, department |
| `/api/admin/users/{user}/deactivate` | `POST` | flips `is_active` **and** revokes all tokens |
| `/api/admin/users/{user}/activate` | `POST` | reactivation; does not restore tokens |
| `/api/admin/audit-logs` | `GET` | filters `actor_id`, `event`, `from`, `to`; server-paginated |
| `/api/admin/settings` | `GET` / `PATCH` | validated system configuration |

- **Migration owned here:** add `department` (nullable string) to `users` in a **new** migration.
  **Never edit `0001_01_01_000000_create_users_table.php`.**
- **Migration owned here:** a `settings` table (`key` unique, `value` json, `updated_by`,
  timestamps) for system configuration.
- **`App\Services\UserAdminService`** — the single place where deactivation happens.
  `$user->tokens()->delete()` (all tokens, unlike Story 01's logout which deletes only
  `currentAccessToken()`) runs **inside the same DB transaction** that flips `is_active`. Controllers
  never do this inline.
- **`App\Services\AuditTrail`** — the shared write path wrapping `AuditLog::record()`. **Every
  story that logs a sensitive action calls this; no feature writes its own audit rows.** Owned
  here, consumed by Story 06 and any later admin action.
- **Audit event names** (string constants owned here, extended by later stories, never renamed):
  `user.created` · `user.updated` · `user.role_changed` · `user.deactivated` · `user.activated` ·
  `setting.changed`. Story 01's existing `login.success` · `login.failed` · `login.inactive` ·
  `logout` stay as they are.
- **`App\Policies\UserPolicy` + an `EnsureAdministrator` gate** — the **centralized** role check.
  Story 07's inline `UserRole` checks on `/api/dashboard/team/*` and `/api/dashboard/admin/*` are
  consolidated onto this gate as part of this story.
- **Append-only enforcement:** `AuditLog` gets a model-level guard rejecting `update` and `delete`,
  **and** no route exposes either verb. Story 01's migration is left untouched.
- **`is_active` becomes enforced per-request:** a middleware on the `auth:sanctum` group returns
  401 for a user whose `is_active` is false, so deactivation and role changes bite on the next
  request rather than the next login.

**Frontend — `web/src/features/users-roles-admin/`**

- Standard folder shape; `index.ts` is the only public surface.
- Public exports: `UsersPage`, `AuditLogPage`, `SystemSettingsPage`.
- Routes owned here: `/users` (replacing the placeholder), `/users/audit-log`, `/users/settings`.
  All three sit inside the existing `RequireAuth roles={['administrator']}`.
- Filter and pagination state lives in **URL search params**, matching Story 03.
- Zod schemas in `model/` are the single source for both form types and validation.
- **`navItems.tsx` is not edited** — the `Users` entry already exists and is already
  administrator-gated. The audit log and settings are reached from inside the Users screen and from
  Story 07's Admin dashboard cards.

---

## Implementation outline

Bullet level by design. File-by-file detail is regenerated before implementation.

### Backend

Everything below is **owned by this story** unless the bullet names another owner.

- **New migrations** adding `users.department` (nullable string) with an index on `role`, and
  creating `settings`.
- **`UserAdminService`** — create / update / change-role / deactivate / activate, each in a
  transaction and each emitting exactly one `AuditTrail` entry. **Token revocation lives here, not
  in a controller.**
- **`AuditTrail` service** + the event-name constants. Called by Story 06.
- **`AdminUserController`**, **`AuditLogController`**, **`SettingsController`** — thin, delegating
  to the services.
- **`UserPolicy`** and the `EnsureAdministrator` gate/middleware; routes registered in
  `api/routes/api.php` under an `/admin` prefix behind `auth:sanctum` **and** that gate.
- **`ActiveUserOnly` middleware** on the `auth:sanctum` group — 401 when `is_active` is false.
  Every authenticated endpoint in the app inherits it.
- **Extend `UserResource`** with `department` and `last_login_at`. Existing keys are **not** renamed
  — Story 01, Story 02's header, and Story 07 all read them.
- **Form requests** enforcing: `role` required and `in` the three `UserRole` values; `email` unique;
  settings values range-validated (password minimum length has a floor above `0`).
- **`AuditLog` model guard** rejecting update and delete.

### Frontend

Everything below is **owned by this story** unless the bullet names another owner.

- `web/src/features/users-roles-admin/` with the standard folder shape.
- **`UsersPage`** — **Story 03's** DataTable with the six design columns, the three filter chips,
  the `Showing X–Y of N` footer, and all four async states.
- **`InviteUserModal` / `EditUserModal`** — Zod-validated, role select with no blank option.
- **`DeactivateUserDialog`** — destructive confirmation naming the specific user and stating that
  their active sessions end immediately.
- **`AuditLogPage`** — server-paginated table with actor / event / date-range filters in URL params,
  and **no edit or delete affordance anywhere on it**.
- **`SystemSettingsPage`** — validated configuration form.
- Swap `web/src/App.tsx`'s `/users` element from `PagePlaceholder` to `UsersPage` and add the two
  sibling routes inside the same guard. The route tree is **Story 02's**; this is the sanctioned
  replacement.
- **Handle the new 401-on-deactivated case** in the shared Axios interceptor in `web/src/lib/api.ts`
  so a deactivated or role-changed user is signed out cleanly rather than left on a broken screen.
- **No change to `navItems.tsx`, `AppLayout.tsx`, or `UiPreferencesContext.tsx`.**

---

## Edge Cases & Failure Modes

- **An Administrator deactivates themselves.** Rejected with a validation error before the
  transaction opens. The system must never reach zero reachable Administrators.
- **The last Administrator's role is downgraded.** Rejected for the same reason; the service counts
  remaining active Administrators inside the transaction.
- **A signed-in user is deactivated mid-session.** Their tokens are deleted in the same transaction,
  so the next request 401s. The frontend interceptor clears auth state and routes to `/login`.
  Enforced by `UserAdminService` plus the `ActiveUserOnly` middleware — **two layers, because token
  deletion alone does not cover a cookie-mode session.**
- **A role change while the user is signed in.** Their tokens are **not** revoked; the role is read
  from the database per request, so the next request already carries the new role. The frontend
  refetches `GET /api/user` on the next 403 to resync the nav.
- **Deleting a user is never offered.** Deactivation only, so historical ticket and audit rows stay
  attributed. `users` rows are never hard-deleted through this feature.
- **Audit rows for a deleted actor.** `audit_logs.user_id` is `nullOnDelete`. The viewer renders the
  retained `email` when `user_id` is null rather than a blank actor cell.
- **Unbounded audit growth.** Pagination is server-side and mandatory; the endpoint has a hard
  per-page ceiling and rejects a larger `per_page`. The `['event', 'created_at']` index already
  exists; a date-range filter without an index scan is a correctness risk to verify with `EXPLAIN`.
- **Duplicate email on invite.** Returns a 422 field error, not a 500.
- **Concurrent edits to the same user.** Last write wins; each write emits its own audit row, so the
  sequence is recoverable. No optimistic-locking column is added.
- **Settings validation.** A password minimum length of `0`, a negative value, or a non-numeric
  string is rejected server-side. Client validation is a convenience only.
- **`department` is nullable and backfilled empty.** Existing users show `—` in the DEPARTMENT
  column until an Administrator sets one. The design's "14 internal users across 4 departments"
  count in Story 07's Admin card therefore counts **distinct non-null** departments.
- **DB-level append-only.** *Stated uncertainty:* the intake asks for `audit_logs` to be
  append-only at the **database role** level "if feasible". Local development runs SQLite (per
  `STATUS.md`), where per-table grants do not exist. This story enforces append-only at the model
  and route level unconditionally, and adds the pgsql grant statement only if the deployment target
  is confirmed as PostgreSQL at implementation time. Do not fail the story on the DB-grant clause.
- **The deferral comment named in the intake.** *Stated uncertainty:* the intake cites a
  `// Story: Users admin` comment at the `is_active` check in `AuthenticatedSessionController`.
  **Grepping the file at plan time finds no such comment** — the `is_active` check exists and
  records `login.inactive`, but carries no deferral marker. The requirement stands regardless; do
  not go looking for the comment as a prerequisite.

---

## Test Plan

**Backend (Pest, `api/tests/Feature/`) — follow `api/tests/Feature/Auth/LoginTest.php` and
`api/tests/Feature/TicketScopeTest.php`.**

1. `Admin/UserCrudTest.php` — an Administrator creates a user; **`POST` without `role` returns 422**;
   an invalid role value is rejected; a duplicate email returns 422.
2. `Admin/UserDeactivationTest.php` — deactivating a user deletes **every** row in
   `personal_access_tokens` for that user; a request with a previously valid token then returns
   **401**; the user's historical ticket and audit rows still resolve to them; an Administrator
   cannot deactivate themselves; the last Administrator cannot be deactivated or downgraded.
3. `Admin/RoleChangeTest.php` — after a role change, the **same token** on the **next** request is
   authorized under the new role (no re-login), and loses access the old role had.
4. `Admin/AdminAuthorizationTest.php` — an Agent and a Team Lead each receive **403** on every
   `/api/admin/*` endpoint. Parameterized over the full route list so a new endpoint cannot be
   added without a guard.
5. `Admin/AuditLogTest.php` — each of `user.created`, `user.deactivated`, `user.role_changed`,
   `setting.changed` writes exactly one row with actor, event, target, and timestamp; filtering by
   actor, event, and date range each narrows correctly; pagination is server-side; **no route
   accepts `PUT`, `PATCH`, or `DELETE` on an audit row**, and a direct model `update()`/`delete()`
   throws.
6. `Admin/SettingsValidationTest.php` — a password minimum length of `0` and of a negative number
   are both rejected; a valid change persists and emits `setting.changed`.
7. Extend `api/tests/Feature/ApiContractTest.php` with the response shape of the users, audit-log,
   and settings endpoints, and with the added `UserResource` keys.

**Frontend (Vitest + Testing Library, `web/src/features/users-roles-admin/`).**

8. `UsersPage.test.tsx` — renders the six design columns; all four async states; filter changes are
   written to the URL search params and survive a reload; the `Showing X–Y of N` footer reflects the
   server's pagination meta.
9. `InviteUserModal.test.tsx` — submitting with no role selected is blocked by the Zod schema and
   surfaces a field-level error; the role select has no blank option.
10. `DeactivateUserDialog.test.tsx` — the confirmation names the specific user and warns that active
    sessions end; cancelling issues no request.
11. `AuditLogPage.test.tsx` — asserts **no edit or delete control is present**; filters map to URL
    params; the Empty state renders for a filter combination with no matches.
12. `SystemSettingsPage.test.tsx` — a `0` minimum length is blocked client-side and the server error
    is surfaced when the client check is bypassed.

---

## Verification Steps

1. **Migrations apply cleanly:** `cd api && php artisan migrate:fresh --seed` — no error, `users`
   has `department`, `settings` exists.
2. **Backend tests pass:** `cd api && ./vendor/bin/pest` — all `Admin/*` tests green, no regression
   in the `Auth/*` suite or `TicketScopeTest`.
3. **Routes are gated:** `cd api && php artisan route:list --path=admin` — every route shows both
   `auth:sanctum` and the administrator gate.
4. **Frontend tests pass:** `cd web && npx vitest run` (**there is no `test` script in
   `web/package.json`**).
5. **Lint clean:** `cd web && npm run lint` — no new findings.
6. **Regression, manual:** `cd web && npm run dev`; sign in as an Administrator in one browser
   profile and as an Agent in another, deactivate the Agent, then trigger any request in the Agent's
   session — it must 401 and return to `/login` without a manual refresh.
7. **RTL and dark check:** toggle both in the shell on `/users` and confirm the column order mirrors
   and the actions column moves to the visual left.

---

## Done Criteria

Mapped 1:1 to `.squad/stories/users-roles-admin/WIS-8/intake.md`.

- [ ] Creating an internal user requires exactly one role (Agent, Team Lead, Administrator); a
      role-less user cannot be created.
- [ ] A deactivated user can no longer log in, and their historical ticket and audit records remain
      intact and attributed to them.
- [ ] Deactivating a signed-in user revokes **all** of their `personal_access_tokens` rows in the
      same transaction; their next request returns 401, not just their next login attempt.
- [ ] A role change takes effect on the user's next request, not their next login; no stale elevated
      permission survives.
- [ ] User created / deactivated / role changed / SLA rule changed / setting changed each write an
      audit entry with actor, action, target, and timestamp — and the audit log is never editable or
      deletable through the UI or the API.
- [ ] The audit-log viewer filters by actor, action type, and date range, and is paginated
      server-side.
- [ ] A non-Administrator reaching any Users/Admin screen or hitting its API endpoints directly is
      denied server-side, regardless of what the frontend nav shows.
- [ ] System configuration values are validated before saving (a password minimum length cannot be
      set to `0`).
- [ ] The Users list uses the same server-side pagination and filter pattern as Customers
      (Story 03), with filter state in the URL.
- [ ] `web/src/App.tsx` no longer renders `PagePlaceholder` at `/users`.
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 09.**
