# authentication — plan overview

Entry point for the **authentication** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 01 | [01-story-authentication-access-control.md](01-story-authentication-access-control.md) | Authentication & Access Control | WIS-1 | None (first story in the project) |

## Dependency notes

**Story 01 is the foundation for every other feature.** Tickets, Customers, Knowledge Base, SLA Rules, Reports, and Users admin all assume a signed-in user with a known role already exists. Nothing else should be planned to start before it lands.

Story 01 also carries the **initial project scaffold** — the repository has no application source at plan time (no `composer.json`, no `package.json`, no `artisan`). Task 1 creates `api/` (Laravel 12, PHP 8.4) and `web/` (React + TypeScript, Vite) side by side. Later stories inherit that layout and must not re-scaffold.

## Blocker carried by Story 01 — read before starting any backend story

**`pdo_pgsql` and `pgsql` do not load on this machine.** Both DLLs exist and are enabled in `php.ini` (lines 934, 936), but Windows Application Control blocks them. PHP cannot reach PostgreSQL today, even though the 18.6 server is running and `psql` connects fine. Story 01's **Task 0** resolves this before any migration runs, choosing between an Application Control exemption (Path A, PostgreSQL) and SQLite locally with PostgreSQL as the deployment target (Path B). **Every backend story inherits whichever path Task 0 records in the ADR.**

`intl` is blocked by the same policy. It does not affect Story 01, but it will block Arabic date/number formatting in the Internationalization story.

## Shared contracts established here, which later stories consume rather than redefine

- `App\Enums\UserRole` — the closed set `agent` / `team_lead` / `administrator`, plus `label()` and `homeRoute()`. No permissions package; role checks go through `User::canSeeTeamQueue()` and `User::isAdministrator()`.
- `UserResource` — the JSON user shape the SPA depends on (`role`, `role_label`, `home_route`, `is_active`). **`home_route` makes the post-login destination a server-owned fact** — later stories must not reintroduce a client-side role switch.
- `audit_logs` — written by Story 01 (`login.success` / `login.failed` / `login.inactive` / `logout`). The admin-facing read UI is deferred to the Users & Roles Administration story. **Never create a second audit table.**
- `web/src/lib/api.ts` — the single Axios instance and the only place the Bearer token is attached. The token lives in a module-scoped variable, **never** in `localStorage` or `sessionStorage`.
- `web/src/lib/queryClient.ts` — the one `QueryClient` singleton, mounted in `App.tsx` via `QueryClientProvider`. Its defaults are shared by every later feature; `mutations: { retry: false }` in particular must not be relaxed, or retried mutations start consuming rate-limit budget.
- **Frontend layout is feature-first.** Story 01 establishes `web/src/features/auth/` (context, guard, screen, zod schema, react-query hook, tests colocated). There is no `src/pages/` and no layer-first `src/auth/`. Later stories add `features/tickets/`, `features/customers/`, and so on; only genuinely shared modules go in `web/src/lib/`.
- **Form stack:** `react-hook-form` + `zod` via `@hookform/resolvers`, with the schema as the single source of both validation and TypeScript types. Client-side schemas validate shape only — **never** security rules, which stay server-side.
- `SecurityHeaders` middleware and `config/cors.php` — including `'exposed_headers' => ['Retry-After']`, without which any cross-origin 429 countdown degrades silently.

## Decided, not open

**Authentication mode:** Sanctum **token mode** (Bearer), not cookie/SPA mode, because the frontend and API run on different origins. Recorded in `docs/decisions/ADR-004-authentication.md`, created by Story 01 Task 2. Later stories must not introduce `SANCTUM_STATEFUL_DOMAINS` or `/sanctum/csrf-cookie`.

**Enumeration vs. the deactivated-account message:** the intake asks both for no user enumeration *and* for a clear "account deactivated" message. Story 01 resolves this by ordering the checks — deactivation is revealed only **after** the password verifies. Do not reorder those checks in a later refactor.

**Login screen source:** `docs/design/references/0.Login/` supplies all four states (default, loading, invalid-credentials, rate-limited) in both themes. Story 01 implements them as designed, with three documented corrections the exports do not encode: `prefers-reduced-motion` on the spinner, label/input association, and the dark button's white-on-`#818CF8` contrast failure.

## Debt this story hands forward

- **Team scoping is coarse.** With no `teams` table, "the whole team's queue" is implemented as "all tickets". The Ticket Management story must narrow `Ticket::scopeVisibleTo()`'s Team Lead branch once teams exist.
- **Tokens are not revoked on deactivation.** A user deactivated mid-session keeps working until their 8-hour token expires. Belongs with the Users & Roles Administration story; marked with a code comment at the `is_active` check.
- **Under Task 0 Path B**, every Done Criteria item needs re-verification against PostgreSQL before the story is complete on the real target.

## Deliberately deferred out of Story 01

- **Customer Portal login** — a separate, externally-facing audience; its own story, not part of the `authentication` feature as scoped here.
- Password reset, MFA/2FA, SSO/OAuth, self-registration.
- The full App Shell — Story 01 renders only a role-aware placeholder.
- Full ticket CRUD — Story 01 creates a minimal `tickets` table and a single scoped `GET /api/tickets` **only** to prove server-side row filtering.
