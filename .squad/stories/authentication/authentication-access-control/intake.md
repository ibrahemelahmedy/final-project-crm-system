# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/authentication/authentication-access-control/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Authentication & Access Control
- **Feature slug (folder under `plans/`):** `authentication`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** WIS-1
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Authentication & Access Control
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Foundation story — every other feature (Tickets, Customers, Knowledge Base, SLA Rules, Reports, Users admin) depends on a signed-in, role-known user existing first.

Internal staff (Agents, Team Leads/Supervisors, Administrators) must be able to sign in to Wisal securely and be restricted to only the data and actions their role permits.

Three roles:
- Agent — works their own assigned tickets only; cannot see other agents' tickets
- Team Lead / Supervisor — sees the whole team's queue, can reassign tickets within their team
- Administrator — manages users/roles, configures SLA Rules, views audit log, full system access

Frontend and backend run on different origins (separate hosting). Laravel Sanctum is used in SPA token mode (Authorization: Bearer header), not cookie mode, because the React SPA is served from a different origin than the Laravel API.

Client requirements category 10 (Security & Administration) — the login/auth subset. The admin CRUD for users, roles, and permissions is a separate later story (WIS-8).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc.)*

```
- Given a registered active user submits correct credentials, when they log in, then they receive a Bearer token and their role, and are redirected to the role-appropriate dashboard.
- Given a registered user submits a wrong password, when they log in, then the error message does not reveal whether the email exists (no user enumeration — same message for bad email and bad password).
- Given any client, when 5 login attempts fail within 1 minute from the same IP, then further attempts are rejected with 429 until the window expires.
- Given a deactivated user, when they submit correct credentials, then login fails with a clear "account deactivated" message, and the attempt is recorded in the audit log.
- Given an authenticated user, when they log out, then their Sanctum token is revoked server-side, so a copied token stops working immediately.
- Given any user setting a password, when it is below policy (fewer than 8 characters, or a known-breached password), then it is rejected naming the specific unmet rule — not a generic "password too weak" message.
- Given an Agent, when they call any ticket-listing endpoint, then only tickets assigned to them are returned — enforced in the backend query layer, not filtered in the frontend after a full fetch.
- Given a Team Lead/Supervisor, when they call any ticket-listing endpoint, then all tickets for their team are returned, with the ability to reassign any to another agent on the team.
- Given an Administrator, when they call any endpoint, then they have full read/write access subject only to the permission model — no endpoint silently returns 403 due to a missing role guard.
- Given an unauthenticated request to any protected endpoint, when it arrives, then the server returns 401 with a JSON body, never an HTML redirect to a login page (the SPA handles navigation).
- Given the Login screen in RTL (Arabic), when rendered, then the form layout mirrors correctly and Arabic placeholder text renders at the correct line-height per `docs/design/brief.md`.
- Given the Login screen on a small/mobile viewport, when displayed, then the form is fully usable without horizontal scroll (client requirement 12: web and mobile friendly).
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None. | |

---

## Dependencies

- **Blocked by / related ids:** None — this is the first story in the project.
- **Depends on code areas or other stories:** No prior story. This story includes the initial Laravel + React scaffold (no `composer.json`, `package.json`, or `artisan` exists yet). All other stories (WIS-2 through WIS-15) depend on this one.

## Extra notes (optional)

- Design reference: `docs/design/references/0.Login/` — 4 states: default, loading, error-invalid-credentials, error-rate-limited. Light/LTR only in this story; RTL and dark variants are handled by WIS-11 (Internationalization).
- The plan for this story already exists at `.squad/plans/authentication/01-story-authentication-access-control.md` — if re-planning, read it first to avoid contradicting verified toolchain facts (PHP 8.4, PostgreSQL 18.6, Node v24, Sanctum token mode).
- **Known toolchain constraint:** the `php_intl.dll` extension is blocked by an Application Control policy on this machine. This does not affect this story (Laravel core does not require intl), but it will affect Arabic locale formatting in WIS-11. Record; do not try to fix here.
- The three roles (Agent / Team Lead / Supervisor / Administrator) are used consistently across every design screen — never introduce a fourth role or rename these without updating all design references.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- **Backend:** Laravel 11 API, PostgreSQL 18. Auth via `laravel/sanctum` in SPA token mode (`Authorization: Bearer`). Role stored on the `users` table as an enum (`agent` | `team_lead` | `administrator`). Rate limiting via Laravel's built-in `RateLimiter` facade (no extra package needed).
- **Frontend:** React/TypeScript SPA (Vite). Token stored in memory (not localStorage) to avoid XSS exposure; refresh handled via a silent re-login or a dedicated refresh-token flow if Sanctum supports it. Axios instance with a request interceptor attaches the Bearer header.
- **Role enforcement:** use Laravel Policies and Gates, not ad-hoc `if ($user->role === ...)` checks scattered across controllers. Every endpoint that is role-gated must be covered by a Policy.
- **Audit log:** a `audit_logs` table (actor, action, target_type, target_id, metadata JSONB, created_at) seeded in this story's migration; all other stories append to it — never create a second audit table.

## Out of scope

- What this story explicitly does **not** cover:
- **Customer Portal login** — external/customer-facing authentication is a separate, later story. The `users` table in this story covers internal staff only.
- **The full App Shell** — WIS-1's plan builds only a minimal placeholder shell sufficient to render the login and redirect to a role-aware stub page. The real sidebar, header controls (theme toggle, language switcher, notifications bell, avatar dropdown), and navigation are built in WIS-10.
- **Password reset / forgot-password flow** — not in the client's stated requirements; can be added later without a schema change.
- **Admin CRUD for users and roles** — that is WIS-8 (Users & Roles Administration). This story only seeds the initial Administrator user and defines the role enum.
- **OAuth / SSO / social login** — not in scope; credentials-based auth only.
- **Two-factor authentication (2FA)** — not required by the client spec; deliberately deferred.
