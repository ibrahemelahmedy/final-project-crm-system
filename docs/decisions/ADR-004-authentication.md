# ADR-004: Authentication & Access Control Architecture

## Status
**Accepted** — 2026-08-25

## Context
Wisal is built as a monorepo containing a Laravel 12 REST API (`api/`) and a React + TypeScript SPA (`web/`). The application serves three internal staff roles: **Agent**, **Team Lead**, and **Administrator**. Customer Portal authentication is deferred as a separate external-facing story — see [ADR-005](ADR-005-customer-portal-access.md), which covers the external customer identity (Story 17 / WIS-16) and deliberately departs from some of the decisions below for that audience.

During environment setup, Windows Application Control policy was found to block `php_pdo_pgsql.dll` and `php_pgsql.dll` from loading into PHP 8.4 under Laravel Herd. While PostgreSQL server 18.6 is running, PHP cannot load the PostgreSQL driver locally. Per Task 0 of the implementation plan, **Path B** was selected: local development and testing run on SQLite (`api/database/database.sqlite`), while keeping PostgreSQL as the target for CI/production environments. Database migrations and queries are written driver-portably.

Note: This ADR supersedes any earlier drafting that referenced two roles; Wisal explicitly standardizes on three internal roles.

## Decision
**We adopt Laravel Sanctum in API Token Mode using `Authorization: Bearer <token>` headers.**

Sanctum's SPA / Cookie mode (`EnsureFrontendRequestsAreStateful`) is explicitly rejected because the SPA and API run on separate origins / ports (e.g., `localhost:5173` and `localhost:8000`), which breaks when origins or registrable domains differ and is susceptible to third-party cookie deprecation. Token mode is origin-independent and allows immediate server-side revocation by deleting `personal_access_tokens` database rows.

### Trade-offs & XSS Mitigations
Storing a bearer token in client JavaScript presents potential XSS risk. This risk is accepted and mitigated via four explicit architectural controls:

1. **In-Memory Token Storage**: The bearer token is stored strictly in a module-scoped variable in memory on the React client. It is **never** written to `localStorage` or `sessionStorage`.
2. **8-Hour Expiry**: `'expiration' => 480` in `config/sanctum.php` ensures tokens naturally expire even if explicit revocation is missed.
3. **Strict Content-Security-Policy (CSP)**: Security headers (`default-src 'none'; frame-ancestors 'none'`) prevent malicious inline script execution.
4. **No Raw HTML Rendering**: `dangerouslySetInnerHTML` is forbidden across all authentication components.

## Consequences
- **Page Refresh Behavior**: Refreshing the page (F5) clears the in-memory token, taking the user back to `/login`. This is an intended security trade-off.
- **No Cross-Tab Sharing**: Authentication state is scoped to the current browser tab memory.
- **Throttle Behavior**: Failed login throttling (`Limit::perMinute(5)`) decays on time and is not reset upon a successful login, preventing token harvest attacks.
- **PostgreSQL Debt (Path B)**: Before deployment to production, database migrations and query behavior must be verified against PostgreSQL.
