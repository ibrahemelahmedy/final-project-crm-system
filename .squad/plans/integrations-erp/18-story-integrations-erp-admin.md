# Story 18 — Integrations & ERP — Admin Connection Management (Story: WIS-19)

> **Full-depth plan.** Every path, line range, and symbol below was read from the working tree on
> 2026-09-03. Stories 01–02 and 06/08 (the patterns this story copies) are implemented and on disk.

## Prerequisites

- **Story 01 completed** ([`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md))
  — Sanctum bearer tokens, `UserRole`, `User::isAdministrator()`. Every endpoint here sits inside the
  `['auth:sanctum', 'active']` group at `api/routes/api.php:45`.
- **Story 02 completed** ([`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md))
  — the App Shell, the `navItems` manifest, and the `admin` nav group. **There is no `nav.integrations`
  entry yet** (`web/src/app/navigation/navItems.tsx` ends at line 113 with `nav.users`); this story adds
  the first one. Unlike Story 14, it is **not** replacing a `PagePlaceholder` — no `/integrations` route
  exists.
- **Story 06 completed** ([`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md))
  — **the closest precedent for the whole screen**: an admin-only card grid whose cards open a modal
  editor, with all four async states. `web/src/features/sla-rules/` is the shape to copy file for file.
- **Story 08 completed** ([`../users-roles-admin/08-story-users-roles-administration.md`](../users-roles-admin/08-story-users-roles-administration.md))
  — owns the three shared server-side facilities this story reuses and **does not re-implement**:
  the `administrator` middleware alias (`api/bootstrap/app.php:72`), the `/api/admin` route group
  (`api/routes/api.php:155–170`), and `App\Services\AuditTrail`.
- **Story 14 completed** ([`../channels-overview/14-story-channels-overview.md`](../channels-overview/14-story-channels-overview.md))
  — the honesty framing this story must stay consistent with, and the precedent for
  *"the API returns every enum case whether or not a row exists"*.
- **Story 15 completed** ([`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md))
  — `useT`, the namespace registry in `web/src/i18n/instance.ts`, and `formatRelative`.
- **Coordinate with Story 16 (WIS-17)** ([`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md))
  — that story is widening `web/scripts/i18n-allowlist.json`'s `roots` one feature at a time. This
  story ships `src/features/integrations` **already compliant** and adds that root itself, so WIS-17
  never has to retrofit it. Say so in the PR.

---

## Story Goal

An Administrator gets a real **Integrations** screen at `/integrations`, reached from a new sidebar
entry in the ADMIN group beneath **Users**, where they can:

1. See **all five integration types** — ERP, Email, SMS, WhatsApp, Custom API / Webhook — each with an
   unambiguous status pill: **Not connected**, **Connected**, or **Connection error**.
2. Open a **Connect / Configure** modal per type, enter an **endpoint URL** and an **API key / secret**,
   run **Test connection** *before* saving, and save.
3. Never see a stored secret in plaintext — not on screen, not in a network response, not in an audit
   row — including when re-opening **Configure** on an already-connected integration.
4. See a per-card audit strip recording when the connection was last verified, or that the last
   verification failed, with the failure reason.
5. **Disconnect** an integration, which deletes the stored configuration and its secret outright.

**Explicitly out of scope** (repeat these in the PR description, because the screen looks like it does
more than it does):

- **No provider-specific wiring.** No ERP field mapping, no message send or receive over Email/SMS/
  WhatsApp, no webhook receiver, no scheduled sync job. Nothing in this story reads or writes a
  `tickets` or `ticket_messages` row.
- **No change to Story 05 / Story 14.** Channel-message ingestion and the Channels Overview screen are
  untouched. `Channel` (`api/app/Enums/Channel.php`) is **not** modified.
- **No vendor branding.** Generic inline SVG icons only, drawn the same way `navItems.tsx` draws its
  own (`icon()` helper, `stroke="currentColor"`).
- **No OAuth**, no multi-account-per-type, no connection for a non-Administrator.

---

## Context — Read These Files First

1. `.squad/stories/integrations-erp/WIS-19/intake.md` — the scope contract. `attachments/` is empty;
   the design export below is the only visual reference.
2. `docs/design/references/18.WisalIntegrationsAdmin/WisalIntegrationsAdmin-LightLTR.dc.html` —
   **six artboards**, in file order: *MIXED (PRIMARY)* (one card in each of the three statuses),
   *EMPTY* (all five Not connected), *CONNECT MODAL — IDLE*, *CONNECT MODAL — TESTING*,
   *CONNECT MODAL — TEST FAILED*, *LOADING*. Read the card grid, the pill treatment, and the modal.
   **There is no page-level Error artboard** — see *Design gaps* below.
3. `docs/design/references/18.WisalIntegrationsAdmin/WisalIntegrationsAdmin-{LightRTL,DarkLTR,DarkRTL}.dc.html`
   — mirroring and theming reference. Port with logical properties (`inline-start`, `margin-inline`),
   never a second stylesheet and never a `[dir="rtl"]` override of a physical property.
4. **This export is clean.** Unlike the Story 14 and Story 08 exports, every class it uses (`fv`, `sk`
   only — the rest is inline `style=`) is defined in its own `<style>` block. The recurring
   `fv`/`fvd`/`sk` defect recorded in `STATUS.md` does **not** apply here. Verify once before porting,
   then stop looking for it.
5. `docs/design/brief.md` — `## Required states per view` (lines 181–188), `## Accessibility`
   (189–198), `## Internationalization` (199–207), `## Explicit anti-patterns` (208–221). Note
   *"Color is never the only signal for state"*: the three status pills each carry **text**, not just a
   colour.
6. `web/src/features/sla-rules/` — **read the whole folder; it is the template.** Specifically:
   - `pages/SlaRulesPage.tsx:22–97` — the four async states composed in one component, and modal state
     held in the URL (`?new=1` / `?edit={id}`) rather than in `useState`.
   - `components/SlaRuleFormModal.tsx:52–130` — the local-Zod-validate-then-mutate submit path.
   - `api/queryKeys.ts`, `api/slaRulesApi.ts`, `hooks/useSlaRules.ts`, `hooks/useSaveSlaRule.ts`,
     `index.ts` — the exact file split and the "`index.ts` is the only public surface" rule.
   - `pages/SlaRulesPage.test.tsx:1–60` — the render harness (`I18nextProvider` → `QueryClientProvider`
     → `MemoryRouter`) and the `vi.mock('../../../lib/api')` shape every page test in this repo uses.
7. `web/src/components/ui/Modal.tsx:22–28` — the **shared** modal. It already portals to `document.body`,
   traps focus, restores focus to the trigger, closes on Escape and backdrop, and releases the body
   scroll lock on unmount. **Use it.** Do not hand-roll a dialog the way `SlaRuleFormModal` does —
   that file predates `Modal` and is not the pattern to copy for chrome, only for the submit path.
8. `api/routes/api.php:155–170` — the admin group. The `administrator` gate is on the **group**;
   the new routes go inside it and receive the gate automatically.
9. `api/app/Http/Controllers/Admin/SettingsController.php:19–51` — the thin-controller shape for an
   admin resource: `authorize()` at the top of each action, a FormRequest for validation, a service
   for persistence + audit.
10. `api/app/Services/SystemSettings.php:143–177` — how `update()` writes inside `DB::transaction`
    and records **one audit row per key that actually changed**. The integration writer follows this.
11. `api/app/Services/AuditTrail.php:23–48, 55–94` — the event-name constants, `events()`, and
    `label()`. **Three lists to keep in step**; a constant added to one and not the others silently
    disappears from the audit viewer's filter.
12. `api/app/Enums/Channel.php` — read it to confirm the decision below: its five cases are
    `email, whatsapp, chat, sms, web_form`. **It is not the integration list** and must not be edited.
13. `api/tests/Feature/Admin/AdminAuthorizationTest.php:27–46` — `adminRoutes()` derives the URI list
    from the live router and substitutes only `{user}`. **This story must extend that substitution**
    — see *Backend task 7*.
14. `api/tests/Feature/ApiContractTest.php:97–107, 176–188` — the endpoint-shape contract tests.
15. `api/phpunit.xml` — tests run against **local PostgreSQL** (`wisal_testing`), not SQLite. The
    cross-engine SQL rules in `.squad/plans/00-index.md` still apply; nothing in this story needs
    engine-specific SQL.

---

## Product rules (from story) — current vs new behaviour

| | Today | After this story |
|---|---|---|
| Sidebar ADMIN group | SLA Rules, Users | SLA Rules, Users, **Integrations** |
| `/integrations` | route does not exist (falls through the `*` catch-all at `web/src/App.tsx:194` to `/dashboard`) | real screen, Administrator-only |
| Integration config | nowhere in the product | `integrations` table, one row per connected type |
| Channels Overview (`/channels`) | every channel reads *Not connected*, with a static admin notice | **unchanged** — it reports ticket origin, not configuration. See *Decision 3*. |

---

## Decisions taken in planning

These four are the judgement calls the intake left open. They are settled here; cite this section
rather than re-deciding during implementation.

### Decision 1 — a new `IntegrationType` enum, not a reuse of `Channel`

`Channel` is `email, whatsapp, chat, sms, web_form`. The integration list is
`erp, email, sms, whatsapp, api_webhook`. Two cases are missing from one and two from the other, so
they are **different sets that happen to overlap**, not one set seen twice. Reusing `Channel` would
force `chat` and `web_form` onto this screen with no meaning, and force `erp` into
`tickets.channel` — a column `ChannelOverviewController` aggregates. A new enum in
`api/app/Enums/IntegrationType.php` is the smaller change. **`Channel.php` is not edited.**

### Decision 2 — "Test connection" performs a real, provider-agnostic reachability check

The design's *TEST FAILED* artboard reads `Couldn't reach the endpoint. Check the URL and API key,
then try again.`, which a check that tested nothing would be lying about. The test therefore issues
**one real outbound HTTPS request** (`HEAD`, falling back to `GET` on 405) to the submitted endpoint,
with the secret in an `Authorization: Bearer` header, a 5-second timeout, and redirects disabled.

It verifies **reachability, not acceptance** — a 401 from the far side still proves the endpoint
exists. The pass condition is *"a response was received and its status is < 500"*; connection refused,
DNS failure, timeout, TLS failure, or 5xx is a fail. The UI copy says exactly this (`integrations.test.help`);
it must never claim the credential was accepted.

This is the one place in the story that talks to the outside world, so it carries an **SSRF guard**
(*Backend task 5*). It is not "provider wiring": nothing parses the response body, and no ticket data
moves in either direction.

### Decision 3 — "Last **checked**", not "Last **synced**"

The design export reads `Last synced 3 hours ago` / `Last sync failed`. **Nothing in this release
syncs.** Shipping that copy would fabricate a capability, which is precisely what Story 14's
*"honest not-connected state"* framing exists to prevent, and the intake names keeping the two screens
consistent as a dependency. The column is therefore `last_checked_at` / `last_check_failed_at` and the
copy is `Last checked {{when}}` / `Last check failed`, with a page-level notice stating that saving a
connection stores and verifies configuration only. **This is a deliberate deviation from the design
export** — record it in the PR body. Everything else in the export is ported verbatim.

### Decision 4 — Reveal / Copy act on the value in the input, never on a stored secret

The design places **Reveal** and **Copy** beside the secret field, and the *MIXED* artboard shows a
connected card whose field holds `sk_live_••••••••wX9L`. Rendering a stored secret — even partially —
is forbidden by the intake ("No plaintext secrets anywhere in the UI or API responses, **including on
an already-connected integration's Configure view**").

Reconciliation, which keeps both affordances honest:

- The API returns **`secret_last_four`** and nothing else about the secret. No prefix, no length, no
  ciphertext. (The export's `sk_live_` prefix is dropped: a provider-key prefix is itself a leak, and
  the story is provider-agnostic.)
- On **Configure** for a connected integration the secret input is **empty**, with
  `secret_last_four` rendered as static helper text below it: `Saved key ends in {{last4}}. Leave
  blank to keep it.` **Reveal and Copy are `disabled`** while the input is empty.
- The moment the admin types a new secret, Reveal and Copy enable and act on **that typed value**,
  which the browser already holds. Nothing round-trips.

---

## Design gaps to close during implementation

- **No page-level Error artboard.** The list fetch can fail. Render the existing error pattern —
  copy `web/src/features/sla-rules/components/SlaRulesError.tsx` — as `IntegrationsError`, with a
  `Retry` that calls `query.refetch()`. Do not invent new chrome.
- **No Disconnect control in any artboard.** *Story Goal* item 5 requires one, and without it a
  mistyped endpoint is unfixable-by-deletion. Place it as a **tertiary, destructive-styled** button in
  the modal footer's inline-start, visible only when the integration is connected or errored, and
  route it through the shared `ConfirmDialog` (`web/src/components/ui/ConfirmDialog.tsx`) naming the
  integration — `brief.md` line 186 requires a confirmation state naming the specific record.
- **No mobile artboard.** Reuse Story 04's `@media (max-width: 900px)` breakpoint — the one already at
  `web/src/index.css:3941`. Do not introduce a second breakpoint.

---

## Backend Tasks

All new PHP lives under `api/`. Every route added is inside the existing admin group, so **no new
middleware, alias, or gate is created**.

### 1 — The enum

**Create file:** `api/app/Enums/IntegrationType.php`

Model it on `api/app/Enums/Channel.php:5–26` — same `label()`-through-`__()` shape is **not** used
here, because per the Story 14 contract the display name travels as a `label_key` the SPA resolves
(see *Shared contracts*). The enum therefore carries no translation call.

```php
<?php

namespace App\Enums;

/**
 * Story 18 (WIS-19). The five integration types an Administrator can configure.
 *
 * Deliberately NOT App\Enums\Channel: that enum is `email, whatsapp, chat, sms,
 * web_form` and is the origin recorded on tickets.channel. This one adds `erp`
 * and `api_webhook` and drops `chat` and `web_form`. Two overlapping sets, not
 * one set seen twice — see Decision 1 in the story plan.
 */
enum IntegrationType: string
{
    case Erp = 'erp';
    case Email = 'email';
    case Sms = 'sms';
    case Whatsapp = 'whatsapp';
    case ApiWebhook = 'api_webhook';

    /** The i18n key the SPA resolves for the card title. */
    public function labelKey(): string
    {
        return 'integrations.type.'.$this->value.'.label';
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $t) => $t->value, self::cases());
    }
}
```

**Declaration order is the render order** — ERP, Email, SMS, WhatsApp, Custom API / Webhook, matching
the design's card grid. The controller never re-sorts.

### 2 — Migration

**Create file:** `api/database/migrations/2026_09_03_100000_create_integrations_table.php`

Follow the style of `api/database/migrations/2026_09_02_100100_create_portal_sessions_table.php:7–31`
— an anonymous class, a leading comment naming the story, an explicit `down()`.

```php
Schema::create('integrations', function (Blueprint $table) {
    $table->id();

    // One row per type. A type with NO row is "not connected" — the absence
    // IS the state, so disconnecting is a delete, not a status flag.
    $table->string('type', 32)->unique();

    $table->string('endpoint_url', 2048);

    // Laravel's `encrypted` cast (APP_KEY, AES-256-CBC). Ciphertext is ~1.4x
    // the plaintext plus a MAC envelope, so `text`, never a sized string.
    $table->text('secret')->nullable();

    // The ONLY thing about the secret that ever leaves the server.
    $table->string('secret_last_four', 4)->nullable();

    // 'connected' | 'error'. There is no 'not_connected' value — that state
    // is the absent row. A CHECK constraint is deliberately omitted (see the
    // cross-engine rule in .squad/plans/00-index.md); IntegrationStatus and
    // the FormRequest are the authority.
    $table->string('status', 16)->default('connected');

    // Decision 3: CHECKED, not SYNCED. Nothing in this release syncs.
    $table->timestamp('last_checked_at')->nullable();
    $table->timestamp('last_check_failed_at')->nullable();

    // The reachability failure reason, already localised at write time.
    // Never contains the secret — IntegrationTester strips headers.
    $table->string('last_error', 500)->nullable();

    $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

**No index beyond the unique `type`.** The table holds at most five rows.

### 3 — Model

**Create file:** `api/app/Models/Integration.php`

```php
class Integration extends Model
{
    protected $fillable = [
        'type', 'endpoint_url', 'secret', 'secret_last_four',
        'status', 'last_checked_at', 'last_check_failed_at',
        'last_error', 'connected_by',
    ];

    /**
     * `secret` is `encrypted` — Laravel encrypts on write and decrypts on
     * read with APP_KEY. It is in $hidden AND absent from every Resource, so
     * two independent things must both fail before it can reach a response.
     */
    protected $hidden = ['secret'];

    protected function casts(): array
    {
        return [
            'type' => IntegrationType::class,
            'secret' => 'encrypted',
            'last_checked_at' => 'datetime',
            'last_check_failed_at' => 'datetime',
        ];
    }

    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by');
    }
}
```

**Add a docblock warning:** `toArray()` / `toJson()` on this model must never be returned directly —
always go through `IntegrationResource`. `$hidden` covers the accidental case; the Resource is the
intended path.

**Rotating `APP_KEY` makes every stored secret undecryptable.** Reading a row whose ciphertext no
longer decrypts throws `DecryptException`. Handle it where it can happen — only
`IntegrationTester` reads the plaintext — and surface it as a normal connection error
(*Edge Cases*).

### 4 — Status enum

**Create file:** `api/app/Enums/IntegrationStatus.php`

```php
enum IntegrationStatus: string
{
    case NotConnected = 'not_connected';  // no row exists
    case Connected = 'connected';
    case Error = 'error';
}
```

`NotConnected` is never persisted — it is what the Resource reports for a type with no row. Keeping it
in the enum means the API's three-value contract is expressed in one place instead of a string literal
in the Resource.

### 5 — The connection tester

**Create file:** `api/app/Services/IntegrationConnectionTester.php` (interface)

```php
interface IntegrationConnectionTester
{
    /** @return array{ok: bool, status: int|null, error: string|null} */
    public function test(string $endpointUrl, ?string $secret): array;
}
```

**Create file:** `api/app/Services/HttpIntegrationTester.php` (implementation)

Bind the interface to it in `api/app/Providers/AppServiceProvider.php::register()` (add after line 45,
alongside the `PortalCodeNotifier` binding, following that comment style). The seam exists so every
test in the suite can swap in a fake and **no test ever makes a real outbound request**.

Behaviour, in order:

1. **Scheme guard** — reject anything but `https`. `http`, `file`, `gopher`, `ftp` → fail with
   `integrations.error.scheme` before any resolution.
2. **SSRF guard** — resolve the host and reject a private, loopback, link-local, or reserved address:
   `filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)`.
   Reject a bare-IP host and a hostname with no dot (`localhost`, container names). This endpoint is
   an authenticated Administrator asking the server to fetch a URL they chose — the classic SSRF
   shape. **Do not skip this.**
3. `Http::withOptions(['allow_redirects' => false])->timeout(5)->connectTimeout(3)`, plus
   `->withToken($secret)` when a secret is present. `HEAD` first; on `405`/`501`, retry once with `GET`.
4. **Pass** = a response arrived with `status() < 500`. **Fail** = any transport exception, or `>= 500`.
5. On failure return a **translation key**, not a raw exception message — a Guzzle message can embed
   the request headers, and the headers carry the secret. Map to
   `integrations.error.{scheme,blocked_host,unreachable,server_error}`. `last_error` stores the
   resolved string; assert in a test that it never contains the secret.

`guzzlehttp/guzzle` is already installed (`api/vendor/guzzlehttp/guzzle`, pulled by
`laravel/framework ^13.17`), so `Http::` works with no composer change.

### 6 — Requests, Resource, Controller

**Create file:** `api/app/Http/Requests/SaveIntegrationRequest.php`

```php
public function rules(): array
{
    return [
        'endpoint_url' => ['required', 'string', 'max:2048', 'url:https'],
        // Nullable on PURPOSE: an update that omits it keeps the stored
        // secret (Decision 4 — the field renders empty on Configure).
        'secret' => ['nullable', 'string', 'min:8', 'max:512'],
    ];
}
```

`authorize()` returns `true`; the group middleware is the gate.

**Create file:** `api/app/Http/Requests/TestIntegrationRequest.php` — same two rules, both applied to
the *submitted* values so **Test connection works before the first save**.

**Create file:** `api/app/Http/Resources/IntegrationResource.php`

Read `api/app/Http/Resources/SlaRuleResource.php:8–30` for the shape. **`secret` does not appear.**
The Resource is constructed from an array (`['type' => IntegrationType, 'model' => ?Integration]`) so
it can render a not-connected type that has no row — the same "always return every enum case" contract
Story 14 established.

**Create file:** `api/app/Http/Controllers/Admin/IntegrationController.php`

Namespace `App\Http\Controllers\Admin`, matching `SettingsController`. Four actions:

| Action | Route | Behaviour |
|---|---|---|
| `index` | `GET /api/admin/integrations` | Iterate `IntegrationType::cases()`, left-join the ≤5 rows fetched in **one** `Integration::query()->get()->keyBy('type')`. Never five queries. |
| `save` | `PUT /api/admin/integrations/{type}` | `updateOrCreate` on `type`. Writes `secret` + `secret_last_four` only when the request supplies a secret. Runs the tester and stores the outcome in `status` / `last_checked_at` / `last_check_failed_at` / `last_error`. **Saves even when the test fails**, with `status = error` — the design's *Connection error* card and its `Reconnect` button only exist if a failed config persists. |
| `test` | `POST /api/admin/integrations/{type}/test` | Test-only, **writes nothing**. Falls back to the stored `endpoint_url` / `secret` for any field the body omits. Returns `{ ok, error_key }`. |
| `destroy` | `DELETE /api/admin/integrations/{type}` | Deletes the row. Returns `204`. |

Resolve `{type}` with `IntegrationType::tryFrom($type) ?? abort(404)` at the top of each action —
**do not add a `->whereIn()` route constraint** (*Backend task 7* explains why).

Each action starts with `$this->authorize(...)` against a new `IntegrationPolicy`, mirroring
`SettingsController.php:31,38`. The policy is redundant with the group middleware **on purpose**: the
route gate protects the URL, the policy protects the action if it is ever called from elsewhere, and
`SlaRulePolicy` set that precedent.

**Create file:** `api/app/Policies/IntegrationPolicy.php` — copy `api/app/Policies/SlaRulePolicy.php`
verbatim in shape: `viewAny`, `update`, `delete`, each `return $user->isAdministrator();`. Laravel's
policy auto-discovery maps `Integration` → `IntegrationPolicy`; **no `Gate::policy()` line is needed**
in `AppServiceProvider` (that line exists at `AppServiceProvider.php:66` only because
`CustomerAttachment` maps to a differently-named policy).

### 7 — Routes

**File:** `api/routes/api.php`

Add the import beside the other `Admin\` imports (alphabetical — after `AuditLogController` on line 4):

```php
use App\Http\Controllers\Admin\IntegrationController;
```

Add inside the admin group, **after** the settings routes at line 169 and before the closing `});` on
line 170:

```php
        // ---- Integrations (Story 18, WIS-19) --------------------------
        //
        // {type} is INTENTIONALLY unconstrained. AdminAuthorizationTest
        // walks the live route list and substitutes only {user}; a
        // ->whereIn('type', ...) constraint would make the literal "{type}"
        // URI 404 before the administrator gate could 403, and the "denies
        // an Agent on EVERY /api/admin/* route" assertion would fail for
        // the wrong reason. The controller resolves the enum and aborts 404
        // on an unknown value, which is the same guarantee one layer in.
        Route::get('/integrations', [IntegrationController::class, 'index']);
        Route::put('/integrations/{type}', [IntegrationController::class, 'save']);
        Route::post('/integrations/{type}/test', [IntegrationController::class, 'test']);
        Route::delete('/integrations/{type}', [IntegrationController::class, 'destroy']);
```

**Then extend the test helper.** `api/tests/Feature/Admin/AdminAuthorizationTest.php:41` currently reads:

```php
$out[] = [$method, '/'.str_replace('{user}', (string) $targetId, $route->uri())];
```

Change it to substitute `{type}` as well, so the sweep exercises a real URI:

```php
$uri = str_replace(['{user}', '{type}'], [(string) $targetId, 'erp'], $route->uri());
$out[] = [$method, '/'.$uri];
```

Add `'PUT /api/admin/integrations/erp'`, `'POST /api/admin/integrations/erp/test'`,
`'DELETE /api/admin/integrations/erp'`, and `'GET /api/admin/integrations'` to the
`toContain` list at lines 51–58, and rename the test — it says *"the seven contracted admin
endpoints"* while already asserting eight.

### 8 — Audit trail

**File:** `api/app/Services/AuditTrail.php`

Add four constants after `KB_ARTICLE_ARCHIVED` (line 48), then add each to **both**
`events()` (lines 57–72) and `label()` (lines 77–92). All three lists must move together.

```php
/**
 * Story 18 (WIS-19). Connecting an external system is a sensitive admin
 * action. The context carries the TYPE and the ENDPOINT — never the secret,
 * and never secret_last_four.
 */
public const INTEGRATION_CONNECTED = 'integration.connected';
public const INTEGRATION_UPDATED = 'integration.updated';
public const INTEGRATION_DISCONNECTED = 'integration.disconnected';
public const INTEGRATION_TEST_FAILED = 'integration.test_failed';
```

Labels: `'Integration connected'`, `'Integration updated'`, `'Integration disconnected'`,
`'Integration test failed'`.

Write them from the controller through the injected `AuditTrail`, using
`AuditTrail::target('integration', $type->value, $type->value)` so the audit viewer's three canonical
keys are populated (`AuditTrail.php:115–122`). Follow `SystemSettings::update()` (lines 143–177): the
write and the audit row go inside one `DB::transaction`, and **`connected` vs `updated` is decided by
whether the row already existed**, not by a client flag.

### 9 — Factory + seeder

**Create file:** `api/database/factories/IntegrationFactory.php` — model it on
`api/database/factories/PortalAccessCodeFactory.php`. Default to a connected `erp` row with
`endpoint_url` `https://api.example-erp.test/v1`, `secret` a fake 32-char token, `secret_last_four`
its last four, `last_checked_at` `now()->subHours(3)`.

**No seeder entry.** A seeded integration would show a **Connected** card on a fresh install for a
connection that does not exist — the exact fabrication Story 14 exists to avoid. A fresh database
renders the *EMPTY* artboard, and that is correct.

---

## Frontend Tasks

All new code under `web/src/features/integrations/`, following the `sla-rules` folder split exactly.
`index.ts` is the only public surface.

### 1 — i18n namespace (do this first; every component below depends on it)

**Create files:** `web/src/i18n/locales/en/integrations.json` and
`web/src/i18n/locales/ar/integrations.json`.

**File:** `web/src/i18n/instance.ts` — add `enIntegrations` / `arIntegrations` imports (after line 18 /
line 34), `'integrations'` to `NAMESPACES` (line 38–54), and both entries to `resources` (lines 56–91).
**All four edits, or the namespace resolves to a humanised key.**

The English catalogue, with the binding copy from the export plus the Decision 3 deviations:

```json
{
  "title": "Integrations",
  "subtitle": "Connect Wisal to your ERP and communication providers",
  "notice": "Saving a connection stores its configuration and checks that the endpoint is reachable. Sending and receiving messages through these providers is not enabled in this release.",
  "status": {
    "not_connected": "NOT CONNECTED",
    "connected": "CONNECTED",
    "error": "CONNECTION ERROR"
  },
  "action": {
    "connect": "Connect",
    "configure": "Configure",
    "reconnect": "Reconnect",
    "viewDetails": "View details",
    "disconnect": "Disconnect"
  },
  "audit": {
    "lastChecked": "Last checked {{when}}",
    "lastCheckFailed": "Last check failed"
  },
  "type": {
    "erp": { "label": "ERP", "help": "Sync customer and order records from your ERP system into Wisal tickets." },
    "email": { "label": "Email", "help": "Receive and send support tickets through a connected email inbox." },
    "sms": { "label": "SMS", "help": "Send and receive customer replies over SMS." },
    "whatsapp": { "label": "WhatsApp", "help": "Handle customer conversations over WhatsApp Business." },
    "api_webhook": { "label": "Custom API / Webhook", "help": "Push and pull ticket data through a custom API endpoint." }
  },
  "form": {
    "connectTitle": "Connect {{type}}",
    "configureTitle": "Configure {{type}}",
    "endpointUrl": "Endpoint URL",
    "endpointPlaceholder": "https://api.your-erp.com/v1",
    "secret": "API key / secret",
    "reveal": "Reveal",
    "hide": "Hide",
    "copy": "Copy",
    "copied": "Copied",
    "savedHint": "Saved key ends in {{last4}}. Leave blank to keep it.",
    "test": "Test connection",
    "testing": "Testing…",
    "testHelp": "Checks that the endpoint responds. It does not verify that the provider accepts the key.",
    "testPassed": "The endpoint responded.",
    "cancel": "Cancel",
    "save": "Save"
  },
  "error": {
    "unreachable": "Couldn't reach the endpoint. Check the URL and API key, then try again.",
    "scheme": "The endpoint URL must start with https://.",
    "blocked_host": "That address is not reachable from the server. Use a public https endpoint.",
    "server_error": "The endpoint responded with a server error. Try again later.",
    "loadTitle": "Could not load the integrations",
    "loadBody": "Something went wrong while fetching them. Try again.",
    "retry": "Retry"
  },
  "disconnect": {
    "title": "Disconnect {{type}}?",
    "body": "The stored endpoint and API key for {{type}} are deleted. This cannot be undone.",
    "confirm": "Disconnect"
  }
}
```

The `error.*` keys are **the same key space the API returns** in `error_key` — the server sends
`integrations.error.unreachable`, the client resolves it. One sentence, one place, both languages.

`ar/integrations.json` mirrors every key. It is a **required deliverable**, not a follow-up: the
`missGuard` post-processor at `web/src/i18n/instance.ts:121–138` logs every key that renders an
English fallback under `ar`, and `noHardcodedStrings.test.ts` fails the suite on a literal.

**File:** `web/scripts/i18n-allowlist.json` — add `"src/features/integrations"` to `roots` (after
`"src/components"`, line 9) and remove nothing. Update the `_rootsNote` on line 11 to say Story 18
added its own root. No new `literals` or `patterns` entry is needed.

### 2 — Model + API layer

**Create file:** `web/src/features/integrations/model/types.ts`

```ts
export type IntegrationTypeValue = 'erp' | 'email' | 'sms' | 'whatsapp' | 'api_webhook';
export type IntegrationStatus = 'not_connected' | 'connected' | 'error';

/** Mirrors IntegrationResource exactly. There is no `secret` field, by design. */
export type Integration = {
  type: IntegrationTypeValue;
  label_key: string;
  status: IntegrationStatus;
  endpoint_url: string | null;
  secret_last_four: string | null;
  last_checked_at: string | null;
  last_check_failed_at: string | null;
  last_error_key: string | null;
};
```

**Do not** declare a local array of the five types. The list comes from the API response, exactly as
Story 14 requires for channels — a sixth type added to the PHP enum appears here with no TypeScript
change. The `type.*` i18n lookup is keyed off the response's `type`, and a value with no catalogue
entry falls back through `parseMissingKeyHandler` (`instance.ts:156–162`) rather than crashing.

**Create file:** `web/src/features/integrations/model/integrationSchema.ts` — a `createIntegrationSchema(t)`
factory, mirroring `web/src/features/sla-rules/model/slaRuleSchema.ts:18–42`. `t` is **required, not
optional** — that file's docblock records why.

```ts
export function createIntegrationSchema(t: (key: string) => string, requireSecret: boolean) {
  return z.object({
    endpoint_url: z.string().url().startsWith('https://', { message: t('error.scheme') }),
    secret: requireSecret
      ? z.string().min(8).max(512)
      : z.string().min(8).max(512).or(z.literal('')),
  });
}
```

`requireSecret` is `true` when connecting for the first time and `false` when reconfiguring — the
client mirror of the server's `nullable` rule in `SaveIntegrationRequest`.

**Create files:** `api/queryKeys.ts` (root `['integrations']`, **not** nested under `ticketKeys` —
`web/src/features/sla-rules/api/queryKeys.ts:1–14` records that reasoning), `api/integrationsApi.ts`
(four thin functions over the shared `api` axios instance from `web/src/lib/api.ts`, unwrapping the
`{ data }` envelope), `hooks/useIntegrations.ts`, `hooks/useSaveIntegration.ts`,
`hooks/useTestIntegration.ts`, `hooks/useDisconnectIntegration.ts`.

Save and disconnect invalidate `integrationKeys.all` **only** — unlike `useSaveSlaRule`, nothing here
changes a ticket, so `ticketKeys.all` is deliberately not invalidated.

`useTestIntegration` is a `useMutation` that invalidates **nothing** — the test writes nothing.

### 3 — Components

**Create:** `components/IntegrationIcon.tsx` — a `type → path-d` map rendering the same inline SVG the
sidebar uses (`web/src/app/navigation/navItems.tsx:15–27`), with a generic fallback glyph for an
unknown type. Generic geometry only: **no vendor logo, no brand colour** (intake constraint).

**Create:** `components/StatusPill.tsx` — three variants. Each renders the **translated status text**
plus a shape/icon, never colour alone (`brief.md:196–197`).

**Create:** `components/IntegrationCard.tsx` — `role="article"`, icon, title (`t(label_key)`), pill,
help line, primary action (`Connect` / `Configure` / `Reconnect` by status), and the audit strip:
`Last checked {{when}}` using `formatRelative` from `web/src/i18n` — never `toLocaleString`
(`web/src/i18n/index.ts` docblock).

**Create:** `components/SecretField.tsx` — the Decision 4 control. `type={revealed ? 'text' : 'password'}`,
a Reveal/Hide toggle and a Copy button that are **`disabled` while the input is empty**, and the
`savedHint` helper text rendered from `secret_last_four` when present. Copy uses
`navigator.clipboard.writeText(value)` inside a `try/catch` — it rejects on an insecure origin and in
jsdom. The reveal state resets to hidden whenever the modal closes.

**Create:** `components/IntegrationModal.tsx` — wraps the shared `Modal`
(`web/src/components/ui/Modal.tsx`), so focus trap, Escape, backdrop, and scroll lock come free. Local
state machine `'idle' | 'testing' | 'test_failed' | 'test_passed' | 'saving'`, matching the three modal
artboards plus the two states they imply. `Test connection` swaps to `Testing…` and disables itself and
`Save` while pending. On failure, render the banner with the resolved `error_key`. Footer, in DOM order:
`Disconnect` (destructive, connected/errored only) · spacer · `Test connection` · `Cancel` · `Save`.

**Create:** `components/IntegrationsSkeleton.tsx` and `components/IntegrationsError.tsx` — copy
`web/src/features/sla-rules/components/SlaRulesSkeleton.tsx` and `SlaRulesError.tsx` and rename the
class prefix. **No Empty component:** the API always returns five cards, so the *EMPTY* artboard is
just "five Not connected cards" — the success state, not an empty state. Say so in a comment or the
next reader will add a dead component.

### 4 — Page

**Create:** `pages/IntegrationsPage.tsx` — copy the structure of
`web/src/features/sla-rules/pages/SlaRulesPage.tsx:22–97`:

- `useT('integrations')`, `useSearchParams`, `useIntegrations()`.
- **Modal state in the URL**: `?configure=erp`. A reload and the back button both behave, per the
  project-wide rule that filter and modal state live in the URL.
- Four states: `query.isPending` → skeleton; `query.isError` → `IntegrationsError` with retry;
  otherwise the card grid. No fourth branch — see above.
- The page-level `notice` renders above the grid, always, in every state but loading.

**Create:** `index.ts` — `export { IntegrationsPage } from './pages/IntegrationsPage';` and nothing else.

### 5 — Wiring

**File:** `web/src/app/navigation/navItems.tsx` — append one entry after the `nav.users` object
(closing at line 112, before the `];` on line 113):

```tsx
  {
    labelKey: 'nav.integrations',
    label: 'Integrations',
    to: '/integrations',
    group: 'admin',
    roles: ['administrator'],
    icon: icon('M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4 M7 7h10v10H7z'),
  },
```

**File:** `web/src/i18n/locales/{en,ar}/common.json` — add the `nav.integrations` key beside
`nav.users`. The nav manifest is translated through the `common` namespace, not `integrations`.

**File:** `web/src/App.tsx` — add `import { IntegrationsPage } from './features/integrations';` after
line 27, and the route after the `/users/settings` block (ends line 193), inside the same
`RequireAuth`/`AppLayout` tree:

```tsx
                {/* Story 18 (WIS-19). Administrator-only. This guard is UX
                    only — the `administrator` middleware on the whole
                    /api/admin/* group is the boundary, and
                    AdminAuthorizationTest proves it. */}
                <Route
                  path="/integrations"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <IntegrationsPage />
                    </RequireAuth>
                  }
                />
```

**File:** `web/src/index.css` — append one section at the end (after line 3945), headed the way the SLA
section is at lines 3795–3800: a rule box naming the story and the design export, and stating which
tokens it reuses and that it defines none. Class prefix **`intg-`**. Reuse the existing
`@media (max-width: 900px)` breakpoint; add no new colour token — the three pill treatments come from
the status tokens already in the palette.

---

## Shared contracts this story establishes

Later stories cite this section; do not restate it from memory elsewhere.

**`GET /api/admin/integrations`** — `auth:sanctum` + `active` + `administrator`.

```json
{
  "data": [
    {
      "type": "erp",
      "label_key": "integrations.type.erp.label",
      "status": "not_connected",
      "endpoint_url": null,
      "secret_last_four": null,
      "last_checked_at": null,
      "last_check_failed_at": null,
      "last_error_key": null
    }
  ]
}
```

- **`data` is always all five types**, in `IntegrationType` declaration order, whether or not a row
  exists. A type with no row is `status: "not_connected"` with every other field `null`.
- **`secret` is not a field of this contract and never will be.** The only thing derived from the
  secret that crosses the wire is `secret_last_four`.
- `label_key` follows Story 14's convention; the SPA resolves it.
- `last_error_key` is an i18n key (`integrations.error.*`), never a raw exception message.

**`PUT /api/admin/integrations/{type}`** — body `{ endpoint_url, secret? }`. Returns the single updated
resource under `data`, plus `"test": { "ok": bool, "error_key": string|null }`. Omitting `secret` on an
already-connected integration **keeps** the stored one; there is no way to blank a secret except
`DELETE`.

**`POST /api/admin/integrations/{type}/test`** — body `{ endpoint_url?, secret? }`, each falling back to
the stored value. Returns `{ "ok": bool, "error_key": string|null }`. **Writes nothing** — not the row,
not `last_checked_at`, not an audit entry (a failed pre-save probe is not an event; a failed *save* is,
via `INTEGRATION_TEST_FAILED`).

**`DELETE /api/admin/integrations/{type}`** — `204`, row deleted, secret gone. Idempotent: deleting a
type with no row is also `204`.

**Route `/integrations`** — inside `AppLayout`, `RequireAuth roles={['administrator']}`.

**Frontend public surface** — `web/src/features/integrations/index.ts` exports `IntegrationsPage` only.

**`IntegrationType` is the single source of the integration list.** No second list exists — not a
constant, not a TypeScript array, not a seeder. `Channel` remains the single source of the *ticket
origin* list; the two are never merged.

---

## Edge Cases & Failure Modes

- **An unknown `{type}` in the URL** (`/api/admin/integrations/salesforce`). `IntegrationType::tryFrom()`
  returns `null` → `abort(404)` at the top of the action, before any query. Never a 500, never a row
  created with a junk type (the `unique` index on a bad value would be worse than the 404).
- **The literal URI `/api/admin/integrations/{type}`**, produced by `AdminAuthorizationTest`'s route
  sweep. Handled by *Backend task 7*: the route is unconstrained so the `administrator` middleware
  returns 403 before routing could 404. **If someone later adds `->whereIn('type', ...)`, that test
  breaks and the failure will look like an authorization bug.** The comment in `api.php` says so.
- **`Test connection` on a `http://` or `localhost` endpoint.** Rejected by the tester's scheme and
  SSRF guards (*Backend task 5*, steps 1–2) with `error.scheme` / `error.blocked_host` — **before**
  any socket is opened. An authenticated admin choosing a URL the server then fetches is the textbook
  SSRF shape; the guard is not optional.
- **A DNS name that resolves to a private address** (`internal.evil.test` → `10.0.0.5`). Caught by
  step 2, which validates the **resolved IP**, not the hostname string.
- **A Guzzle exception whose message embeds the request headers.** The `Authorization: Bearer <secret>`
  header would land in `last_error` and from there in the UI. The tester therefore **never** stores an
  exception message — it maps to a fixed key set. `IntegrationSecrecyTest` asserts the secret string
  appears in no response body, no `last_error`, and no `audit_logs.context`.
- **`APP_KEY` rotated after a secret was stored.** Reading `secret` throws `DecryptException`. Catch it
  in `HttpIntegrationTester::test()` and return `['ok' => false, 'error' => 'integrations.error.unreachable']`,
  so the card reads *Connection error* and the admin's fix — re-enter the key and save — is the correct
  one. Do not let it 500.
- **Saving with a failing test.** The row **is** persisted with `status = error`, `last_check_failed_at`
  set, and an `INTEGRATION_TEST_FAILED` audit row. Without this there is no way to reach the design's
  *Connection error* card or its `Reconnect` button.
- **`secret` omitted on a `PUT` for a type with no row.** The client schema requires it
  (`requireSecret: true`), but a direct API call can skip it. The server accepts it — an endpoint with
  no auth header is a legitimate configuration — stores `secret = null` and `secret_last_four = null`,
  and the tester sends no `Authorization` header. The modal renders no `savedHint` for that row.
- **Two administrators configuring the same type concurrently.** `updateOrCreate` on the `unique`
  `type` column: last write wins, no duplicate row, no 500 from a unique-constraint violation (the
  select-then-insert race resolves to an update). Both writes produce their own audit row, so the
  history is complete.
- **`navigator.clipboard` unavailable** (insecure origin, jsdom). `SecretField`'s Copy is wrapped in
  `try/catch`; on failure the button stays enabled and the `Copied` confirmation simply does not
  appear. No unhandled rejection, no crash.
- **A `type` returned by the API with no `integrations.type.*` catalogue entry** (a sixth enum case
  added server-side before the catalogue is updated). `t()` falls through `parseMissingKeyHandler`
  (`web/src/i18n/instance.ts:156–162`) to the humanised last segment and `missGuard` logs it. The card
  renders; nothing crashes.
- **A Team Lead navigating directly to `/integrations`.** `RequireAuth roles={['administrator']}`
  redirects in the SPA, and every underlying request would 403 regardless. The nav item is already
  hidden by `visibleNavItems` (`navItems.tsx:118–120`) — which is UX, not a boundary.
- **An `endpoint_url` at the 2048-character limit.** `max:2048` matches the column width; a longer
  value is a 422, never a silent truncation.
- **A slow endpoint.** `connectTimeout(3)` + `timeout(5)` caps a single test at ~8 seconds. The modal
  shows `Testing…` throughout and the request is not retried.

---

## Test Plan

### Backend — `api/tests/Feature/Admin/`

Pest, `uses(RefreshDatabase::class)`, following `AdminAuthorizationTest.php:8–18`. **Bind a fake
`IntegrationConnectionTester` in every test** — no test performs a real outbound request.

1. **`IntegrationListTest.php`** (new) — `GET /api/admin/integrations` returns exactly five entries in
   `IntegrationType` declaration order with a fresh database, every one `not_connected`; after one
   `erp` row is created via `Integration::factory()`, that entry reports `connected` and the other four
   are unchanged. Asserts `data.0.type === 'erp'`.
2. **`IntegrationSaveTest.php`** (new) — a `PUT` with a passing fake creates the row with
   `status: connected`, `last_checked_at` set, and `secret_last_four` equal to the last four typed
   characters; a second `PUT` **without** `secret` keeps the stored ciphertext (assert the decrypted
   value is unchanged) and updates `endpoint_url`; a `PUT` with a failing fake still persists the row
   with `status: error` and a populated `last_error`.
3. **`IntegrationSecrecyTest.php`** (new) — **the story's most important test.** With a known secret
   `sk_test_ABCDEFGH12345678` stored: assert the raw string appears in **none** of
   `GET /api/admin/integrations`, `PUT`'s response, `POST .../test`'s response,
   `GET /api/admin/audit-logs`, the `integrations.last_error` column, or any `audit_logs.context`.
   Assert `secret_last_four === '5678'` and that no response key named `secret` exists at any depth.
4. **`IntegrationTestConnectionTest.php`** (new) — `POST .../test` writes nothing (row count, and the
   row's `updated_at`, unchanged); it falls back to stored values when the body is empty; it returns
   `{ok: false, error_key: 'integrations.error.unreachable'}` for the failing fake.
5. **`IntegrationSsrfTest.php`** (new) — against the **real** `HttpIntegrationTester` with no HTTP
   faking needed, because every case must be rejected before a socket opens: `http://example.com`,
   `https://localhost/x`, `https://127.0.0.1/x`, `https://192.168.1.10/x`, `https://[::1]/x`, and a
   host resolving into a private range each return `ok: false` with `scheme` or `blocked_host`.
   Assert `Http::fake()` recorded **zero** requests.
6. **`IntegrationDisconnectTest.php`** (new) — `DELETE` removes the row and returns 204; a second
   `DELETE` is also 204; an `INTEGRATION_DISCONNECTED` audit row exists carrying `target_type`
   `integration` and `target_id` `erp`.
7. **`IntegrationAuditTest.php`** (new) — first save writes `integration.connected`, a second writes
   `integration.updated`, a failing save writes `integration.test_failed`; and every new constant
   appears in `AuditTrail::events()` **and** has a non-identity `AuditTrail::label()`. That last
   assertion is what catches the constant added to one list and not the other three.
8. **`AdminAuthorizationTest.php`** (modify) — apply the `{type}` substitution at line 41, extend the
   `toContain` list (lines 51–58) with the four new endpoints, and rename the `it(...)` description.
   The two sweeps then prove an Agent and a Team Lead get 403 on all four.
9. **`ApiContractTest.php`** (modify) — add one `it(...)` beside the existing admin block (lines
   176–188) asserting the `GET /api/admin/integrations` structure
   `['data' => [['type','label_key','status','endpoint_url','secret_last_four','last_checked_at','last_check_failed_at','last_error_key']]]`
   and, explicitly, `assertJsonMissingPath('data.0.secret')`.

### Backend — `api/tests/Unit/`

10. **`IntegrationTypeTest.php`** (new) — `IntegrationType::values()` is exactly
    `['erp','email','sms','whatsapp','api_webhook']` in that order, and no case value collides with a
    `Channel` case *identifier* in a way that would let one enum be substituted for the other. This is
    the guard on Decision 1.

### Frontend — `web/src/features/integrations/`

Vitest + Testing Library, harness copied from `web/src/features/sla-rules/pages/SlaRulesPage.test.tsx:1–60`.

11. **`pages/IntegrationsPage.test.tsx`** (new) — renders five cards from a mocked payload in the
    server's order; renders the skeleton while pending; renders the error state with a working
    `Retry` on rejection; `?configure=erp` opens the modal on mount and closing it clears the param.
12. **`components/SecretField.test.tsx`** (new) — **the Decision 4 test.** With `secret_last_four`
    set and an empty input, Reveal and Copy are both `disabled` and the `savedHint` is visible; typing
    enables both; Reveal switches the input `type` to `text` and shows exactly what was typed;
    unmounting and remounting resets to hidden.
13. **`components/IntegrationModal.test.tsx`** (new) — `Test connection` disables itself and `Save`
    and shows `Testing…` while pending; a failed test renders the banner and leaves `Save` enabled
    (saving a failing config is allowed); `Disconnect` is absent for a `not_connected` type and opens
    the `ConfirmDialog` naming the integration for a connected one.
14. **`web/src/i18n/noHardcodedStrings.test.ts`** (existing, no edit) — passes automatically once
    `src/features/integrations` is in `i18n-allowlist.json`'s `roots` and every string goes through
    `t()`. **Run it before opening the PR**; it is the gate on the i18n work above.

---

## Migration / Rollback

One additive migration, `create_integrations_table`. Nothing existing is altered — no column added to
`users`, `tickets`, or `settings`, and no enum widened.

- **Forward:** `php artisan migrate` in `api/`.
- **Rollback:** `php artisan migrate:rollback --step=1` drops `integrations`. **This destroys every
  stored configuration and secret, irreversibly** — the ciphertext lives nowhere else. Say so in the
  PR.
- **Half-applied state:** if the migration runs but the deploy is rolled back to code without
  `IntegrationController`, the table sits empty and unreferenced. Harmless — nothing else queries it.
  The reverse (code without the table) fails on the first `GET /api/admin/integrations` with a
  "relation does not exist" 500, so **migrate before deploying the frontend**.
- **`APP_KEY` is now load-bearing for stored data.** Rotating it silently invalidates every stored
  secret. Add a line to `docs/decisions/` or the deployment notes recording that — the codebase has no
  other `encrypted` cast today, so this is a new operational constraint.

---

## Verification Steps

1. **Backend migrates:** `cd api && php artisan migrate` — the `integrations` table is created with the
   unique `type` index.
2. **Backend tests:** `cd api && ./vendor/bin/pest` — the full suite. It was **419/419 green** before
   this story; every new and modified test above must pass with no pre-existing failure introduced.
   Targeted run while iterating: `./vendor/bin/pest tests/Feature/Admin --filter=Integration`.
3. **Backend lint:** `cd api && ./vendor/bin/pint --test app/ database/ tests/`.
4. **Frontend typechecks and builds:** `cd web && npm run build` (`tsc -b && vite build`).
5. **Frontend lint + i18n gate:** `cd web && npm run lint` — this runs `oxlint` **and**
   `npm run i18n:check`. The i18n check must pass with `src/features/integrations` in `roots`.
6. **Frontend tests:** `cd web && npm test`.
7. **Manual, as an Administrator:** `cd api && php artisan serve` and `cd web && npm run dev`.
   - Sidebar shows **Integrations** under ADMIN, beneath Users. Sign in as an Agent and as a Team
     Lead: the entry is absent and `/integrations` typed directly redirects.
   - `/integrations` renders five *Not connected* cards on a fresh database (the *EMPTY* artboard).
   - `Connect` on ERP → the modal. `Test connection` against `http://example.com` fails with the
     scheme message **without a network round-trip**; against `https://httpbin.org/status/200` it
     passes. Save. The card flips to **CONNECTED** with `Last checked a few seconds ago`.
   - Re-open `Configure`: the secret field is **empty**, `Saved key ends in ….` is shown, and Reveal
     and Copy are disabled until something is typed.
   - **Open DevTools → Network and read the `GET /api/admin/integrations` response body. There is no
     `secret` key and no plaintext key material anywhere in it.**
   - Save an unreachable endpoint → **CONNECTION ERROR** card with `Last check failed`.
   - `Disconnect` → confirm dialog naming ERP → the card returns to *Not connected*.
   - `/users/audit-log` shows `Integration connected`, `Integration updated`, `Integration test failed`,
     and `Integration disconnected` rows, **none of which contains the key**.
8. **Regression:** `/channels`, `/sla-rules`, and `/users` render unchanged — no nav regression, and
   `Channel` was not touched.
9. **RTL + dark:** switch to Arabic and to the dark theme. Card grid, pill placement, modal footer
   order, and the audit strip all mirror; every string is Arabic; nothing overflows at 375px width.

---

## Done Criteria

- [x] `IntegrationType` enum exists with exactly five cases in the design's render order, and
      `api/app/Enums/Channel.php` is unmodified.
- [x] `integrations` table exists: unique `type`, `text secret`, `secret_last_four`, `status`,
      `last_checked_at`, `last_check_failed_at`, `last_error`, `connected_by`.
- [x] `Integration::$casts` marks `secret` as `encrypted` and `$hidden` contains `secret`.
- [x] Four routes live inside the existing `/api/admin` group and inherit the `administrator` gate;
      no new middleware or alias was added.
- [x] `AdminAuthorizationTest` substitutes `{type}`, lists the four new endpoints, and its Agent and
      Team Lead sweeps pass.
- [x] **`IntegrationSecrecyTest` passes**: the stored secret appears in no API response, no
      `last_error`, and no audit row — including on `Configure` for a connected integration.
- [x] `secret_last_four` is the only secret-derived value that leaves the server, and it is four
      characters with no provider prefix.
- [x] `Test connection` performs a real reachability check, rejects non-`https` and private/loopback
      hosts before opening a socket, and `IntegrationSsrfTest` proves zero requests are made for those
      cases.
- [x] Saving a configuration whose test fails persists the row with `status: error` and renders the
      *Connection error* card with a working `Reconnect`.
- [x] Four `INTEGRATION_*` constants exist in `AuditTrail` and appear in **both** `events()` and
      `label()`; `IntegrationAuditTest` asserts it.
- [x] `Integrations` appears in the sidebar ADMIN group beneath `Users`, for Administrators only.
- [x] `/integrations` renders all four async states; the loading state is a skeleton, never a blank
      screen.
- [x] The modal renders the *idle*, *testing*, and *test failed* artboards, and closes on Escape, on
      backdrop click, and on Cancel, restoring focus to the card's button.
- [x] Reveal and Copy are disabled while the secret input is empty and act only on the typed value.
- [x] `Disconnect` deletes the configuration behind a `ConfirmDialog` that names the integration.
- [x] Copy reads **Last checked** / **Last check failed**, and the page carries the notice that message
      send and receive is not enabled in this release — consistent with `/channels` (Decision 3, and
      the deviation from the design export is recorded in the PR).
- [x] No vendor logo, brand name, or brand colour appears anywhere in the feature.
- [x] `web/src/i18n/locales/{en,ar}/integrations.json` are complete and key-for-key identical;
      `integrations` is registered in all four places in `web/src/i18n/instance.ts`.
- [x] `src/features/integrations` is in `web/scripts/i18n-allowlist.json`'s `roots` and
      `npm run lint` passes.
- [x] `cd api && ./vendor/bin/pest` and `cd web && npm test && npm run build` are all green.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 19.**
