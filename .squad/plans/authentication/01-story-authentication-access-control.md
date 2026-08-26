# Story 01 — Authentication & Access Control

## Prerequisites

- **None — this is the first story in the project.** No sibling plan exists under `.squad/plans/`; every other feature folder holds only a `00-overview.md`.
- **The repository contains no application source.** Verified at plan time: the repo root holds only `.claude/`, `.git/`, `.gitignore`, `.squad/`, `docs/`, and `STATUS.md`. There is no `composer.json`, no `package.json`, no `artisan`. Task 1 creates the scaffold — do **not** assume any framework file exists.
- **Toolchain verified on this machine** (run all PHP/Composer commands from **PowerShell**, not Git Bash — `php`, `composer`, and `laravel` resolve through Laravel Herd at `C:\Users\ibrah\.config\herd\bin\` and are **not** on the Git Bash PATH):

  | Tool | Verified version |
  |---|---|
  | PHP | **8.4.24** (`C:\Users\ibrah\.config\herd\bin\php84\php.exe`) |
  | Composer | **2.10.2** |
  | Laravel Installer | **5.31.1** |
  | Node | **v24.13.1** |
  | npm | **11.14.1** |
  | PostgreSQL server | **18.6**, Windows service `postgresql-x64-18`, status **Running** |
  | `psql` client | **18.6**, on PATH |

- **BLOCKER — read Task 0 before running anything.** `pdo_pgsql` and `pgsql` **do not load**. `php -m` lists 62 extensions; `pdo_pgsql` and `pgsql` are **not among them**. Only `PDO`, `pdo_sqlite`, and `sqlite3` are available as database drivers. This is not a configuration mistake — both DLLs are present on disk (`ext\php_pdo_pgsql.dll`, 52 224 bytes; `ext\php_pgsql.dll`, 131 584 bytes) and both are enabled in `php.ini` (**lines 934 and 936**), but Windows Application Control blocks the files from loading:

  ```
  PHP Startup: Unable to load dynamic library 'pdo_pgsql'
    (tried: ext\php_pdo_pgsql.dll (An Application Control policy has blocked this file))
  ```

  **PHP cannot reach PostgreSQL on this machine today**, even though the server is running and `psql` connects fine. Task 0 decides what to do about it. Do not start Task 3 before Task 0 resolves.
- **`intl` is blocked by the same policy** (`php.ini` line 924). Laravel core does not require it, so it does **not** block this story. It will block `IntlDateFormatter` / `Number::` Arabic formatting in the Internationalization story. **Record it; do not attempt to change the Application Control policy.** `opcache`, `ffi`, and `pdo_mysql` are blocked too and are irrelevant here.
- **Two `STATUS.md` facts are stale — correct them in Task 1:**
  - Line 29 says "PostgreSQL 17". The installed server is **18.6**.
  - Lines 37–47 list the design-reference folders but omit **`0.Login/`** and **`0.Dashboard/`**, both of which now exist.

---

## Story Goal

Stand up the Wisal application skeleton and deliver the security foundation every other feature sits on: internal staff sign in, the server knows their role, and the **server — not the UI** — decides which rows they can see.

User-visible outcomes:

1. An **Agent**, **Team Lead/Supervisor**, or **Administrator** signs in at `/login` with email + password, receives a Bearer token, and lands on the dashboard route for their role.
2. A wrong password and an unregistered email produce one identical error — no user enumeration.
3. Repeated failed logins are rejected with **429** once the threshold is crossed, showing the remaining wait.
4. A deactivated account cannot sign in, is told so, and the attempt is written to the audit log.
5. Signing out revokes the token **server-side**, so a copied token stops working immediately.
6. Setting a password below policy is rejected naming the **specific** unmet rule.
7. An Agent calling `GET /api/tickets` receives only their own tickets, filtered in the SQL `where` clause.

**In scope beyond the obvious:** the Laravel + React scaffold (Task 1), the `users` / `audit_logs` / `tickets` tables, and one thin `GET /api/tickets` endpoint that exists solely to *prove* outcome 7.

**Explicitly NOT in scope** (from the intake's own "Out of scope" block):

- **Customer Portal login.** The `users` table here covers internal staff only.
- **The full App Shell.** This story builds a placeholder shell sufficient to render a role-aware stub page. The real sidebar, header controls, and navigation belong to the App Shell story.
- Password reset / forgot-password, MFA/2FA, OAuth/SSO, self-registration. **No public `POST /api/register` route.**
- **Admin CRUD for users and roles** — that is the Users & Roles Administration story. This story seeds the initial Administrator and defines the role enum.
- Ticket create/update/assign/escalate, and the audit-log **reading** UI. This story writes audit rows and reads tickets only.
- Arabic string catalogues. The login screen must be theme- and direction-correct (Task 8); translated content lands with the Internationalization story.

---

## Context — Read These Files First

1. `.squad/stories/authentication/authentication-access-control/intake.md` — the source story. Read the **Description** and **Acceptance criteria** blocks in full; the twelve criteria map onto the `## Done Criteria` checklist at the bottom. The `attachments/` folder is **empty** — there is nothing to open.
2. `STATUS.md` — read `## Current phase` (**lines 14–18**), `## Stack` (**lines 26–29**, contains the stale "PostgreSQL 17"), and `## Working agreement` (**lines 69–74**). The working agreement is binding on how this story is executed: **Claude guides and only executes on an explicit go-ahead.**
3. `docs/design/references/0.Login/` — **the login screen is designed; do not invent one.** Five exports, all verified to define the `.fv` focus-visible rule in `<style>` (the recurring class-omission bug documented in `STATUS.md` lines 49–53 does **not** affect these files — this was checked):
   - `WisalLogin-LightLTR.dc.html` — the default state. Read **lines 13–14** for the `.fv` rule and **lines 22–40** for the whole card.
   - `WisalLogin-DarkLTR.dc.html` — identical structure, dark palette.
   - `WisalLogin-Loading.dc.html` — adds `@keyframes spin` / `.spin` at **lines 15–16**; both inputs `disabled`, button reads **"Signing in…"** with a spinner.
   - `WisalLogin-ErrorInvalidCredentials.dc.html` — input borders switch to `#FECACA`, error row at **lines 36–39** reads **"Invalid email or password"** in `#DC2626` with a circle-alert icon.
   - `WisalLogin-ErrorRateLimited.dc.html` — inputs and button `disabled`, button fill drops to `#C7D2FE` with `cursor:not-allowed`, message reads **"Too many attempts. Try again in 47 seconds."**
4. `docs/design/brief.md` — read `## Design tokens — finalized` (**lines 62–133**) and copy `color_roles`, `typography`, `spacing`, and `radius` verbatim into CSS custom properties in Task 8. Then read:
   - `### Role-based home (Agent Dashboard)` (**lines 171–179**) — the authoritative role list and what each role's home shows.
   - `## Required states per view` (**lines 181–187**) — Loading / Empty / Error / Success are mandatory. The login form needs Loading and Error, and the design folder supplies both.
   - `## Accessibility` (**lines 189–197**) — **`outline: none` without a replacement is forbidden**; `prefers-reduced-motion` must be respected; color is never the only signal.
   - `## Internationalization` (**lines 199–206**) — theme follows `prefers-color-scheme` on first load; an explicit user choice persists and overrides it.
5. `docs/design/references/0.Dashboard/` — six exports, three roles × two themes (`WisalAgentDashboard-{Agent,TeamLead,Admin}-{Light,Dark}LTR.dc.html`). These are the **redirect targets** for outcome 1. Do not build them in this story; read `WisalAgentDashboard-Agent-LightLTR.dc.html` **line 34** only, for the header user block (`Sarah Ahmed` / `Senior Support Agent`) that Task 8's placeholder fills from `GET /api/user`.
6. `docs/design/references/1.app-shell/WisalAppShell-LightLTR.dc.html` — read the sidebar block at **lines 30–31** for nav item markup and labels (**Dashboard, Tickets, Customers, Knowledge Base, Channels, Reports, SLA Rules, Users**). **Ignore `1.app-shell/not-good/`** entirely — that directory is superseded.
7. `docs/requirements/client-requirements-raw.md` — read `### 10. Security & Administration` (**lines 85–89**) for the client's framing, and `## Conflict with prior work` (**lines 106–119**). That table references `docs/decisions/ADR-004-authentication.md`; **`docs/decisions/` does not exist** — verified, `docs/` contains only `design/` and `requirements/`. Task 2 creates it.
8. `.gitignore` — 8 lines, entirely inside a `# Managed by squad-kit` … `# End squad-kit block` fence. **Append below line 8; never edit inside the fence.**

---

## Task 0 — Resolve the PostgreSQL driver blocker (do this first)

`php artisan migrate` against PostgreSQL **will fail immediately** with `could not find driver`, and nothing in Task 3 onward works until this is settled. Do **not** attempt to weaken or work around the Application Control policy.

**Step 1 — confirm the blocker still stands.** In PowerShell:

```powershell
& "C:\Users\ibrah\.config\herd\bin\php84\php.exe" -m | Select-String 'pgsql'
```

Empty output means still blocked. If `pdo_pgsql` and `pgsql` appear, the policy was lifted — take **Path A** and skip the rest of Task 0.

**Step 2 — request the exemption.** This requires the machine's Application Control administrator; it is not self-serviceable. The two files to allow-list, with paths and sizes verified at plan time:

- `C:\Users\ibrah\.config\herd\bin\php84\ext\php_pdo_pgsql.dll` (52 224 bytes)
- `C:\Users\ibrah\.config\herd\bin\php84\ext\php_pgsql.dll` (131 584 bytes)

**Step 3 — pick the path and record it in the ADR (Task 2).**

| | **Path A — PostgreSQL** (preferred) | **Path B — SQLite locally, PostgreSQL as target** |
|---|---|---|
| Precondition | The exemption is granted | Exemption denied or pending |
| `DB_CONNECTION` | `pgsql` | `sqlite` locally, `pgsql` in CI/production |
| `audit_logs.context` | `jsonb` | `json` (TEXT under SQLite) |
| Risk | None | Driver-specific bugs surface late |

**Path B is a working fallback, not a stack change.** PostgreSQL remains the target per `STATUS.md` line 28. To keep the gap narrow, everything in this story is written driver-portably:

- Use `$table->json('context')` in the migration, **not** `$table->jsonb(...)`. On PostgreSQL, add the stronger type behind a driver check inside the migration's `up()`:

  ```php
  if (DB::connection()->getDriverName() === 'pgsql') {
      DB::statement('ALTER TABLE audit_logs ALTER COLUMN context TYPE jsonb USING context::jsonb');
  }
  ```

- **No raw SQL** anywhere else in this story. Query builder and Eloquent only.
- Under Path B, `api/.env` uses `DB_CONNECTION=sqlite` with `DB_DATABASE` pointing at an absolute path to `api/database/database.sqlite`; create that file before migrating.
- Under Path B, **every** Done Criteria item must be re-verified against PostgreSQL before this story is complete on the real target. Record that debt explicitly in the ADR's Consequences section.

Tests run on SQLite in both paths (`phpunit.xml` sets `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`), so the Test Plan is unaffected by which path is taken.

---

## Decision — Sanctum token mode, not cookie mode

The intake requires this be decided explicitly. It is decided here; Task 2 records it as an ADR.

**Decision: Laravel Sanctum in API-token mode. Bearer tokens in the `Authorization` header. Sanctum's SPA/cookie mode is rejected.**

| | Cookie mode (`EnsureFrontendRequestsAreStateful`) | **Token mode (chosen)** |
|---|---|---|
| Origin requirement | Frontend and API must share a **registrable domain** | None — any origin |
| Transport | Session cookie + `XSRF-TOKEN` | `Authorization: Bearer <token>` |
| Third-party-cookie deprecation | **Breaks** when origins differ | Unaffected |
| Server-side revocation | Session invalidation | `personal_access_tokens` row delete |

The intake states frontend and backend "run on different origins (separate hosting)". That fact alone disqualifies cookie mode. Token mode is origin-independent, and deleting a `personal_access_tokens` row satisfies the server-side-revocation criterion directly.

**Accepted trade-off and its mitigations.** A Bearer token reachable from JavaScript is exposed to XSS in a way an `httpOnly` cookie is not. Accepted, mitigated by all four of:

1. **Token lives in a module-scoped variable in memory, not `localStorage`** — the intake is explicit ("Token stored in memory (not localStorage) to avoid XSS exposure"). See Task 8 for the reload consequence.
2. `'expiration' => 480` (8 hours) in `config/sanctum.php`, so tokens expire even if revocation is missed.
3. A strict `Content-Security-Policy` (Task 7), so injected inline script cannot execute.
4. Never render server-supplied HTML with `dangerouslySetInnerHTML` anywhere in the auth flow.

**Do not** add Sanctum's stateful middleware, `SANCTUM_STATEFUL_DOMAINS`, or `/sanctum/csrf-cookie` calls. If they appear in scaffolded config, leave the key but do not route through it.

---

## Product rules — where this plan overrides the intake's technical hints

The intake's hints were written before the environment was verified. Each override below is deliberate; do not silently revert one.

| Intake says | This plan does | Why |
|---|---|---|
| "Laravel 11" | **Laravel 12** | Laravel Installer 5.31.1 is installed and produces Laravel 12. Installing 11 means fighting the installer for no benefit. |
| "Rate limiting … 5 attempts within 1 minute from the same IP" | 5/min keyed on **email + IP**, plus a looser 20/min per IP | Keying on IP alone makes one NAT'd office share a budget; keying on email alone lets an attacker lock a known user out from anywhere. Both limits together satisfy the criterion and close both holes. |
| "fewer than 8 characters" is below policy | `Password::min(8)` | Follow the intake's stated number. The other rules (`letters`, `mixedCase`, `numbers`, `uncompromised`) are additive and do not contradict it. |
| Role enforcement "use Laravel Policies and Gates" | `TicketPolicy` for the **action**, a query scope for the **rows** | A policy cannot filter rows; it answers yes/no on an action. Both are needed — the policy is not skipped. |
| Token "in memory … refresh handled via a silent re-login or a dedicated refresh-token flow if Sanctum supports it" | In memory, **no refresh flow**; a page reload returns the user to `/login` | Sanctum has no refresh-token primitive, and silent re-login requires storing the credential — which defeats the reason for keeping the token in memory. See Task 8 and Edge Cases. |

**One acceptance criterion needs care.** The intake requires both:

- "the error message does not reveal whether the email exists (no user enumeration)", and
- a deactivated user gets "a clear *account deactivated* message".

Taken naively these conflict — a distinct deactivated message confirms the address is registered. **Resolution: order the checks so the deactivated message is only reachable after the password has already been verified.** An attacker who does not know the password sees only the generic message; a legitimate user typing their own correct password gets the clear explanation the intake asks for. Both criteria are satisfied, neither is watered down. Task 6 implements exactly this order, and the code comment must say why, so a later reader does not "simplify" it.

---

## Implementation tasks

### 1 — Scaffold the monorepo

Run every command from **PowerShell** at the repo root `D:\work\algoriza\0.realwork\task\fullstack\fullstack-program\final-proj-crm-system`.

Target layout — two roots side by side:

```
api/    Laravel 12 application (PHP 8.4)
web/    React + TypeScript SPA (Vite)
docs/   unchanged
.squad/ unchanged
```

**Create the API:**

```powershell
laravel new api --no-interaction
cd api
composer require laravel/sanctum
php artisan install:api
```

When the installer prompts for a starter kit choose **none**, and for a testing framework choose **Pest**. `php artisan install:api` publishes `config/sanctum.php`, adds the `personal_access_tokens` migration, and creates **`api/routes/api.php`** — `laravel new` does not create that file on its own.

**Create the SPA:**

```powershell
cd ..
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install react-router-dom axios
npm install zod react-hook-form @hookform/resolvers
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

What each of the four non-obvious dependencies is for in **this** story — none is speculative, and each has a named use below:

| Package | Used by | For |
|---|---|---|
| `zod` | `features/auth/loginSchema.ts` | One schema that is both the runtime validator and the source of the form's TypeScript types. |
| `react-hook-form` + `@hookform/resolvers` | `features/auth/LoginPage.tsx` | Field state, submit handling, and the disabled/pending wiring the Loading state needs. The resolver package is what binds the zod schema to the form. |
| `@tanstack/react-query` | `features/auth/useLogin.ts` | The login mutation — `isPending` drives the Loading state, `error` drives the Error states, so the component holds no request state of its own. |
| `@tanstack/react-query-devtools` | `App.tsx` | Dev-only inspection. **Render it only under `import.meta.env.DEV`** so it never ships in `web/dist`.

**Client-side validation never replaces server-side validation.** The zod schema catches an empty or malformed email before a request is sent; every rule that matters for security — credentials, rate limit, deactivation, password policy — is enforced in Tasks 5 and 6 and re-asserted by the API tests. Do not move any of those checks into the schema.

**File: `.gitignore`** — append below **line 8** (`# End squad-kit block`). **Do not edit inside the fence.**

```gitignore
# Application
api/vendor/
api/.env
api/storage/*.key
api/public/storage
api/database/database.sqlite
web/node_modules/
web/dist/
web/.env.local
```

**File: `STATUS.md`** — three edits, per that file's own instruction to *replace* the phase line rather than append:

- **Lines 16–18** — replace the "Current phase" paragraph with the Story 01 execution state.
- **Line 29** — `PostgreSQL 17` → **`PostgreSQL 18`**, and add the Task 0 driver blocker in one sentence so a fresh session does not rediscover it.
- **Lines 39–47** — add rows for **`0.Login/`** (login: default, loading, invalid-credentials, rate-limited) and **`0.Dashboard/`** (role-based home: Agent, Team Lead, Admin).

### 2 — Record the authentication ADR

**Create file: `docs/decisions/ADR-004-authentication.md`** (creates the `docs/decisions/` directory, which does not yet exist).

`docs/requirements/client-requirements-raw.md` **line 118** cites this path as though it exists. Create it so the reference resolves.

Standard ADR shape:

- **Status** — Accepted, 2026-08-25.
- **Context** — separate origins for SPA and API; three internal roles; Customer Portal deferred as a distinct audience; the PostgreSQL driver blocker and which Task 0 path was taken.
- **Decision** — Sanctum token mode. Copy the comparison table and the four mitigations from the `## Decision` section above.
- **Consequences** — the in-memory token does not survive a page reload (accepted; see Task 8); 8-hour expiry; no cross-tab session sharing; the throttle counter is not reset on success; cookie mode remains available if the two apps are ever co-located on one registrable domain; **under Path B, the PostgreSQL re-verification debt.**

Note in **Context** that this ADR supersedes the "two user roles internal to the sales org" framing that `client-requirements-raw.md` line 118 attributes to an earlier ADR-004 — Wisal has **three** internal roles plus a deferred external Customer audience.

### 3 — Database: connection, schema, seed

**File: `api/.env`** — per the Task 0 path.

Path A:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=wisal
DB_USERNAME=postgres
DB_PASSWORD=<local postgres password>
FRONTEND_URL=http://localhost:5173
```

```powershell
psql -U postgres -c "CREATE DATABASE wisal;"
```

Path B: `DB_CONNECTION=sqlite` with `DB_DATABASE` set to the absolute path of `api/database/database.sqlite`; create the empty file first. Keep `FRONTEND_URL` either way.

**File: `api/database/migrations/0001_01_01_000000_create_users_table.php`** — ships with `laravel new`. Modify the existing `users` definition; do **not** add a second users migration:

- `$table->string('role')->default('agent');`
- `$table->boolean('is_active')->default(true);`
- `$table->timestamp('last_login_at')->nullable();`
- Keep `email` unique, and keep the existing `password` and `remember_token` columns.
- **Delete the `password_reset_tokens` table block.** Password reset is out of scope, and an unused table invites a route that does not exist.

**Create file: `api/app/Enums/UserRole.php`**

```php
<?php

namespace App\Enums;

enum UserRole: string
{
    case Agent = 'agent';
    case TeamLead = 'team_lead';
    case Administrator = 'administrator';

    public function label(): string
    {
        return match ($this) {
            self::Agent => 'Agent',
            self::TeamLead => 'Team Lead',
            self::Administrator => 'Administrator',
        };
    }

    /** Route the SPA redirects to immediately after login. */
    public function homeRoute(): string
    {
        return match ($this) {
            self::Agent => '/dashboard',
            self::TeamLead => '/dashboard/team',
            self::Administrator => '/dashboard/admin',
        };
    }
}
```

Three fixed roles are modelled as a **string column backed by a PHP enum**, not `spatie/laravel-permission`. The role set is closed and known; a permissions package adds four tables and a runtime cache for no gain here. **Do not install a permissions package.** The three values are binding — `docs/design/brief.md` lines 171–179 and all six `0.Dashboard/` exports assume exactly these three. **Never add a fourth role or rename one without updating every design reference.**

**Create file: `api/database/migrations/<ts>_create_audit_logs_table.php`**

```php
$table->id();
$table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
$table->string('event');                 // login.success | login.failed | login.inactive | logout
$table->string('email')->nullable();     // the submitted email, retained when user_id is null
$table->string('ip_address', 45)->nullable();
$table->text('user_agent')->nullable();
$table->json('context')->nullable();     // promoted to jsonb on pgsql — see Task 0
$table->timestamp('created_at')->useCurrent();
$table->index(['event', 'created_at']);
```

`user_id` is **nullable** so a failed login for an unknown email is still recorded. `ip_address` is 45 chars to hold a full IPv6 address. This is **the** audit table for the whole system — every later story appends to it. **Never create a second audit table.**

**Create file: `api/database/migrations/<ts>_create_tickets_table.php`** — minimum viable, purely to prove server-side scoping:

```php
$table->id();
$table->string('subject');
$table->string('status')->default('open');
$table->string('priority')->default('normal');
$table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
$table->timestamps();
$table->index('assigned_to');
```

Add a `// The Ticket Management story expands this table` comment above the schema closure. **Do not** add customer, channel, SLA, or message columns.

**File: `api/database/seeders/DatabaseSeeder.php`** — one user per role, one deactivated account, tickets split across two agents:

| Email | Role | `is_active` |
|---|---|---|
| `agent@wisal.test` | `agent` | `true` |
| `agent2@wisal.test` | `agent` | `true` |
| `lead@wisal.test` | `team_lead` | `true` |
| `admin@wisal.test` | `administrator` | `true` |
| `disabled@wisal.test` | `agent` | **`false`** |

Use one shared password that **passes** the Task 5 policy and is not breached — do **not** use `password`, which `uncompromised()` rejects. Assign at least two tickets to `agent@wisal.test` and at least two to `agent2@wisal.test`, so Test Plan item 4 proves **exclusion**, not just inclusion. Seed emails **lowercase only**.

### 4 — User model

**File: `api/app/Models/User.php`**

- Add `use Laravel\Sanctum\HasApiTokens;` to the trait list.
- Add `'role'` and `'is_active'` to `$fillable`.
- In `casts()` add `'role' => UserRole::class`, `'is_active' => 'boolean'`, `'last_login_at' => 'datetime'`. Keep `'password' => 'hashed'`.
- Add the helpers the policy and the query scope call:

```php
public function isAdministrator(): bool
{
    return $this->role === UserRole::Administrator;
}

public function canSeeTeamQueue(): bool
{
    return in_array($this->role, [UserRole::TeamLead, UserRole::Administrator], true);
}
```

**File: `api/config/sanctum.php`** — set `'expiration' => 480`.

### 5 — Password policy

**File: `api/app/Providers/AppServiceProvider.php`** — in `boot()`:

```php
Password::defaults(fn () => Password::min(8)
    ->letters()
    ->mixedCase()
    ->numbers()
    ->uncompromised());
```

`min(8)` follows the intake's stated threshold. `->uncompromised()` satisfies the known-breached criterion — it checks the password against the Have I Been Pwned range API using k-anonymity: only the first 5 characters of the SHA-1 hash leave the server, never the plaintext.

Laravel returns **one message per unmet rule**, which is exactly the "names the specific unmet rule" requirement. **Do not** collapse them into a generic "password too weak".

Apply as `'password' => ['required', 'confirmed', Password::defaults()]` wherever a password is **set**. **Do not apply the policy on the login route** — validating a login password against the policy would reject legitimate pre-existing passwords and leak policy state to an attacker.

### 6 — Auth endpoints

**Create file: `api/app/Http/Requests/LoginRequest.php`**

```php
public function rules(): array
{
    return [
        'email' => ['required', 'string', 'email', 'max:255'],
        'password' => ['required', 'string'],
    ];
}
```

**Create file: `api/app/Http/Controllers/Auth/AuthenticatedSessionController.php`**

`store(LoginRequest $request)` — **the order below is load-bearing.** Each step closes a specific leak; do not reorder.

```php
$email = Str::lower($request->email);
$user = User::where('email', $email)->first();

// Constant-work path: hash a dummy value when no user matched, so response
// timing does not distinguish "unknown email" from "wrong password".
$passwordOk = $user
    ? Hash::check($request->password, $user->password)
    : Hash::check($request->password, self::DUMMY_HASH);

if (! $passwordOk) {
    AuditLog::record('login.failed', $user, $request);
    throw ValidationException::withMessages([
        'email' => [trans('auth.failed')],   // "These credentials do not match our records."
    ]);
}

// Reached ONLY after the password is verified. Revealing deactivation here
// tells an attacker nothing they have not already proven they know, so the
// clear message the story asks for costs no enumeration. Do NOT move this
// check above the password check.
if (! $user->is_active) {
    // The Users & Roles Administration story: revoke tokens on deactivation.
    AuditLog::record('login.inactive', $user, $request);
    throw ValidationException::withMessages([
        'email' => ['This account has been deactivated. Contact your administrator.'],
    ]);
}

$user->forceFill(['last_login_at' => now()])->save();
$token = $user->createToken('spa')->plainTextToken;
AuditLog::record('login.success', $user, $request);

return response()->json([
    'token' => $token,
    'user' => new UserResource($user),
]);
```

`DUMMY_HASH` is a class constant holding one pre-computed bcrypt hash of an arbitrary string.

`destroy(Request $request)`:

```php
$request->user()->currentAccessToken()->delete();
AuditLog::record('logout', $request->user(), $request);

return response()->noContent();
```

Delete **only the current token**, never `$user->tokens()->delete()` — signing out of one browser must not sign the user out everywhere.

**Create file: `api/app/Http/Resources/UserResource.php`** — the shape the SPA consumes. Exposes role, never the password hash:

```php
return [
    'id' => $this->id,
    'name' => $this->name,
    'email' => $this->email,
    'role' => $this->role->value,
    'role_label' => $this->role->label(),
    'home_route' => $this->role->homeRoute(),
    'is_active' => $this->is_active,
];
```

`home_route` is what makes outcome 1's "role-appropriate dashboard" a server-owned fact rather than a `switch` duplicated in the SPA.

**Create file: `api/app/Models/AuditLog.php`** with a static

```php
public static function record(string $event, ?User $user, Request $request, array $context = []): void
```

writing `event`, `user_id`, the submitted `email`, `$request->ip()`, and `$request->userAgent()`. **Never** put the submitted password — or any part of it, or its length — into `context`.

**File: `api/routes/api.php`**

```php
Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);
    Route::get('/user', fn (Request $r) => new UserResource($r->user()));
    Route::get('/tickets', [TicketController::class, 'index']);
});
```

**File: `api/bootstrap/app.php`** (or `AppServiceProvider::boot()`) — register the named limiter:

```php
RateLimiter::for('login', fn (Request $request) => [
    Limit::perMinute(5)->by(Str::lower((string) $request->input('email')).'|'.$request->ip()),
    Limit::perMinute(20)->by($request->ip()),
]);
```

Laravel's `ThrottleRequests` returns **429** with a `Retry-After` header automatically — **do not hand-roll the response**; Task 8's countdown reads that header.

**Unauthenticated requests must return JSON 401, never an HTML redirect.** In `bootstrap/app.php`, the `withExceptions` closure must ensure `AuthenticationException` renders as JSON for `api/*`. Laravel 12 does this when the request carries `Accept: application/json`; the Axios instance in Task 8 sets that header on every request, but **do not rely on the client alone** — force it server-side so a curl without the header still gets JSON. This is a distinct acceptance criterion and Test Plan item 5 asserts it.

### 7 — CORS and security headers

**File: `api/config/cors.php`**

```php
'paths' => ['api/*'],
'allowed_methods' => ['*'],
'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')],
'allowed_headers' => ['*'],
'exposed_headers' => ['Retry-After'],
'supports_credentials' => false,
```

`supports_credentials` is **`false`** — a direct consequence of token mode; nothing here relies on a cookie crossing origins. **Do not set `'allowed_origins' => ['*']`.**

**`exposed_headers` must include `Retry-After`.** Without it the browser hides the header from JavaScript on a cross-origin response, and Task 8's "Try again in N seconds" silently degrades to a generic message on every real deployment while working fine in same-origin tests. This is the single easiest thing in this story to get wrong.

**Create file: `api/app/Http/Middleware/SecurityHeaders.php`** — append to every response; register globally in `api/bootstrap/app.php`:

```php
$response->headers->set('X-Content-Type-Options', 'nosniff');
$response->headers->set('X-Frame-Options', 'DENY');
$response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
$response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
```

The API serves JSON only, so `default-src 'none'` is correct here. This is mitigation 3 of the four in the `## Decision` section. The **SPA's** CSP is a separate header served by whatever hosts `web/dist` — out of scope for this story; note it in the ADR.

### 8 — Frontend: auth context, login screen, route guards

**Create file: `web/.env.local`** with `VITE_API_URL=http://localhost:8000/api`.

**Target layout — feature-first, not layer-first.** Everything auth-related lives in one folder; there is no top-level `src/auth/` and no `src/pages/`. Later stories add sibling folders (`features/tickets/`, `features/customers/`) and follow this shape:

```
web/src/
  lib/
    api.ts                  shared Axios instance — NOT feature-scoped
    queryClient.ts          shared QueryClient singleton
  features/
    auth/
      AuthContext.tsx       token + user state, login/logout
      RequireAuth.tsx       route guard
      LoginPage.tsx         the screen
      loginSchema.ts        zod schema + inferred types
      useLogin.ts           react-query mutation wrapping AuthContext.login
      AuthContext.test.tsx
      LoginPage.test.tsx
  App.tsx                   providers + routes
```

`lib/` holds what more than one feature will use. **Do not move `api.ts` into `features/auth/`** — every later feature imports it, and a shared module owned by one feature is how a circular import starts.

**Create file: `web/src/lib/api.ts`** — one Axios instance, the only place the token is attached:

```ts
// The token is held in a module-scoped variable, NOT localStorage or
// sessionStorage — see docs/decisions/ADR-004-authentication.md.
// Consequence: a page reload logs the user out. That is intended.
let accessToken: string | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
```

**Do not add a global 401 response interceptor that redirects.** It would fire on the login request's own error paths and fight the form's error rendering. `RequireAuth` owns redirection; components own their own error states.

**Create file: `web/src/lib/queryClient.ts`** — one `QueryClient`, created at module scope so `App.tsx` does not construct a new one on every render (a new client on re-render silently discards the cache):

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { retry: false },   // never retry a login — it burns throttle budget
  },
});
```

`mutations: { retry: false }` is load-bearing: a retried login counts as a second failed attempt against the 5/min limiter in Task 6, so a user who mistypes once would consume two attempts and hit **429** after three real mistakes.

**Create file: `web/src/features/auth/AuthContext.tsx`**

```ts
type User = {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'team_lead' | 'administrator';
  role_label: string;
  home_route: string;
  is_active: boolean;
};

type AuthState = {
  user: User | null;
  status: 'anonymous' | 'authenticated';
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};
```

- `login()` posts to `/login`, calls `setAccessToken(res.data.token)`, stores `user`, and **returns the user** so `LoginPage` can navigate to `user.home_route`.
- `logout()` calls `POST /api/logout` **first**, then clears the token and user — server first, so a network failure does not orphan a live token server-side with no client record of it. A **401 from logout must be treated as success** and still clear local state. It must also call **`queryClient.clear()`** — otherwise the next user to sign in on the same tab is served the previous user's cached `/api/tickets` rows out of the React Query cache, which is exactly the row-level leak Task 9 exists to prevent. **Server-side scoping does not protect a client-side cache.**
- There is **no `'loading'` status and no rehydrate-on-mount call to `GET /api/user`.** With an in-memory token there is nothing to rehydrate: a reload starts anonymous. Do not add a bootstrap request that can only ever 401.

**Create file: `web/src/features/auth/RequireAuth.tsx`** — redirects to `/login` when `status === 'anonymous'`. An optional `roles?: User['role'][]` prop renders a 403 view when the user's role is not listed.

State this in a comment in the file: **the `roles` prop is a UX affordance, not a security boundary.** Every protected resource is enforced server-side in Tasks 6 and 9. Hiding a nav item is not access control.

**Create file: `web/src/features/auth/loginSchema.ts`**

```ts
export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginValues = z.infer<typeof loginSchema>;
```

**`password` is `min(1)` here, not the Task 5 policy.** The login form validates only that a value was entered. Applying `min(8)`/`mixedCase`/`numbers` on the login screen would reject legitimate pre-existing passwords in the browser before a request is ever sent, and would advertise the policy to anyone who opens the page — the same reason Task 5 forbids applying the policy on the login route. The policy belongs on password **set** forms, which arrive with the Users & Roles Administration story.

**Create file: `web/src/features/auth/useLogin.ts`** — the mutation the screen renders from:

```ts
export function useLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }: LoginValues) => login(email, password),
    onSuccess: (user) => navigate(user.home_route),
  });
}
```

`AuthContext` stays the single owner of the token and the user; this hook only wraps it so the component reads `isPending` and `error` instead of hand-rolling request state. Do not duplicate token handling here.

**Create file: `web/src/features/auth/LoginPage.tsx`** — **build this from `docs/design/references/0.Login/`, not from imagination.** The four states are already designed; match them.

Wire the form with `useForm<LoginValues>({ resolver: zodResolver(loginSchema) })` and drive the four states from the two hooks:

| Designed state | Driven by |
|---|---|
| Default | `formState.errors` empty, `mutation.isIdle` |
| Loading | `mutation.isPending` |
| Error — invalid credentials / deactivated | `mutation.error` (an Axios 422) |
| Error — rate limited | `mutation.error` with `status === 429` |

Field-level zod messages render under their own input; the API's message renders in the design's error row. **These are two different surfaces — do not funnel a 422 from the server into `setError` on the email field**, or the server's message inherits the field styling and the designed error row never appears.

Structure, from `WisalLogin-LightLTR.dc.html` lines 22–40:

- Centred column, `width:400px`, `gap:24px`. Logo mark (two indigo circles, the `<svg>` at line 24) above the wordmark **"Wisal"** at 22px/700.
- Card: `background:#fff`, `border:1px solid #E2E8F0`, `border-radius:16px`, `padding:32px`, `gap:18px`.
- Heading **"Sign in"** (18px/700) with subtitle **"Use your Wisal work account"** (13px, `#64748B`).
- Labelled Email and Password inputs — 12.5px/600 labels, inputs `border-radius:8px`, `padding:10px 12px`, 14px. Set `autoComplete="email"` and `"current-password"`; the export omits these but they are required for password managers.
- Submit button: `background:#4F46E5`, white text, `border-radius:8px`, `padding:12px`, 14px/700, full width.
- Footer note: **"Accounts are provisioned by your administrator"**, 12px, `#94A3B8`. This is the design's own statement that there is no self-registration — consistent with the out-of-scope list.

**State fidelity — all four are specified in the exports; implement all four:**

- **Loading** (`WisalLogin-Loading.dc.html`): both inputs `disabled` with `background:#F8FAFC` and `color:#94A3B8`; button keeps its indigo fill at `opacity:0.85` with `cursor:not-allowed`, shows the 16px spinner SVG and the label **"Signing in…"**. Add `aria-busy="true"` — the export cannot express it. The export's `.spin` animation (lines 15–16) **must be wrapped in `@media (prefers-reduced-motion: reduce)`** to disable it; `brief.md` line 195 requires that, and the export does not honour it.
- **Error — invalid credentials** (`WisalLogin-ErrorInvalidCredentials.dc.html`): input borders to `#FECACA`, and a row above the button with the circle-alert icon and the message in `#DC2626` at 13px/600. Render the API's `errors.email[0]` **verbatim** rather than the design's hard-coded string — the server owns the wording, and the deactivated-account message arrives through this same channel. The icon is required: `brief.md` line 197 forbids color as the only signal.
- **Error — rate limited** (`WisalLogin-ErrorRateLimited.dc.html`): on **429**, disable both inputs, drop the button fill to `#C7D2FE` with `cursor:not-allowed`, and render **"Too many attempts. Try again in N seconds."** with N from the `Retry-After` header (the design shows 47). Tick N down once a second and re-enable the form at zero. Announce it in an `aria-live="polite"` region.
- **Success**: navigate to `user.home_route`.

**Accessibility, beyond what the exports encode:**

- Keep the `.fv` focus-visible rule from the exports (**line 13**): `outline:2px solid #4F46E5; outline-offset:2px; border-radius:4px`, and `#818CF8` in dark. The exports set `outline:none` on the inputs and rely on `.fv` to restore it — **if you copy the inline `outline:none`, you must copy the `.fv` rule too**, or you land exactly on the violation `brief.md` line 192 forbids.
- The error row needs `role="alert"` so it is announced.
- Associate every `<label>` with its input via `htmlFor`/`id`. The exports use bare `<label>` elements with no association.

**Theme and direction:**

- Light and dark come from the two exports. Read `prefers-color-scheme` on first load; honour a persisted explicit choice thereafter (`brief.md` lines 203–206). Dark surfaces: page `#121317`, card `#1C1D24`, border `#2A2C33`, body text `#F1F5F9`, muted `#94A3B8`, primary `#818CF8`.
- **Contrast defect to fix, not copy.** `WisalLogin-DarkLTR.dc.html` line 37 sets the dark button to `background:#818CF8` with `color:#fff`. `brief.md` line 71 verifies `#818CF8` at 6.23:1 as *foreground on `#121317`* — that is not the same measurement as white text *on* `#818CF8`, which is far lower and fails AA. Use a dark foreground (`#1C1D24`) on the `#818CF8` fill, verify the pair with a contrast checker, and note the export defect so the design file is corrected separately.
- **RTL now, not later.** Use CSS logical properties (`margin-inline-start`, `padding-inline`, `text-align: start`) throughout, so the Internationalization story only supplies strings. There is no RTL login export; logical properties are what make one unnecessary.
- **Mobile.** The exports are fixed 1200×800 artboards. That is a canvas, not a breakpoint. The card must be `width: min(400px, 100% - 32px)` so it is usable with no horizontal scroll on a 360px viewport — a distinct acceptance criterion.
- Radius note: the exports use 8px inputs and 16px card, while `brief.md` line 129 names `sm 6px · md 10px · lg 16px`. **Follow the exports** — they are the reviewed, later artifact. Do not silently retune them to the token scale.

**Create file: `web/src/App.tsx`** — providers first, then routes. **The nesting order below is required:**

```tsx
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>{/* … */}</Routes>
        </AuthProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- **`QueryClientProvider` outermost**, taking the singleton from `lib/queryClient.ts` — never `new QueryClient()` inline in the JSX.
- **`AuthProvider` inside `BrowserRouter`**, because `useLogin` calls `useNavigate`, which throws outside a router.
- **`ReactQueryDevtools` guarded by `import.meta.env.DEV`.** Vite statically replaces that expression, so the guarded branch is dropped from the production bundle entirely. An unguarded devtools panel ships an inspector of every cached response to end users.

Routes: `/login` public; `/dashboard` and `/tickets` wrapped in `RequireAuth`; `/dashboard/team` with `roles={['team_lead','administrator']}`; `/dashboard/admin` with `roles={['administrator']}`. These three targets must match `UserRole::homeRoute()` exactly, or the post-login redirect lands on a 404.

The app shell is **not** built here. Each dashboard route renders a placeholder showing the signed-in user's `name` and `role_label` — enough to prove outcome 1 — plus a sign-out button. The real shell is the App Shell story.

### 9 — Server-side ticket scoping

**Create file: `api/app/Models/Ticket.php`** with `$fillable = ['subject', 'status', 'priority', 'assigned_to']`, an `assignee()` `belongsTo(User::class, 'assigned_to')`, and the scope that carries the whole acceptance criterion:

```php
public function scopeVisibleTo(Builder $query, User $user): Builder
{
    return $user->canSeeTeamQueue()
        ? $query
        : $query->where('assigned_to', $user->id);
}
```

**Create file: `api/app/Policies/TicketPolicy.php`** — `viewAny()` returns `true` for all three roles (the *scope* narrows rows; the *policy* governs the action), and `view(User $user, Ticket $ticket)` returns `$user->canSeeTeamQueue() || $ticket->assigned_to === $user->id`.

**Create file: `api/app/Http/Resources/TicketResource.php`** exposing `id`, `subject`, `status`, `priority`, and the assignee's `id` and `name`. **Do not expose the assignee's email** — that hands an Agent a directory of colleagues' addresses from an endpoint that exists only to prove scoping.

**Create file: `api/app/Http/Controllers/TicketController.php`**

```php
public function index(Request $request)
{
    $this->authorize('viewAny', Ticket::class);

    return TicketResource::collection(
        Ticket::visibleTo($request->user())->latest()->paginate(25)
    );
}
```

**Filtering happens in the SQL `where`, never in PHP after fetching, and never in React.** An Agent's response must not contain another agent's ticket in any form — not hidden, not greyed out, not present-but-flagged. Test Plan item 4 asserts absence from the JSON payload.

**Team scoping is deliberately coarse in this story.** There is no `teams` table yet, so "the whole team's queue" is implemented as "all tickets". The moment a `teams` table exists, `scopeVisibleTo` must narrow the Team Lead branch to their team. Put that in a comment on the `canSeeTeamQueue()` branch so it is found by grep, and carry it into the Ticket Management story's overview.

---

## Edge Cases & Failure Modes

- **`pdo_pgsql` blocked (Task 0).** `php artisan migrate` fails with `could not find driver` and no migration runs — a clean failure, not a partial one. Expected behaviour: Task 0 resolves the path before Task 3 begins. **Do not disable or edit the Application Control policy.**
- **`uncompromised()` fails open when Have I Been Pwned is unreachable.** Laravel's `Uncompromised` rule treats a network error or timeout as *"not found in any breach"* and lets the password through. On an offline machine every password silently passes that rule. Accept it — failing closed would make password-setting impossible offline — but make it visible by logging a warning when the range API throws, wired in `AppServiceProvider` (Task 5). Test Plan item 3 must **fake the HTTP client** or it will pass for the wrong reason.
- **Login with no `email` field at all.** `LoginRequest` rejects with 422, but the `throttle:login` middleware computes its key **before** validation runs — `Str::lower(null)` yields `''`, pooling every field-less request into one shared `'|<ip>'` bucket. The `(string)` cast in the limiter closure is what keeps that from being a TypeError; the second per-IP limit is what keeps the shared bucket from being useful to an attacker. Do not remove either.
- **`Retry-After` invisible cross-origin.** Without `'exposed_headers' => ['Retry-After']` (Task 7) the browser strips the header from JavaScript's view, so the 429 countdown works in tests and degrades to a generic message in the deployed app. Test Plan item 5 asserts the header is exposed.
- **Throttle counter is not reset on success.** `Limit::perMinute(5)` decays on time only. A user who fails four times then succeeds still has one attempt of headroom for the rest of the minute. Accepted — resetting on success gives an attacker a way to clear the counter with one known-good credential. Record in the ADR consequences.
- **Deactivated mid-session.** Deactivating a user does **not** revoke tokens already issued; that user keeps working until their 8-hour token expires. Expected for this story — the `// The Users & Roles Administration story` comment at the `is_active` check marks the follow-up. Do not build it here.
- **Page reload signs the user out.** The in-memory token does not survive a reload, so F5 returns the user to `/login`. This is the accepted cost of mitigation 1 and the intake's explicit instruction. **Do not "fix" it by moving the token to `localStorage` or `sessionStorage`** — that reverses the ADR decision. If it proves unacceptable in review, the correct answer is a refresh-token flow decided in a new ADR, not a storage swap.
- **Two tabs.** Each tab has its own memory, so a second tab opens anonymous. Same root cause, same answer.
- **A second user signing in on the same tab.** The React Query cache outlives a logout unless it is explicitly cleared, so user B could be served user A's cached `/api/tickets` rows from memory with no request reaching the server. Server-side scoping (Task 9) cannot see this — the request never happens. `queryClient.clear()` in `logout()` is the fix, asserted by Test Plan item 6.
- **A retried login burns throttle budget.** React Query retries failed mutations by default. With the 5/min limiter in Task 6, one mistyped password would count as two attempts and a user would hit **429** after three real mistakes. `mutations: { retry: false }` in `lib/queryClient.ts` prevents it; Test Plan item 7 asserts the single call.
- **Logout with an already-expired or already-deleted token.** `auth:sanctum` rejects with 401 before `destroy()` runs, so `currentAccessToken()` is never null there. The SPA's `logout()` must therefore treat a 401 as **success** and clear local state anyway — otherwise a user holding a stale token can never clear it.
- **Unicode and casing in emails.** `users.email` is unique and case-sensitive in PostgreSQL. Normalise with `Str::lower()` on **both** the lookup in `store()` and the throttle key, or `Admin@wisal.test` and `admin@wisal.test` become two rate-limit buckets and one unfindable account.
- **Timing leak via the audit write.** `AuditLog::record()` must run on **both** the unknown-email path (`$user` is null) and the wrong-password path. If the implementation short-circuits when `$user` is null, the response-time difference re-opens enumeration and makes `DUMMY_HASH` theatre rather than a defence.
- **HTML 401 on an unauthenticated API call.** If `AuthenticationException` is not forced to JSON for `api/*`, Laravel redirects to a `login` **named route** that does not exist in an API-only app, producing a 500 instead of a 401 — a worse failure than the one the criterion guards against. Test Plan item 5 calls the endpoint **without** an `Accept` header specifically to catch this.
- **`intl` blocked.** If any dependency declares a hard `ext-intl` requirement, `composer install` fails on this machine. Nothing in this story's dependency list needs it. If it surfaces, record it and stop — do not change the policy.

---

## Test Plan

Pest is the API test runner (chosen in Task 1). Feature tests live in `api/tests/Feature/` and use `RefreshDatabase`. **No test files exist yet** — these are the first tests in the project and set the precedent later stories follow. Confirm `api/phpunit.xml` sets `DB_CONNECTION=sqlite` and `DB_DATABASE=:memory:` so the suite runs regardless of the Task 0 path.

1. **`api/tests/Feature/Auth/LoginTest.php`** (feature)
   - `it authenticates an active user and returns their role and home route` — 200, non-empty `token`, `user.role === 'agent'`, `user.home_route === '/dashboard'`.
   - `it returns an identical message for a wrong password and an unknown email` — perform both requests and assert **the two response bodies are equal**. Comparing each to a hard-coded string is weaker; equality is what "no enumeration" means.
   - `it reveals deactivation only after the correct password` — two assertions in one test: with the **wrong** password, a deactivated user's body equals the generic wrong-password body; with the **correct** password, the body names the deactivation. This is the test that proves the resolution in `## Product rules` actually holds, and the one most likely to be broken by a well-meaning refactor.
   - `it records a deactivated login attempt in the audit log` — an `audit_logs` row with `event = 'login.inactive'` exists.
   - `it blocks the sixth failed attempt within a minute with 429` — six posts; the first five 422, the sixth **429** with a `Retry-After` header.
   - `it does not let one email exhaust another email's throttle budget` — five failures for `a@…`, then one attempt for `b@…` must **not** be 429.
   - `it never writes the submitted password into the audit log` — fail a login with a distinctive password string, then assert it appears in no `audit_logs` column.
2. **`api/tests/Feature/Auth/LogoutTest.php`** (feature) — log in, capture the token, `POST /api/logout`, assert 204 and that `personal_access_tokens` no longer holds that row; then call `GET /api/user` with the same Bearer token and assert **401**. Re-using the revoked token is what proves "server-side, not just discarded client-side".
3. **`api/tests/Feature/Auth/PasswordPolicyTest.php`** (feature) — a dataset of failing passwords (7 characters / no digit / no uppercase) asserting the **specific** rule message returns, plus one case with `Http::fake()` returning a known-breached suffix, asserting rejection.
4. **`api/tests/Feature/TicketScopeTest.php`** (feature) — the criterion most likely to regress:
   - As `agent@wisal.test`, `GET /api/tickets` returns only their tickets; `assertJsonMissing` on `agent2@wisal.test`'s ticket subject.
   - As `lead@wisal.test`, the same call returns tickets from **both** agents.
   - As an Agent, assert `count($response['data'])` equals exactly the seeded count for that agent, so an off-by-one leak is caught.
   - Assert no `email` key appears in the payload's assignee object.
5. **`api/tests/Feature/ApiContractTest.php`** (feature) — the transport-level criteria, easy to lose in a refactor and invisible in the UI:
   - `it returns json 401 for an unauthenticated protected request` — `GET /api/user` with **no** `Accept` header; assert 401, a JSON content type, and **no** `Location` header.
   - `it exposes the Retry-After header to cross-origin callers` — assert `Access-Control-Expose-Headers` contains `Retry-After`.
   - `it sets the security headers on every response` (smoke) — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and the CSP header present on `GET /api/user`.
6. **`web/src/features/auth/AuthContext.test.tsx`** (unit, Vitest) — assert the token is **never** written to `localStorage` or `sessionStorage` on login (assert both stores are empty after a successful login), that `logout()` clears state even when `POST /api/logout` rejects with 401, and that **`logout()` empties the React Query cache** — seed the client with a `['tickets']` entry, log out, and assert `queryClient.getQueryData(['tickets'])` is `undefined`. That last one guards the cross-user cache leak described in Task 8.
7. **`web/src/features/auth/LoginPage.test.tsx`** (unit, Vitest + Testing Library) — one test per designed state, so the four exports are regression-guarded rather than eyeballed once. Render inside a `QueryClientProvider` with a **fresh `QueryClient` per test** (`retry: false`), or state leaks between tests and the 429 test passes off the previous test's cache:
   - `it disables both inputs and shows the signing-in spinner while the request is pending` — mock `login` to an unresolved promise; assert `disabled` on both inputs and `aria-busy` on the button.
   - `it renders the API's email error verbatim with an alert role` — mock a rejection carrying `errors.email[0]`; assert that exact text renders inside `role="alert"`.
   - `it renders the deactivated-account message when the API returns it` — the same channel, a different string; proves the SPA does not hard-code the design's "Invalid email or password".
   - `it renders a counting-down 429 message from Retry-After and re-enables the form at zero` — mock a 429 with `Retry-After: 3`; assert the seconds value renders and the form re-enables after the timer.
   - `it navigates to the home_route returned by the API` — assert an Agent lands on `/dashboard` and an Administrator on `/dashboard/admin`, driven by the response rather than a client-side switch.
   - `it keeps a visible focus ring on both inputs and the submit button` — tab through with `user-event`; assert the focus-visible class/attribute is applied. If jsdom cannot resolve computed CSS reliably, assert the class, not a computed outline.
   - `it blocks submission and shows a field error when the email is malformed` — type `not-an-email`, submit, assert the zod message renders under the email input and that **no request was made** (the mutation's `mutationFn` was never called). This is the only test that proves client-side validation runs before the network.
   - `it does not retry a failed login` — mock a 422 and assert the endpoint was called **exactly once**, proving `mutations: { retry: false }` is in effect. Without it a mistyped password silently burns two of the five throttle attempts.
   - Dark mode and RTL stay **manual** (Verification Step 8) — they depend on real `prefers-color-scheme` / `dir` behaviour jsdom does not render meaningfully. **Do not fake this coverage with a snapshot test that asserts nothing real.**

---

## Migration / Rollback

Three migrations land together: the modified `users` table, `audit_logs`, and `tickets`. There is no production data — the repo has no application code — so rollback is `php artisan migrate:fresh --seed`, not a reversal script.

Two things could still go wrong on a half-applied state:

- **`tickets` created before `users` is modified.** The `assigned_to` foreign key targets `users(id)`, which exists from the stock migration, so ordering is safe. Keep the default timestamp-prefixed ordering; do **not** rename migration files to force an order.
- **The `jsonb` promotion under Path A** (Task 0) runs as a separate `ALTER TABLE` after the column is created. If it fails, `audit_logs.context` is left as `json` — functional, just not indexable. Re-running `migrate:fresh` is the fix; there is no data to preserve.

Under **Path B**, deleting `api/database/database.sqlite` and re-running `migrate --seed` is a full reset.

---

## Verification Steps

Run PHP commands in **PowerShell**; Node commands work in either shell.

1. **Driver settled:** `& "C:\Users\ibrah\.config\herd\bin\php84\php.exe" -m | Select-String 'pgsql'` — either lists both extensions (Path A) or is empty and `api/.env` says `DB_CONNECTION=sqlite` (Path B). The chosen path is recorded in `docs/decisions/ADR-004-authentication.md`.
2. **Database ready:** Path A — `psql -U postgres -lqt` lists `wisal`. Either path — in `api/`, `php artisan migrate:fresh --seed` completes with no errors and seeds five users.
3. **Backend tests pass:** in `api/`, `php artisan test` — every Pest test from the Test Plan green, zero failures.
4. **Frontend tests pass:** in `web/`, `npx vitest run` — all green.
5. **API runs:** in `api/`, `php artisan serve` (binds `http://localhost:8000`). `curl -X POST http://localhost:8000/api/login -H "Content-Type: application/json" -d '{"email":"agent@wisal.test","password":"<seeded>"}'` returns 200 with a `token` and `"home_route":"/dashboard"`.
6. **Rate limit and JSON 401 are real:** repeat that curl with a wrong password six times — the sixth returns **429** with `Retry-After`. Then `curl -i http://localhost:8000/api/user` with **no** headers — **401** with a JSON body and no `Location` header.
7. **Frontend runs and scoping holds:** in `web/`, `npm run dev` (binds `http://localhost:5173`). Sign in as `agent@wisal.test` — the placeholder at `/dashboard` shows the user's name and "Agent". Open DevTools → Network → the `GET /api/tickets` response and confirm the **payload itself** contains no ticket assigned to `agent2@wisal.test`. Sign out, sign in as `lead@wisal.test`, land on `/dashboard/team`, and confirm both agents' tickets are present.
8. **Regression on states, theme, direction, and width:** on `/login`, compare each of the four states side by side with its export in `docs/design/references/0.Login/`. Load with the OS in dark mode — the page renders on `#121317`, never pure black, and the button label passes contrast on the `#818CF8` fill. Set `dir="rtl"` on `<html>` — the layout mirrors with no element overflowing. Narrow the viewport to 360px — no horizontal scroll. Enable "reduce motion" at the OS level — the signing-in spinner does not animate.

---

## Done Criteria

- [ ] Task 0 resolved and the chosen path recorded in the ADR; `php artisan migrate` succeeds.
- [ ] A registered active user submitting correct credentials receives a Bearer token and their role, and the SPA redirects to the `home_route` the **server** returned.
- [ ] A wrong password and an unknown email produce **identical** error responses, verified by an equality assertion rather than inspection.
- [ ] A deactivated user with the **correct** password is told the account is deactivated; with a **wrong** password they get the generic message, so the clear wording costs no enumeration. Both halves asserted in one test.
- [ ] The deactivated attempt is written to `audit_logs` as `login.inactive`, and no submitted password appears anywhere in `audit_logs`.
- [ ] The 6th failed login within one minute is rejected with **429**; the limiter is keyed on email **and** IP, so one email cannot exhaust another's budget.
- [ ] `Retry-After` is listed in `exposed_headers`, and the login screen counts down from it and re-enables the form at zero.
- [ ] Logout deletes the current `personal_access_tokens` row; the same Bearer token subsequently returns **401**.
- [ ] An unauthenticated request to a protected endpoint returns **401 with a JSON body and no `Location` header**, verified with no `Accept` header set.
- [ ] A password below policy is rejected naming the **specific** unmet rule; breached passwords are rejected via `uncompromised()`, tested against a faked HTTP client.
- [ ] An Agent's `GET /api/tickets` payload contains only their own tickets, filtered in the SQL `where` clause; a Team Lead sees both agents'. The payload exposes no colleague email addresses.
- [ ] The token is held in memory only — `localStorage` and `sessionStorage` are both asserted empty after login.
- [ ] Auth code lives in `web/src/features/auth/`; there is **no** `src/auth/` and **no** `src/pages/`. Shared `api.ts` and `queryClient.ts` stay in `web/src/lib/`.
- [ ] `App.tsx` wraps the app in `QueryClientProvider` with the singleton from `lib/queryClient.ts`, `AuthProvider` sits inside `BrowserRouter`, and `ReactQueryDevtools` is guarded by `import.meta.env.DEV` — confirmed absent from a `npm run build` bundle.
- [ ] The login form validates through a zod schema via `react-hook-form`, the schema does **not** carry the password policy, and a malformed email is rejected without a network request.
- [ ] Login mutations do not retry (`retry: false`), asserted by a single-call test, so one mistyped password costs one throttle attempt rather than two.
- [ ] `logout()` calls `queryClient.clear()`, asserted in `AuthContext.test.tsx`, so a second user on the same tab cannot read the first user's cached rows.
- [ ] All four login states match `docs/design/references/0.Login/`, each covered by a Vitest test; the `#818CF8`-fill contrast defect is fixed rather than copied, and the fix is noted for the design file.
- [ ] The login screen is usable at 360px with no horizontal scroll, mirrors under `dir="rtl"` via logical properties, and honours `prefers-reduced-motion`.
- [ ] `docs/decisions/ADR-004-authentication.md` exists and records the Sanctum **token-mode** decision, the rejected cookie-mode alternative, the four XSS mitigations, and the Task 0 database path.
- [ ] `STATUS.md` updated: phase line replaced, stack line corrected to **PostgreSQL 18** with the driver blocker noted, and `0.Login/` + `0.Dashboard/` added to the references table.
- [ ] `.gitignore` extended **below** the squad-kit fence to exclude `api/vendor/`, `api/.env`, `api/database/database.sqlite`, and `web/node_modules/`; **no `.env` file is committed.**
- [ ] The coarse team-scoping shortcut is marked with a comment in `scopeVisibleTo` and carried into the Ticket Management story's overview.
- [ ] `00-overview.md` and `00-index.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 02.**
