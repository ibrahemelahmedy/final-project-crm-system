# Story 25 — Integration Data Sync: Inbound Customer Pull & Outbound Event Push (Story: WIS-24)

---

## Prerequisites

- **Story 18 completed** — [`../integrations-erp/18-story-integrations-erp-admin.md`](../integrations-erp/18-story-integrations-erp-admin.md).
  Owns `integrations`, `Integration`, `IntegrationType`, `IntegrationStatus`, `IntegrationResource`,
  `IntegrationPolicy`, `Admin\IntegrationController`, the four `/api/admin/integrations*` routes,
  the four `AuditTrail::INTEGRATION_*` constants, `web/src/features/integrations/**`, and — the
  load-bearing part — **`IntegrationConnectionTester` + `HttpIntegrationTester`, the only
  SSRF-guarded outbound HTTP path in this application.**
- **Story 03 completed** — [`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md).
  Owns `customers`, `Customer` and its mutators, `CustomerTier`, the two partial unique indexes.
- **Story 04 completed** (ticket-management, WIS-2) and **Story 13 completed** (csat-collection,
  WIS-14) — the three outbound event sources.
- **Story 06 completed** (sla-rules-automation, WIS-6) — `api/routes/console.php` and
  `EvaluateSlaCommand`, the **only** scheduled-command precedent in this repo and the pattern both
  new commands copy.
- **Stories 23 and 24 completed** (WIS-27, WIS-23) — the two established "no queue worker" deferral
  patterns: `DB::afterCommit` inside an observer, and `DB::afterCommit` + `app()->terminating()`
  + a per-process cap + a `$processed` id-set.
- **Coordinate with nothing.** This story is a leaf. Nothing in `.squad/pipeline.md` depends on it;
  WIS-22 (live channel ingestion) is next and touches message providers, not this engine.

---

## Story Goal

A connected integration stops being a saved URL and starts moving data.

1. **Inbound.** A scheduled command pulls customer records from a configured ERP collection
   endpoint, pages through them, maps remote fields onto Wisal fields with an admin-configured
   field map, resolves per-field conflicts with an admin-configured rule, and upserts by an
   external id. Running it twice over unchanged data writes **nothing** the second time.
2. **Outbound.** When a ticket is created, when a ticket is resolved, and when a CSAT response is
   submitted, a JSON payload is POSTed to the configured receiver. Delivery is durable: the event
   is written to a **persistent outbox inside the same database transaction as the business
   change**, attempted best-effort in-request, retried with backoff by a scheduled drain, and
   **dead-lettered** after N attempts.
3. **History.** Every run — inbound or outbound — writes a `sync_runs` row with records
   read / created / updated / skipped / failed and a capped, sanitised per-row error list. An
   administrator reads it on `/integrations`.
4. **One HTTP path.** Both directions go through the *existing* SSRF guard, extracted from
   `HttpIntegrationTester` into an injectable service and **re-validated at send time**, because a
   stored endpoint can be edited between configuration and dispatch.

**Not in scope** (restating the intake so the executor cannot drift): no vendor connector, no
two-way real-time sync, no inbound webhook receiver, no queue, no new dependency, no ticket/order
import, no `companies` table, no deletion propagation in either direction, no conflict-resolution
inbox, no secret in any new surface, no seeded integration or sync data.

---

## Context — Read These Files First

1. `api/app/Services/HttpIntegrationTester.php` — **read the whole file (79 lines).** Lines
   **21–48** are the guard you will extract: the scheme check (`:27`), the dotless-host check
   (`:34`), `gethostbyname()` and the failed-resolution check (`:38–44`), and the
   `FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE` check (`:46`). Lines **50–79** are the
   probe that stays behind. Note `:60–64` — the rule that a transport exception message can embed
   the `Authorization` header, so **never** persist `$e->getMessage()`.
2. `api/app/Services/IntegrationConnectionTester.php` — the seam docblock. Your new guard interface
   follows the same shape: an `error` that is always an **i18n key**, never a message.
3. `api/app/Models/Integration.php` — `$fillable` (`:32–36`), `$hidden` (`:38`), `casts()`
   (`:40–48`). You will extend both lists.
4. `api/database/migrations/2026_09_03_100000_create_integrations_table.php` — `type` is
   `string(32)->unique()` (`:19`), `endpoint_url` is `string(2048)` (`:22`), `secret` is `text`
   (`:27`), `last_error` is `string(500)` (`:47`). No CHECK constraints anywhere — the enum plus
   the FormRequest are the authority (`:36–39`).
5. `api/app/Http/Controllers/Admin/IntegrationController.php` — `index()` (`:37–48`, "all five
   types in declaration order, one query, never five"), `save()`'s transaction + audit `match`
   (`:66–105`), `destroy()`'s idempotent 204 (`:137–153`).
6. `api/app/Http/Resources/IntegrationResource.php` — `forType()` (`:26–29`) and `toArray()`
   (`:31–52`). You append a `sync` object; you do not restructure it.
7. `api/routes/api.php:208–220` — the admin integrations block. **Read the comment at `:210–216`:**
   `{type}` is deliberately unconstrained because `AdminAuthorizationTest` substitutes it.
8. `api/tests/Feature/Admin/AdminAuthorizationTest.php:36–58` — `adminRoutes()`. It substitutes
   **exactly four** placeholders. Grep it for `str_replace` and read the array. Then read `:60–85`
   (the contracted-endpoint list you extend) and `:87–117` (the three deny-everything sweeps that
   will call every new route).
9. `api/tests/Feature/Admin/IntegrationSsrfTest.php` — the whole file. It calls the **real**
   `HttpIntegrationTester` directly and asserts `Http::assertNothingSent()`. **Every one of these
   must stay green after the guard extraction, unchanged.**
10. `api/app/Models/Customer.php` — `$fillable` (`:20`), `$attributes = ['tier' => 'standard']`
    (`:27`), `setEmailAttribute` (`:38–43`), `setPhoneAttribute` (`:50–56`), `normalizePhone`
    (`:58–71`). The sync writes through the **model**, never a query-builder `upsert()`.
11. `api/database/migrations/2026_08_27_111743_create_customers_table.php:33–34` — the two raw
    `DB::statement` partial unique indexes. Your `(integration_id, external_id)` index copies this
    exact shape.
12. `api/app/Http/Controllers/CustomerController.php:88–101` — `store()` and the
    `QueryException` → duplicate mapping. Grep for `duplicateResponseFromQueryException`.
13. `api/app/Observers/TicketResolutionObserver.php` — the whole file. `:52–64` is how "status
    became Resolved" is detected (`wasChanged('status')` **then** `status !== Resolved`);
    `:38–46` is the per-process counter and its public reset; `:104–138` is
    `DB::afterCommit` + cap + `catch (Throwable)`.
14. `api/app/Observers/TicketClassificationObserver.php:41–100` — `DB::afterCommit` **inside**
    which `app()->terminating()` is registered (`:82–83`), the `$processed` id-set and **why it
    exists** (`:22–31`), and the `runningInConsole() && ! runningUnitTests()` guard (`:52`).
15. `api/app/Http/Controllers/CsatSurveyController.php:56–83` — `store()`. **The write at `:69–77`
    is a query-builder `update()`, so no Eloquent model event fires.** `:78` is the `$affected > 0`
    branch — the only correct place to enqueue `csat.submitted`.
16. `api/app/Http/Controllers/TicketController.php` — `store()` at `:65–121` (runs **outside** any
    transaction), `update()` at `:126–201` with the `DB::transaction` at `:188–194`, and `bulk()`
    at `:214–…` which loops inside one transaction over up to 100 ids
    (`api/app/Http/Requests/BulkTicketActionRequest.php:19`).
17. `api/routes/console.php:10–26` — the two scheduled commands, and the WIS-6 comment at `:14–17`
    that spells out the no-queue-worker constraint. Both new commands are registered here in the
    same style.
18. `api/app/Console/Commands/EvaluateSlaCommand.php:1–80` — the command shape: docblock explaining
    auto-discovery and the no-queue rule, a `--dry-run` option, `chunkById(200, …)`, and a
    `$this->info("label: {$count}")` per pass.
19. `api/app/Services/AuditTrail.php:57–70` (the four `INTEGRATION_*` constants), `:79–104`
    (`events()`), `:106–134` (`label()`), `:154–161` (`target()`). Constants are **added**, never
    renamed.
20. `api/config/ai.php:1–60` — the shape a new config file follows: env-backed, never throws,
    `config:cache` safe.
21. `api/app/Providers/AppServiceProvider.php:52–56` (the `IntegrationConnectionTester` bind — your
    guard bind goes beside it) and `:110–118` (`Ticket::observe(...)` × 2).
22. `api/tests/Pest.php:20–36` — `bindIntegrationTester()`; copy its shape for the guard binder.
    Read `:38–72` too: the controller-caching warning applies to any mid-test rebind.
23. `api/tests/TestCase.php:12–24` — `setUp()` and the two per-process counter resets already there.
24. `api/tests/Feature/ApiContractTest.php:216–235` — the integrations shape lock.
    `assertJsonStructure` is **not** exact, so appending keys will not break it; extend it anyway.
25. `web/src/features/integrations/components/IntegrationModal.tsx` — the whole file (175 lines).
    The `Phase` union at `:15`, the five-button footer at `:135–163`, the `ConfirmDialog` at
    `:166–175`.
26. `web/src/features/integrations/model/types.ts` — the `Integration` type and `unscopeKey()`
    (`:36–38`) with the docblock explaining why it exists.
27. `web/src/features/integrations/api/integrationsApi.ts` and `api/queryKeys.ts` — the shared
    Axios instance and `integrationKeys`.
28. `web/src/i18n/locales/en/integrations.json` — **line 4, `notice`**, currently states the
    opposite of this story, and the `error.*` block at the bottom that pins the four guard keys.
29. `web/src/index.css:4148–4274` — the `.intg-*` block. New styles append at `:4274`, before the
    `@media` rules at the end of that block.
30. Grep `Http::` across `api/app` — **exactly two hits**
    (`HttpIntegrationTester.php:53`, `Services/Ai/OpenAiCompatibleAssistGenerator.php:34`), neither
    using `->retry()`. There is no backoff helper to reuse; this story owns that design.

---

## Decisions

Each is a design decision the executor must implement as written, not re-litigate.

### Decision 1 — Extract the SSRF guard into an injectable service. `HttpIntegrationTester` delegates to it. Do **not** write a second HTTP path.

Done Criterion 5 says *"Every outbound request passes the **existing** SSRF guard."* The guard is
currently four inline checks inside `HttpIntegrationTester::test()` (`:21–48`) that cannot be
called without also performing a `HEAD`. So:

- New interface `App\Services\Integrations\OutboundUrlGuard` with one method:
  `validate(string $url): OutboundUrlVerdict`.
- New implementation `App\Services\Integrations\DnsOutboundUrlGuard` containing the four checks
  **moved verbatim**, returning the same four keys: `integrations.error.scheme`,
  `integrations.error.blocked_host`, `integrations.error.unreachable`, and `ok`.
- `HttpIntegrationTester` gains a constructor `public function __construct(private readonly
  OutboundUrlGuard $guard) {}` and replaces `:21–48` with one `$this->guard->validate(...)` call
  plus the same early returns. **Its public signature, its return array shape, and all four error
  keys are unchanged**, so `IntegrationSsrfTest.php` passes untouched — that is the regression proof
  the extraction was faithful.
- Everything in this story that opens a socket goes through **one** class,
  `App\Services\Integrations\OutboundHttpClient`, which calls the guard **at send time** on every
  request. A `Http::get(` / `Http::post(` written anywhere else under `api/app` is a defect.

Why an interface and not a plain class: `DnsOutboundUrlGuard` calls `gethostbyname()`. The
`IntegrationFactory` endpoint is `https://api.example-erp.test/v1`
(`api/database/factories/IntegrationFactory.php:31`) and `.test` does not resolve, so with the real
guard bound every happy-path sync test would fail with `unreachable` before `Http::fake()` saw
anything. A seam plus a Pest binder (Decision 10) makes the suite independent of DNS while the
guard's own tests still exercise the real implementation.

### Decision 2 — Outbound delivery is an **outbox table**, written inside the business transaction. Inline delivery is an optimisation, not the guarantee.

There is no queue worker (`api/routes/console.php:14–17`, `EvaluateSlaCommand`'s docblock,
`api/phpunit.xml:71` forcing `sync`). Three consequences, all mandatory:

1. **Enqueue is a plain insert inside the same transaction as the business change.** A rolled-back
   resolve takes its outbox row with it — no `DB::afterCommit` around the *insert*. This is the
   whole point of the outbox pattern and the only way Done Criterion 3 survives a 5xx.
2. **Inline delivery is deferred** with `DB::afterCommit(fn () => app()->terminating(fn () => …))`,
   exactly as `TicketClassificationObserver.php:82–100` does, so no caller waits on the receiver,
   and a rollback delivers nothing. It is bounded by
   `config('integrations.sync.outbound.inline_max_per_request')` (default **5**) — `POST
   /api/tickets/bulk` resolves up to 100 tickets in one transaction, and 100 synchronous POSTs in
   one request is the same failure WIS-27 answered with a cap. **The cap bounds attempts, never
   enqueues.** Every message not attempted inline is picked up by the scheduled drain.
3. **`sync:flush-outbox` is the real delivery guarantee.** Scheduled `everyFiveMinutes()
   ->withoutOverlapping(10)->runInBackground()`, mirroring `sla:evaluate`
   (`api/routes/console.php:24–26`).

### Decision 3 — Retries are **persisted**, not in-process. `attempts` + `next_attempt_at` + a permanent/retryable split.

Guzzle's `->retry()` lives inside one request; a dead-letter after 5 attempts spanning three hours
cannot. So the outbox row carries `attempts` and `next_attempt_at`, and every failed attempt
schedules the next from `config('integrations.sync.outbound.backoff')`
(`[60, 300, 900, 3600, 10800]` seconds). At `attempts >= max_attempts` (default **5**) the row
becomes `dead`. Outcome classification, which the executor must implement exactly:

| Outcome | Class | Result |
|---|---|---|
| 2xx | success | `delivered`, `delivered_at = now()` |
| 408, 429, 5xx | retryable | `attempts++`, `next_attempt_at = now + backoff[attempts-1]`, or `dead` at the cap |
| Connection/timeout exception | retryable | same |
| Any other 3xx/4xx | **permanent** | `dead` immediately, `last_error_key = integrations.sync.error.rejected` |
| Guard rejection at send time | **permanent** | `dead` immediately, `last_error_key` = the guard's key |

Retrying a 400 five times over three hours teaches nothing and burns the receiver. A 3xx counts as
permanent because the client sets `allow_redirects => false` (copied from
`HttpIntegrationTester.php:53`) — a redirect is an unvalidated hop and must never be followed.

**Backoff instants are computed in PHP and bound as a Carbon value.** No SQL `INTERVAL`
arithmetic — index cross-cutting rule.

### Decision 4 — Idempotency is a **unique `(integration_id, event_id)`** on the outbox, and **a zero-write no-op** on the pull.

- **Outbound:** every event carries a deterministic `event_id` — `ticket.created:{ticket_id}`,
  `ticket.resolved:{ticket_id}:{cycle}` where `cycle` is the CSAT resolution cycle already computed
  for that resolve (a re-resolve is a genuinely new event), and `csat.submitted:{survey_uuid}`.
  The enqueue is `insertOrIgnore`-shaped: catch the unique violation and return, exactly as
  `TicketResolutionObserver.php:112–124` handles its own race. **Double-enqueue is impossible.**
  Re-*delivery* of the same `event_id` is still possible (an attempt that timed out after the
  receiver committed); the `X-Wisal-Event-Id` header is how the receiver de-duplicates. We do not
  promise exactly-once on the far side and the plan says so.
- **Inbound:** the upsert key is `(integration_id, external_id)` on `customers`. For each remote
  record the sync builds the mapped attribute array, compares it field-by-field with the existing
  model, and when nothing differs performs **zero writes** — not even `external_synced_at`, which
  would otherwise dirty `updated_at` and make "idempotent" a lie. The row counts as `skipped`.
  Done Criterion 1 is then provable as: second run ⇒ `records_created = 0`, `records_updated = 0`,
  `records_skipped = N`, and `customers.updated_at` unchanged.

### Decision 5 — Field mapping and conflict rules are **two JSON columns on `integrations`**, not a table.

`inbound_field_map` and `conflict_rules`, both `json` nullable with Laravel's `array` cast.
Justification:

- The map is read **whole** (every pull loads all of it) and written **whole** (the admin saves the
  form). It is never queried by field, never joined, never sorted, never paginated.
- There are at most **five** integration rows, ever — `integrations.type` is `unique` and
  `IntegrationType` has five cases. A child table would hold at most ~25 rows and add a join,
  a second migration, a second model, a second policy surface and a second write path for zero
  query benefit.
- A `json` column is portable to both engines with the `array` cast; we never query *inside* it,
  which is the part that is not portable.

**Shape, frozen here:**

```jsonc
// inbound_field_map — Wisal field => dot path into the remote record
{ "external_id": "id", "name": "attributes.display_name", "email": "contact.email",
  "phone": "contact.phone", "company": "account.name", "tier": "segment" }

// conflict_rules — Wisal field => "remote_wins" | "wisal_wins"
{ "name": "remote_wins", "email": "remote_wins", "phone": "wisal_wins",
  "company": "remote_wins", "tier": "wisal_wins" }
```

The **writable-field whitelist is closed**: `name`, `email`, `phone`, `company`, `tier` — plus
`external_id`, which is the key and is not a conflict-rule participant. `SyncFieldMap::FIELDS`
is the single authority and the FormRequest validates the submitted keys against it. A remote
record is never splatted into `fill()`.

### Decision 6 — "Last-write-wins vs Wisal-wins" means **authority, not chronology**.

A literal clock comparison needs a trustworthy remote `updated_at`. An arbitrary ERP may not send
one, may send it in an unknown timezone, and cross-system clock skew makes the comparison unsafe
even when it does. So:

- **`remote_wins`** (the default for any mapped field with no rule) — the ERP is authoritative:
  the mapped value always overwrites the local one.
- **`wisal_wins`** — never overwrite a non-empty local value. If the local value is `null` or `''`,
  fill it; otherwise leave it and count the field as skipped in the run's tally reasoning.
- **On create the rule is moot** — nothing to conflict with, so every mapped field is written.
- A remote field that is **absent or `null`** in the record is never written, under either rule.
  Absence is not an instruction to blank a value.

This reading is recorded in the `ConflictRule` enum docblock so a reviewer sees the reasoning, not
just the behaviour.

### Decision 7 — Pagination is driven by **our** page counter against **our** validated URL. The response body never steers the next request.

Following a `links.next` URL from the response re-opens SSRF from *inside* a payload, after the
guard has already passed the configured URL. So the puller issues
`GET {inbound_url}?page={n}&per_page={page_size}` with `n` starting at 1, and stops on the first of:

- the page's record array is empty,
- `meta.has_more === false` (when the key is present),
- `n > config('integrations.sync.inbound.max_pages')` (default **50**),
- records read `>= config('integrations.sync.inbound.max_records_per_run')` (default **5000**).

Two response shapes are accepted and no others: a bare JSON array, or an object with a `data` array.
Anything else fails the run with `integrations.sync.error.bad_payload`. A body larger than
`config('integrations.sync.inbound.max_response_bytes')` (default **2 MiB**) fails the run with
`integrations.sync.error.payload_too_large` and is **not parsed**.

### Decision 8 — The two sync URLs are their **own absolute https columns**, not paths joined onto `endpoint_url`.

`integrations.endpoint_url` is the reachability-probe target (WIS-19, Decision 2 there:
reachability, not a resource). A collection endpoint and a webhook receiver are different
resources, and joining a stored path onto a stored base introduces traversal and
double-slash ambiguity for nothing. Two new columns, `inbound_url` and `outbound_url`, each
`string(2048)` nullable, each validated `url:https` by the FormRequest **and** re-validated by the
guard at send time. Neither defaults from `endpoint_url`.

### Decision 9 — `sync_runs` is one table for both directions, with the counter meanings documented in exactly one place.

Five counters serve both directions; the model's docblock is the authority and the frontend renders
direction-specific labels off the same columns.

| Column | Inbound meaning | Outbound meaning |
|---|---|---|
| `records_read` | remote records received | outbox messages picked up |
| `records_created` | customers inserted | messages delivered |
| `records_updated` | customers updated | (unused, `0`) |
| `records_skipped` | records identical / no-op | messages deferred to a later attempt |
| `records_failed` | records rejected | messages dead-lettered |

`status` is `running | success | partial | failed`: `partial` when `records_failed > 0` but the run
completed; `failed` when the run itself aborted (guard rejection, bad payload, transport failure on
page 1). A row is created with `running` **before** the first request and finished in a `finally`,
so a fatal never leaves a phantom `running` row for a completed run.

### Decision 10 — Every test drives `Http::fake()`, and the guard is bound to a fake for happy paths.

Add `bindOutboundUrlGuard(bool $allow = true, ?string $error = null)` to `api/tests/Pest.php`,
modelled on `bindIntegrationTester()` at `:26–36`. Happy-path sync tests bind the allowing fake and
assert on `Http::fake()` recordings. The security tests (Test Plan §G) bind **nothing**, keep the
real `DnsOutboundUrlGuard`, point an integration at `https://192.168.10.10/customers`, and assert
`Http::assertNothingSent()` plus a `failed` run — that is how Done Criterion 5 is proven, not by
reading the code.

### Decision 11 — Sync error strings stay **i18n keys resolved in the SPA**, following WIS-19.

The index's cross-cutting rule ("server-derived display copy is localised server-side") has one
established exception in this feature: `integrations.last_error` stores a key
(`create_integrations_table.php:44–46`), `IntegrationResource` emits it as `last_error_key`, and
`web/src/features/integrations/model/types.ts:36–38` strips the namespace before `t()`. This story
follows the feature's own convention — new keys under `integrations.sync.error.*` and
`integrations.sync.status.*` land in `web/src/i18n/locales/{en,ar}/integrations.json`, and **no
`api/lang/*/integrations.php` file is created.** Consistency inside one feature beats consistency
with a rule this feature already, deliberately, does not follow.

### Decision 12 — The manual "Run now" is synchronous and hard-capped; there is no background trigger.

`POST /api/admin/integrations/{type}/sync` runs the pull inline and returns the finished
`SyncRunResource`. It is administrator-only, admin-initiated, bounded by the same `max_pages` /
`max_records_per_run` / timeouts as the scheduled run, and marked `trigger = manual`. There is no
queue to hand it to, and inventing an "accepted, check back later" endpoint with nothing behind it
would be a lie.

---

## Backend Tasks

### 1 — `Create file: api/config/integrations.php`

Follows `api/config/ai.php`: env-backed, never throws, `config:cache` safe.

```php
<?php

/*
 * Story 25 (WIS-24). Every knob the sync engine reads. Nothing here throws and
 * nothing opens a connection — `artisan config:cache` must stay green.
 */
return [
    'sync' => [
        'inbound' => [
            'page_size' => (int) env('INTEGRATION_SYNC_PAGE_SIZE', 100),
            'max_pages' => (int) env('INTEGRATION_SYNC_MAX_PAGES', 50),
            'max_records_per_run' => (int) env('INTEGRATION_SYNC_MAX_RECORDS', 5000),
            // Bytes. A body larger than this fails the run and is never parsed.
            'max_response_bytes' => (int) env('INTEGRATION_SYNC_MAX_BYTES', 2 * 1024 * 1024),
            'timeout' => (int) env('INTEGRATION_SYNC_TIMEOUT', 15),
            'connect_timeout' => 5,
        ],

        'outbound' => [
            'max_attempts' => (int) env('INTEGRATION_OUTBOX_MAX_ATTEMPTS', 5),
            // Seconds before attempt N+1. Indexed by (attempts - 1); the last
            // entry repeats if max_attempts ever exceeds the array length.
            'backoff' => [60, 300, 900, 3600, 10800],
            // Messages ONE request may try to deliver inline. Bounds a
            // 100-ticket bulk resolve; never bounds the enqueue.
            'inline_max_per_request' => (int) env('INTEGRATION_OUTBOX_INLINE_MAX', 5),
            // Messages ONE `sync:flush-outbox` run drains.
            'batch_size' => (int) env('INTEGRATION_OUTBOX_BATCH', 100),
            'timeout' => (int) env('INTEGRATION_OUTBOX_TIMEOUT', 10),
            'connect_timeout' => 5,
            // Longest free-text field copied into a payload.
            'payload_max_chars' => 2000,
        ],

        // Per-row errors kept on a sync_runs row. The rest are counted only.
        'max_error_rows' => 50,

        // Master switch, OFF in tests (see api/phpunit.xml) so no existing
        // ticket/CSAT test starts enqueuing.
        'enabled' => (bool) env('INTEGRATION_SYNC_ENABLED', true),
    ],
];
```

### 2 — `Create file: api/app/Enums/SyncDirection.php`

```php
enum SyncDirection: string
{
    case Inbound = 'inbound';
    case Outbound = 'outbound';
}
```

Add `values(): array` mirroring `IntegrationType::values()` (`api/app/Enums/IntegrationType.php:29–32`).

### 3 — `Create file: api/app/Enums/SyncRunStatus.php`

`Running = 'running'`, `Success = 'success'`, `Partial = 'partial'`, `Failed = 'failed'`.
Docblock states Decision 9's rule: `partial` = the run finished with `records_failed > 0`;
`failed` = the run itself aborted.

### 4 — `Create file: api/app/Enums/SyncRunTrigger.php`

`Scheduled = 'scheduled'`, `Manual = 'manual'`.

### 5 — `Create file: api/app/Enums/OutboxStatus.php`

`Pending = 'pending'`, `Delivered = 'delivered'`, `Dead = 'dead'`. Docblock: `dead` is the
dead-letter state — either `attempts >= max_attempts` or a permanent rejection (Decision 3).

### 6 — `Create file: api/app/Enums/IntegrationEvent.php`

```php
enum IntegrationEvent: string
{
    case TicketCreated = 'ticket.created';
    case TicketResolved = 'ticket.resolved';
    case CsatSubmitted = 'csat.submitted';
}
```

Plus `values(): array`. This enum is the authority for the `outbound_events` array the admin
selects; the FormRequest validates against `IntegrationEvent::values()`.

### 7 — `Create file: api/app/Enums/ConflictRule.php`

`RemoteWins = 'remote_wins'`, `WisalWins = 'wisal_wins'`. **The docblock carries Decision 6
verbatim** — authority, not chronology, and why a remote `updated_at` is not trusted.

### 8 — `Create file: api/database/migrations/2026_09_09_120000_add_sync_columns_to_integrations_table.php`

```php
Schema::table('integrations', function (Blueprint $table) {
    // --- inbound -------------------------------------------------------
    $table->boolean('inbound_enabled')->default(false);
    // Absolute https collection URL. NOT derived from endpoint_url
    // (Decision 8). Re-validated by the guard at send time.
    $table->string('inbound_url', 2048)->nullable();
    // {wisal_field: "dot.path.into.remote"} — Decision 5.
    $table->json('inbound_field_map')->nullable();
    // {wisal_field: "remote_wins"|"wisal_wins"} — Decision 6.
    $table->json('conflict_rules')->nullable();
    $table->timestamp('last_inbound_sync_at')->nullable();

    // --- outbound ------------------------------------------------------
    $table->boolean('outbound_enabled')->default(false);
    $table->string('outbound_url', 2048)->nullable();
    // Subset of App\Enums\IntegrationEvent::values().
    $table->json('outbound_events')->nullable();
    $table->timestamp('last_outbound_sync_at')->nullable();
});
```

`down()` drops all nine columns in one `Schema::table`. **No CHECK constraints** — the migration at
`create_integrations_table.php:36–39` explains why (cross-engine rule); the enums and the
FormRequest are the authority.

### 9 — `Create file: api/database/migrations/2026_09_09_120100_create_sync_runs_table.php`

```php
Schema::create('sync_runs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('integration_id')->constrained('integrations')->cascadeOnDelete();
    $table->string('direction', 16);   // App\Enums\SyncDirection
    $table->string('trigger', 16);     // App\Enums\SyncRunTrigger
    $table->string('status', 16)->default('running'); // App\Enums\SyncRunStatus

    // See App\Models\SyncRun's docblock for the per-direction meaning of
    // each counter (Decision 9). Do not re-document it anywhere else.
    $table->unsignedInteger('records_read')->default(0);
    $table->unsignedInteger('records_created')->default(0);
    $table->unsignedInteger('records_updated')->default(0);
    $table->unsignedInteger('records_skipped')->default(0);
    $table->unsignedInteger('records_failed')->default(0);

    $table->timestamp('started_at')->nullable();
    $table->timestamp('finished_at')->nullable();

    // Run-level failure reason, ALWAYS an i18n key
    // (integrations.sync.error.*) — never a raw exception message. A
    // transport exception can embed the Authorization header
    // (HttpIntegrationTester.php:60-64).
    $table->string('error_key', 120)->nullable();

    // Per-row detail, capped at config('integrations.sync.max_error_rows'):
    // [{external_id, field, reason_key, detail}] with `detail` sanitised and
    // truncated. Never a payload, never a secret.
    $table->json('errors')->nullable();

    $table->timestamps();

    $table->index(['integration_id', 'started_at']);
    $table->index(['direction', 'status']);
});
```

Cascade delete is deliberate: WIS-19 makes disconnecting a `DELETE` of the row
(`IntegrationController::destroy()`), and orphaned run history for a deleted integration has no
reader.

### 10 — `Create file: api/database/migrations/2026_09_09_120200_create_integration_outbox_table.php`

```php
Schema::create('integration_outbox', function (Blueprint $table) {
    $table->id();
    $table->foreignId('integration_id')->constrained('integrations')->cascadeOnDelete();

    $table->string('event', 32);       // App\Enums\IntegrationEvent
    // Deterministic dedupe key — Decision 4. e.g. "ticket.resolved:412:2".
    $table->string('event_id', 120);
    // The exact JSON body POSTed, built once at enqueue so a later retry
    // sends what the event described, not what the row looks like today.
    $table->json('payload');

    $table->string('status', 16)->default('pending'); // App\Enums\OutboxStatus
    $table->unsignedTinyInteger('attempts')->default(0);
    $table->timestamp('next_attempt_at')->nullable();

    $table->unsignedSmallInteger('last_status')->nullable(); // HTTP status
    // i18n key only. Same rule as sync_runs.error_key.
    $table->string('last_error_key', 120)->nullable();

    $table->timestamp('delivered_at')->nullable();
    $table->timestamp('failed_at')->nullable();
    $table->timestamps();

    // The idempotency guarantee (Decision 4): one row per (integration, event).
    $table->unique(['integration_id', 'event_id']);
    $table->index(['status', 'next_attempt_at']);
});
```

A plain `unique()` is correct here (unlike `customers`) — there are no soft deletes on this table.

### 11 — `Create file: api/database/migrations/2026_09_09_120300_add_external_ref_to_customers_table.php`

```php
public function up(): void
{
    Schema::table('customers', function (Blueprint $table) {
        $table->foreignId('integration_id')->nullable()->constrained('integrations')->nullOnDelete();
        $table->string('external_id', 191)->nullable();
        $table->timestamp('external_synced_at')->nullable();
    });

    // Partial unique index — the schema builder has no API for these, and a
    // plain unique() would collide with soft-deleted rows. Same shape as
    // 2026_08_27_111743_create_customers_table.php:33-34. Valid on both
    // PostgreSQL and SQLite 3.8+.
    DB::statement('CREATE UNIQUE INDEX customers_external_ref_unique ON customers (integration_id, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL');
}

public function down(): void
{
    DB::statement('DROP INDEX IF EXISTS customers_external_ref_unique');

    Schema::table('customers', function (Blueprint $table) {
        $table->dropConstrainedForeignId('integration_id');
        $table->dropColumn(['external_id', 'external_synced_at']);
    });
}
```

`nullOnDelete` on `integration_id`: disconnecting an integration must **not** delete the customers
it imported. They become ordinary local customers; the partial index tolerates the resulting
`(null, 'ext-1')` rows because a `null` integration_id makes each pair distinct under both engines'
NULL semantics — and the executor should not rely on that subtlety, so `external_id` is **also**
nulled by the same `nullOnDelete`… it is not. **Explicit requirement:** do not attempt to null
`external_id` from the FK; leave it, and document in the model that a customer with
`integration_id IS NULL` and a non-null `external_id` is a historical marker only.

### 12 — `Create file: api/app/Services/Integrations/OutboundUrlVerdict.php`

```php
final readonly class OutboundUrlVerdict
{
    public function __construct(
        public bool $ok,
        /** i18n key (integrations.error.*), or null when ok. NEVER a message. */
        public ?string $error = null,
        /** The resolved IP, for the log line only. Never returned to a client. */
        public ?string $ip = null,
    ) {}

    public static function pass(string $ip): self { return new self(true, null, $ip); }

    public static function fail(string $errorKey): self { return new self(false, $errorKey); }
}
```

### 13 — `Create file: api/app/Services/Integrations/OutboundUrlGuard.php` (interface)

```php
interface OutboundUrlGuard
{
    /**
     * Story 25 (WIS-24). The SSRF gate, extracted from HttpIntegrationTester
     * so BOTH the reachability probe and the sync engine share one
     * implementation. Runs BEFORE any socket opens. Do not weaken, skip, or
     * copy one of its checks into a caller.
     *
     * `error` is an i18n key (`integrations.error.*`), never a raw message.
     */
    public function validate(string $url): OutboundUrlVerdict;
}
```

### 14 — `Create file: api/app/Services/Integrations/DnsOutboundUrlGuard.php`

The four checks **moved verbatim** from `HttpIntegrationTester.php:21–48`, in the same order, with
the same keys:

1. `parse_url()`; `scheme !== 'https' || $host === null` → `integrations.error.scheme`.
2. no `.` and no `:` in host → `integrations.error.blocked_host`.
3. `filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host)`; unchanged return with a
   non-IP host → `integrations.error.unreachable`.
4. `! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)`
   → `integrations.error.blocked_host`.

Otherwise `OutboundUrlVerdict::pass($ip)`. **Copy the explanatory comments across too** — they are
the reason each check exists.

### 15 — `Edit file: api/app/Services/HttpIntegrationTester.php`

Replace `:21–48` with:

```php
public function __construct(private readonly OutboundUrlGuard $guard) {}

public function test(string $endpointUrl, ?string $secret): array
{
    // Story 25 (WIS-24): the four guards that used to live inline here now
    // live in OutboundUrlGuard, so the sync engine runs the SAME code.
    // Behaviour, error keys and return shape are unchanged — IntegrationSsrfTest
    // passes untouched, which is the proof the extraction was faithful.
    $verdict = $this->guard->validate($endpointUrl);

    if (! $verdict->ok) {
        return ['ok' => false, 'status' => null, 'error' => $verdict->error];
    }

    $host = parse_url($endpointUrl, PHP_URL_HOST);
    // ... :50-79 unchanged
}
```

**Do not touch `:50–79`.** The `Log::warning('Integration connection test failed', ['host' =>
$host])` line still needs `$host`, hence the re-parse.

### 16 — `Create file: api/app/Services/Integrations/OutboundResponse.php`

```php
final readonly class OutboundResponse
{
    private function __construct(
        public bool $ok,
        public ?int $status,
        public ?string $body,
        /** i18n key when !ok. Never a raw message. */
        public ?string $errorKey,
        /** True only for a transport failure or a retryable status. */
        public bool $retryable,
    ) {}

    public static function success(int $status, string $body): self;
    public static function rejected(int $status): self;       // permanent, retryable=false
    public static function transient(int $status): self;      // retryable=true
    public static function transportFailure(): self;          // retryable=true, status null
    public static function blocked(string $errorKey): self;   // guard, permanent
    public static function tooLarge(): self;                  // permanent
}
```

### 17 — `Create file: api/app/Services/Integrations/OutboundHttpClient.php`

**The only place in this story that opens a socket.** Two methods:

```php
public function __construct(private readonly OutboundUrlGuard $guard) {}

/** @param array<string, scalar> $query */
public function get(Integration $integration, string $url, array $query = []): OutboundResponse;

/** @param array<string, mixed> $payload  @param array<string,string> $headers */
public function post(Integration $integration, string $url, array $payload, array $headers = []): OutboundResponse;
```

Both must, in this order:

1. `$verdict = $this->guard->validate($url);` — **at send time, every time**, because the stored
   URL can be edited between configuration and dispatch (Decision 1). `! $verdict->ok` ⇒
   `OutboundResponse::blocked($verdict->error)` with **no socket opened**.
2. Build the request exactly as `HttpIntegrationTester.php:53–55` does:
   `Http::withOptions(['allow_redirects' => false])->timeout($t)->connectTimeout($ct)`
   with `$t`/`$ct` from the direction's config block; `->acceptJson()`; and
   `->withToken($secret)` when the decrypted secret is non-empty.
3. Wrap the send in `try { … } catch (Throwable $e)`. **Never** store or return
   `$e->getMessage()`; `Log::warning('Integration sync request failed', ['host' =>
   parse_url($url, PHP_URL_HOST), 'exception' => $e::class])` and return
   `OutboundResponse::transportFailure()`. Reading `$integration->secret` can itself throw
   `DecryptException` after an `APP_KEY` rotation (`Integration.php:16–21`) — the same catch
   covers it.
4. `get()` additionally enforces the size cap: if `strlen($response->body()) >
   config('integrations.sync.inbound.max_response_bytes')` return
   `OutboundResponse::tooLarge()` **without** calling `->json()`.
5. Map the status per Decision 3's table.
6. `post()` adds, on top of the shared headers: `X-Wisal-Event`, `X-Wisal-Event-Id`,
   `X-Wisal-Signature: sha256=`.`hash_hmac('sha256', $jsonBody, $secret)` when a secret exists, and
   `User-Agent: Wisal-CRM/1.0`. The HMAC is computed over the **exact serialised body** that is
   sent, so build the JSON string once and pass it with `->withBody($json, 'application/json')`.

### 18 — `Create file: api/app/Services/Integrations/SyncFieldMap.php`

The whitelist and the mapper. No Eloquent writes here — it returns an array.

```php
final class SyncFieldMap
{
    /** The CLOSED set of Wisal fields an inbound sync may write. */
    public const FIELDS = ['name', 'email', 'phone', 'company', 'tier'];

    /** The map key that identifies the remote record. Not a conflict participant. */
    public const EXTERNAL_ID = 'external_id';

    /** Reads a dot path out of an untrusted decoded record. Scalars only. */
    public static function read(array $record, string $path): ?string;

    /**
     * @param array<string,string> $map           inbound_field_map
     * @param array<string,string> $rules         conflict_rules
     * @return array<string,string>  attributes to write (already conflict-resolved)
     */
    public static function attributesFor(array $record, array $map, array $rules, ?Customer $existing): array;
}
```

Rules the executor must implement inside `attributesFor()`:

- Iterate **`self::FIELDS`**, not the map's keys — an unknown key in the stored map is ignored, not
  written. (A map row can only get there through the FormRequest, but defence in depth is cheap.)
- `read()` uses `data_get($record, $path)`. If the value is an array or object → treat as absent.
  If it is a bool/int/float → cast to string. Trim. `''` → treated as absent (Decision 6).
- Absent ⇒ the field is omitted entirely.
- `$existing === null` (create) ⇒ every present field is included.
- `$existing !== null` and the rule is `wisal_wins` and `$existing->{$field}` is non-empty ⇒ omit.
- `tier` is validated against `CustomerTier::values()`; an unrecognised tier omits the field and is
  reported as a per-row error with `reason_key = integrations.sync.error.bad_tier` — the record
  still imports.
- `email` is only included when it passes `filter_var(..., FILTER_VALIDATE_EMAIL)`; otherwise the
  same treatment as a bad tier (`integrations.sync.error.bad_email`). A malformed ERP email must not
  reach `customers_email_unique`.

### 19 — `Create file: api/app/Models/SyncRun.php`

`$fillable` for all writable columns; `casts()`: `direction => SyncDirection::class`,
`trigger => SyncRunTrigger::class`, `status => SyncRunStatus::class`, `errors => 'array'`,
`started_at`/`finished_at` `datetime`, the five counters `'integer'`.
`integration(): BelongsTo`.

**The class docblock carries Decision 9's counter table.** Add two helpers:

```php
public function durationSeconds(): ?int;   // null while running
public function addError(array $row): void; // appends up to config('integrations.sync.max_error_rows'), then stops
```

### 20 — `Create file: api/app/Models/IntegrationOutboxMessage.php`

`protected $table = 'integration_outbox';` — Eloquent would otherwise look for
`integration_outbox_messages`. `casts()`: `event => IntegrationEvent::class`,
`status => OutboxStatus::class`, `payload => 'array'`, `attempts => 'integer'`,
`next_attempt_at`/`delivered_at`/`failed_at` `datetime`. `integration(): BelongsTo`.

Two scopes:

```php
/** Pending and due. `next_attempt_at IS NULL` means "never attempted, due now". */
public function scopeDue(Builder $q, ?Carbon $now = null): Builder;

public function scopeDead(Builder $q): Builder;
```

`scopeDue` must be written as
`->where('status', OutboxStatus::Pending->value)->where(fn ($w) => $w->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', $now))`
and ordered `orderBy('id')`. **No `NULLS LAST`** — index cross-cutting rule.

### 21 — `Create file: api/app/Services/Integrations/IntegrationEvents.php`

The enqueue seam. One public method plus three payload builders.

```php
final class IntegrationEvents
{
    /** Attempts inline-delivered this process. Bounded by Decision 2. Reset in TestCase::setUp(). */
    private static int $attemptedThisRequest = 0;

    public static function resetInlineCounter(): void;

    /**
     * Writes ONE outbox row inside the caller's transaction, then defers a
     * best-effort delivery attempt. Never throws: an enqueue failure must not
     * fail the ticket resolve that triggered it.
     */
    public function record(IntegrationEvent $event, string $eventId, array $payload): void;
}
```

`record()` does, in order:

1. `if (! config('integrations.sync.enabled')) return;`
2. Resolve the ERP integration once:
   `Integration::query()->where('type', IntegrationType::Erp->value)->where('outbound_enabled', true)->where('status', IntegrationStatus::Connected->value)->first()`.
   Null ⇒ return. **This is the "nothing configured" fast path and it must cost one query.**
3. `if (! in_array($event->value, (array) $integration->outbound_events, true)) return;`
4. `if (blank($integration->outbound_url)) return;`
5. Insert the row (`status = pending`, `attempts = 0`, `next_attempt_at = null`) **directly, not in
   `afterCommit`** — Decision 2. Wrap in `try { … } catch (QueryException $e) { if (!
   $this->isUniqueViolation($e)) throw $e; return; }`, copying
   `TicketResolutionObserver.php:112–124,140–145`.
6. Defer the inline attempt:
   ```php
   if (++self::$attemptedThisRequest > (int) config('integrations.sync.outbound.inline_max_per_request')) {
       return; // the scheduled drain will pick it up. Never log the payload.
   }
   DB::afterCommit(function () use ($id) {
       app()->terminating(function () use ($id) {
           try {
               $message = IntegrationOutboxMessage::find($id);
               if ($message !== null && $message->status === OutboxStatus::Pending) {
                   app(OutboxDispatcher::class)->attempt($message);
               }
           } catch (Throwable $e) {
               Log::error('Outbound integration event delivery failed.', ['id' => $id, 'exception' => $e::class]);
           }
       });
   });
   ```
   Note there is **no `$processed` id-set here** and none is needed: `attempt()` re-reads the row
   and no-ops unless it is still `pending`, which is a stronger guard than the id-set
   `TicketClassificationObserver.php:22–31` needed. Say so in a comment.
7. `if (app()->runningInConsole() && ! app()->runningUnitTests()) { /* enqueue only, never attempt */ }`
   — the seeder must perform zero outbound requests (intake finding 17). Place this guard around
   **step 6 only**; the enqueue itself is harmless and keeps `migrate:fresh --seed` honest if an
   integration is ever configured before seeding.

Payload builders (static, pure, no HTTP):

```php
public static function ticketPayload(Ticket $ticket): array;
public static function csatPayload(CsatSurvey $survey): array;
```

Frozen shapes — the executor writes these exactly:

```jsonc
// ticket.created / ticket.resolved  →  "data"
{
  "id": 412, "subject": "…", "status": "resolved", "priority": "high",
  "category": "billing", "channel": "email",
  "created_at": "2026-09-09T08:00:00.000000Z",
  "resolved_at": "2026-09-09T09:12:00.000000Z",
  "description": "…",              // Str::limit(config('…payload_max_chars'))
  "customer": { "id": 88, "name": "…", "email": "…", "external_id": "erp-4411" }
}

// csat.submitted  →  "data"
{
  "survey_uuid": "…", "ticket_id": 412, "rating": 4,
  "comment": "…",                  // Str::limit(config('…payload_max_chars'))
  "responded_at": "2026-09-09T10:00:00.000000Z"
}
```

**Never** include internal notes, `TicketMessage` bodies, assignee identity, or anything from
`users`. `customer.email` is included because the receiver's whole purpose is to match the record;
`customer.phone` is not, because nothing in the intake needs it.

The full envelope, built in `record()`:

```json
{ "event": "ticket.resolved", "event_id": "ticket.resolved:412:2",
  "occurred_at": "2026-09-09T09:12:00.000000Z", "data": { } }
```

### 22 — `Create file: api/app/Services/Integrations/OutboxDispatcher.php`

```php
public function __construct(private readonly OutboundHttpClient $http) {}

/** One delivery attempt. Mutates and saves $message. Never throws. */
public function attempt(IntegrationOutboxMessage $message): OutboxStatus;
```

Implementation, exactly:

1. `$integration = $message->integration;` — null (deleted mid-flight) ⇒ mark `dead`,
   `last_error_key = integrations.sync.error.integration_gone`, return.
2. `$url = $integration->outbound_url;` — blank ⇒ `dead`,
   `integrations.sync.error.no_endpoint`.
3. `$response = $this->http->post($integration, $url, $message->payload, ['X-Wisal-Event' =>
   $message->event->value, 'X-Wisal-Event-Id' => $message->event_id]);`
4. `$message->attempts++`, `$message->last_status = $response->status`.
5. `$response->ok` ⇒ `status = delivered`, `delivered_at = now()`, `last_error_key = null`.
6. `! $response->retryable` ⇒ `status = dead`, `failed_at = now()`,
   `last_error_key = $response->errorKey`.
7. retryable and `attempts >= config('…max_attempts')` ⇒ `status = dead`, `failed_at = now()`,
   `last_error_key = integrations.sync.error.max_attempts`.
8. retryable and under the cap ⇒ stays `pending`; `next_attempt_at = now()->addSeconds($backoff)`
   where `$backoff = $list[min($message->attempts - 1, count($list) - 1)]`. Computed **in PHP**,
   bound as a Carbon value.
9. `$message->save();` return the new status.

### 23 — `Create file: api/app/Services/Integrations/CustomerPuller.php`

The inbound engine.

```php
public function __construct(private readonly OutboundHttpClient $http) {}

public function pull(Integration $integration, SyncRunTrigger $trigger): SyncRun;
```

Implementation:

1. Create the `SyncRun` (`direction = inbound`, `status = running`, `started_at = now()`) **before**
   the first request. Everything after is inside `try/finally` so the run is always finished.
2. Guard the configuration: `inbound_enabled` false, `inbound_url` blank, or an
   `inbound_field_map` with no `external_id` key ⇒ finish `failed` with
   `integrations.sync.error.not_configured` and **send nothing**.
3. Loop `$page = 1 …`:
   - `$response = $this->http->get($integration, $integration->inbound_url, ['page' => $page,
     'per_page' => $pageSize]);`
   - `! $response->ok` ⇒ finish `failed` with `$response->errorKey`; break. (A guard rejection
     lands here — Done Criterion 5.)
   - Decode with `json_decode($response->body, true)`. Not an array ⇒ `failed`,
     `integrations.sync.error.bad_payload`.
   - Extract `$records`: `array_is_list($decoded) ? $decoded : ($decoded['data'] ?? null)`. Not a
     list of arrays ⇒ `bad_payload`.
   - Empty ⇒ break. Apply Decision 7's four stop conditions.
   - Foreach record ⇒ `$this->upsert(...)`, tallying.
4. Finish: `status = records_failed > 0 ? partial : success`, `finished_at = now()`, and
   `$integration->forceFill(['last_inbound_sync_at' => now()])->save()` **only on a non-`failed`
   run**.

`upsert()` per record, private:

- `$externalId = SyncFieldMap::read($record, $map['external_id'])`. Blank ⇒ `records_failed++`,
  error row `{external_id: null, reason_key: 'integrations.sync.error.missing_external_id'}`,
  return.
- `$existing = Customer::query()->where('integration_id', $integration->id)->where('external_id',
  $externalId)->first();`
- `$attributes = SyncFieldMap::attributesFor($record, $map, $rules, $existing);` (collect the
  per-field warnings it reports).
- **Create path** (`$existing === null`): `name` missing or blank ⇒ `records_failed++`,
  `integrations.sync.error.missing_name` (the column is `NOT NULL`). Otherwise
  `Customer::create([...$attributes, 'integration_id' => …, 'external_id' => …,
  'external_synced_at' => now(), 'created_by' => null])` ⇒ `records_created++`.
- **Update path**: compute `$dirty` = the subset of `$attributes` whose value differs from
  `$existing->{$field}`. Empty ⇒ `records_skipped++` and **write nothing at all** (Decision 4).
  Otherwise `$existing->fill($dirty); $existing->external_synced_at = now(); $existing->save();`
  ⇒ `records_updated++`.
- Wrap each record in `try { … } catch (QueryException $e) { … }`: a duplicate email or
  `phone_normalized` arriving from the ERP hits `customers_email_unique` /
  `customers_phone_normalized_unique`. Count it `records_failed++` with
  `integrations.sync.error.duplicate` and **continue** — one bad row never aborts a run
  (mirrors `CustomerController.php:96–98`, which maps the same exception for the API).
- **Never** `Log` or store the record itself. `detail` on an error row is at most the external id
  and the offending field name.

Writing goes through `Customer::create()` / `->fill()` so the `email` / `phone` mutators
(`Customer.php:38–56`) run. **A query-builder `upsert()` is forbidden** and the docblock says why.

### 24 — `Create file: api/app/Observers/IntegrationEventObserver.php`

Registered on `Ticket` in `AppServiceProvider::boot()` beside the other two. Single
responsibility: enqueue. It decides nothing about delivery.

```php
public function created(Ticket $ticket): void
{
    app(IntegrationEvents::class)->record(
        IntegrationEvent::TicketCreated,
        'ticket.created:'.$ticket->id,
        ['data' => IntegrationEvents::ticketPayload($ticket)],  // envelope built in record()
    );
}

public function updated(Ticket $ticket): void
{
    // Same detection as TicketResolutionObserver:52-60 — wasChanged first,
    // then the target status. An update that touches other columns while the
    // ticket is already Resolved must NOT re-emit.
    if (! $ticket->wasChanged('status') || $ticket->status !== TicketStatus::Resolved) {
        return;
    }

    $cycle = CsatSurvey::query()->where('ticket_id', $ticket->id)->max('resolution_cycle') ?? 1;

    app(IntegrationEvents::class)->record(
        IntegrationEvent::TicketResolved,
        'ticket.resolved:'.$ticket->id.':'.$cycle,
        ...
    );
}
```

**Ordering note the executor must not trip over:** `TicketResolutionObserver` is registered first
(`AppServiceProvider.php:113`) and creates the survey for this cycle, so by the time this observer
runs, `max('resolution_cycle')` is the current cycle. Register `IntegrationEventObserver` **after**
both existing observers and add a comment saying the order is load-bearing for the `event_id`.

### 25 — `Edit file: api/app/Http/Controllers/CsatSurveyController.php`

Inside `store()`'s existing `DB::transaction` closure (`:68–79`), in the `$affected > 0` branch at
`:78`, after `$survey->refresh()`:

```php
// Story 25 (WIS-24). A query-builder update() fires NO model event, so a
// CsatSurvey observer would never see this. The enqueue lives here, inside
// the same transaction, guarded by $affected so a re-submitted link enqueues
// nothing.
app(IntegrationEvents::class)->record(
    IntegrationEvent::CsatSubmitted,
    'csat.submitted:'.$survey->uuid,
    ['data' => IntegrationEvents::csatPayload($survey)],
);
```

Nothing else in this controller changes. Its two public routes stay public; `record()` performs one
indexed query and returns immediately when no ERP is configured with outbound enabled.

### 26 — `Create file: api/app/Console/Commands/PullCustomersCommand.php`

```php
protected $signature = 'sync:pull-customers
                        {--type=erp : Integration type to pull}
                        {--dry-run : Fetch and report without writing}';
```

Docblock copies `EvaluateSlaCommand`'s framing: auto-discovered from `app/Console/Commands` (this
project has **no** `app/Console/Kernel.php` and one must not be created); runs synchronously
because no queue worker exists.

`handle(CustomerPuller $puller): int` — resolve the `IntegrationType`, load every matching
`Integration` with `inbound_enabled = true` and `status = connected`, call
`$puller->pull($integration, SyncRunTrigger::Scheduled)` for each, and print one
`$this->info("{$type}: read {$r} created {$c} updated {$u} skipped {$s} failed {$f}")` per run,
mirroring `EvaluateSlaCommand`'s `$this->info("at-risk: {$count}")` style. Zero matching
integrations ⇒ `$this->info('No inbound-enabled integrations.')` and `self::SUCCESS`.

`--dry-run` passes a flag through to `CustomerPuller::pull()` that skips **every** write
(customers *and* the `SyncRun` row) and instead prints the tally. Add the flag as a fourth
parameter with a default of `false`.

### 27 — `Create file: api/app/Console/Commands/FlushOutboxCommand.php`

```php
protected $signature = 'sync:flush-outbox {--limit= : Override the configured batch size}';
```

`handle(OutboxDispatcher $dispatcher): int`:

1. `$due = IntegrationOutboxMessage::query()->due()->limit($limit)->get();` grouped by
   `integration_id`.
2. One `SyncRun` per integration (`direction = outbound`, `trigger = scheduled`).
3. `foreach` message ⇒ `$dispatcher->attempt($message)`, tallying per Decision 9's outbound column
   meanings: `records_read++` always; `delivered ⇒ records_created++`;
   `dead ⇒ records_failed++` plus an error row `{external_id: $message->event_id,
   reason_key: $message->last_error_key}`; still `pending ⇒ records_skipped++`.
4. Finish each run and print `$this->info("outbox {$type}: read {$r} delivered {$d} deferred {$s} dead {$f}")`.
5. No due messages ⇒ **create no `SyncRun` at all** and `$this->info('Outbox empty.')`. An empty run
   row every five minutes would bury the history a human is meant to read.

### 28 — `Edit file: api/routes/console.php`

Append, after the `sla:evaluate` block at `:19–26`:

```php
// WIS-24: the integration sync engine. Same constraints as sla:evaluate above
// — synchronous, no queue worker exists to hand work to.
//
// The outbox drain is the DELIVERY GUARANTEE, not an optimisation: the inline
// attempt registered by IntegrationEvents is best-effort and capped. Five
// minutes matches the shortest configured backoff (60s) closely enough that a
// transient 5xx recovers within two cycles.
Schedule::command('sync:flush-outbox')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->runInBackground();

// Hourly, not every five minutes: a customer master pulled from an ERP does
// not change on a five-minute cadence, and each run can read up to
// config('integrations.sync.inbound.max_records_per_run') rows.
Schedule::command('sync:pull-customers')
    ->hourly()
    ->withoutOverlapping(30)
    ->runInBackground();
```

### 29 — `Edit file: api/app/Models/Integration.php`

- `$fillable`: append `'inbound_enabled', 'inbound_url', 'inbound_field_map', 'conflict_rules',
  'last_inbound_sync_at', 'outbound_enabled', 'outbound_url', 'outbound_events',
  'last_outbound_sync_at'`.
- `casts()`: `'inbound_enabled' => 'boolean'`, `'outbound_enabled' => 'boolean'`,
  `'inbound_field_map' => 'array'`, `'conflict_rules' => 'array'`, `'outbound_events' => 'array'`,
  `'last_inbound_sync_at' => 'datetime'`, `'last_outbound_sync_at' => 'datetime'`.
- Add `syncRuns(): HasMany` and `outboxMessages(): HasMany` (the latter with the explicit
  `IntegrationOutboxMessage::class`).
- **Do not touch `$hidden`.** `secret` stays hidden and stays out of every resource.

### 30 — `Edit file: api/app/Models/Customer.php`

- `$fillable`: **do not** add `integration_id` / `external_id`. They are set explicitly by
  `CustomerPuller` with `Customer::create([...])` — which does honour `$fillable`, so instead add
  them and note in a comment that no HTTP FormRequest ever validates them, so no mass-assignment
  path from a request exists (`StoreCustomerRequest` / `UpdateCustomerRequest` do not list them and
  `CustomerController` uses `$request->only([...])` at `:93,:115`).
- `casts()`: `'external_synced_at' => 'datetime'`.
- Add `integration(): BelongsTo`.
- Docblock note: a row with `integration_id IS NULL` and a non-null `external_id` is a
  historical marker from a disconnected integration (Task 11).

### 31 — `Edit file: api/app/Http/Resources/IntegrationResource.php`

Append **one** key to `toArray()`, after `last_error_key`:

```php
'sync' => [
    'inbound_enabled' => (bool) $model?->inbound_enabled,
    'inbound_url' => $model?->inbound_url,
    'inbound_field_map' => (object) ($model?->inbound_field_map ?? []),
    'conflict_rules' => (object) ($model?->conflict_rules ?? []),
    'last_inbound_sync_at' => $model?->last_inbound_sync_at?->toJSON(),
    'outbound_enabled' => (bool) $model?->outbound_enabled,
    'outbound_url' => $model?->outbound_url,
    'outbound_events' => array_values((array) ($model?->outbound_events ?? [])),
    'last_outbound_sync_at' => $model?->last_outbound_sync_at?->toJSON(),
    'dead_letter_count' => $model === null ? 0 : (int) ($model->dead_letter_count ?? 0),
],
```

`(object)` casts keep an empty map serialising as `{}` rather than `[]`, which the TypeScript
`Record<string,string>` type requires. `dead_letter_count` comes from a `withCount` on
`IntegrationController::index()` — add
`->withCount(['outboxMessages as dead_letter_count' => fn ($q) => $q->where('status', OutboxStatus::Dead->value)])`
to the query at `IntegrationController.php:41`. **The secret still does not appear.**

### 32 — `Create file: api/app/Http/Resources/SyncRunResource.php`

```php
'id', 'direction', 'trigger', 'status',
'records_read', 'records_created', 'records_updated', 'records_skipped', 'records_failed',
'started_at' => ->toJSON(), 'finished_at' => ->toJSON(),
'duration_seconds' => $this->durationSeconds(),
'error_key', 'errors' => array_values((array) $this->errors),
```

### 33 — `Create file: api/app/Http/Resources/OutboxMessageResource.php`

`'id', 'event', 'event_id', 'status', 'attempts', 'last_status', 'last_error_key',
'next_attempt_at', 'delivered_at', 'failed_at', 'created_at'`. **`payload` is deliberately
absent** — it carries customer PII and there is no admin need to read it in the UI.

### 34 — `Create file: api/app/Http/Requests/SaveIntegrationSyncRequest.php`

`authorize()` returns `true` (the `administrator` middleware plus the policy call are the gate —
same reasoning as `SaveIntegrationRequest`'s docblock).

```php
public function rules(): array
{
    return [
        'inbound_enabled' => ['required', 'boolean'],
        'inbound_url' => ['nullable', 'string', 'max:2048', 'url:https', 'required_if:inbound_enabled,true'],
        'inbound_field_map' => ['nullable', 'array'],
        'inbound_field_map.external_id' => ['required_if:inbound_enabled,true', 'nullable', 'string', 'max:191'],
        'conflict_rules' => ['nullable', 'array'],

        'outbound_enabled' => ['required', 'boolean'],
        'outbound_url' => ['nullable', 'string', 'max:2048', 'url:https', 'required_if:outbound_enabled,true'],
        'outbound_events' => ['nullable', 'array'],
        'outbound_events.*' => [Rule::in(IntegrationEvent::values())],
    ];
}

public function withValidator($validator): void
{
    // The field map's KEYS are a closed set (Decision 5). Rule::in cannot
    // express "every key of this object"; do it here so an unknown key is a
    // 422 and never a silently-ignored stored value.
    $validator->after(function ($v) {
        $allowed = [...SyncFieldMap::FIELDS, SyncFieldMap::EXTERNAL_ID];
        foreach (array_keys((array) $this->input('inbound_field_map', [])) as $key) { … }
        foreach ((array) $this->input('conflict_rules', []) as $key => $rule) {
            // keys ⊂ SyncFieldMap::FIELDS; values ⊂ ConflictRule::values()
        }
    });
}
```

Each map value must additionally be `string|max:191` — a dot path, never an array.

### 35 — `Create file: api/app/Http/Controllers/Admin/IntegrationSyncController.php`

Five actions. Constructor injects `CustomerPuller`, `OutboxDispatcher`, `AuditTrail`. Every action
opens with `$this->authorize('update', Integration::class)` (or `'viewAny'` for the two reads),
then `$integrationType = IntegrationType::tryFrom($type) ?? abort(404);` — copying
`IntegrationController::save()`'s first two lines exactly.

| Action | Route | Behaviour |
|---|---|---|
| `updateConfig` | `PUT /api/admin/integrations/{type}/sync-config` | 404 when no `integrations` row exists (you cannot configure sync on something not connected). Persists the nine columns, writes an `AuditTrail::INTEGRATION_SYNC_CONFIG_CHANGED` row with `AuditTrail::target('integration', $type, $type)` and the two **URLs** in the context — never the map values, never the secret. Returns `IntegrationResource::forType(...)`. |
| `runs` | `GET /api/admin/integrations/{type}/sync-runs` | Paginated `SyncRunResource::collection`, `orderByDesc('started_at')->orderByDesc('id')`, `paginate(min((int) $request->query('per_page', 20), 50))->withQueryString()` — the shape `CustomerController::index()` uses at `:35–36`. No row ⇒ an empty paginator, **not** a 404. |
| `run` | `POST /api/admin/integrations/{type}/sync` | 404 with no row; 422 (`integrations.sync.error.not_configured`) when `inbound_enabled` is false. Otherwise `$this->puller->pull($integration, SyncRunTrigger::Manual)` and returns the finished `SyncRunResource`. Decision 12. |
| `outbox` | `GET /api/admin/integrations/{type}/outbox` | `OutboxMessageResource::collection` of `->dead()->orderByDesc('failed_at')`, paginated the same way. |
| `retryOutbox` | `POST /api/admin/integrations/{type}/outbox/retry` | Resets **dead** messages to `pending`, `attempts = 0`, `next_attempt_at = null`, `last_error_key = null`, `failed_at = null`, bounded by `config('integrations.sync.outbound.batch_size')`. Returns `{"requeued": n}`. Does **not** deliver inline — the scheduled drain does, within five minutes. |

### 36 — `Edit file: api/routes/api.php`

Inside the existing admin group, immediately after the four integration routes at `:217–220`:

```php
// ---- Integration data sync (Story 25, WIS-24) ------------------
//
// {type} is the ONLY route parameter in this block, deliberately.
// AdminAuthorizationTest::adminRoutes() substitutes exactly four
// placeholders ({user}, {type}, {branch}, {department}); a fifth would
// produce a literal "{run}" in the URL, 404 before the administrator gate
// could 403, and fail the suite for the wrong reason.
Route::put('/integrations/{type}/sync-config', [IntegrationSyncController::class, 'updateConfig']);
Route::get('/integrations/{type}/sync-runs', [IntegrationSyncController::class, 'runs']);
Route::post('/integrations/{type}/sync', [IntegrationSyncController::class, 'run']);
Route::get('/integrations/{type}/outbox', [IntegrationSyncController::class, 'outbox']);
Route::post('/integrations/{type}/outbox/retry', [IntegrationSyncController::class, 'retryOutbox']);
```

Add the `use App\Http\Controllers\Admin\IntegrationSyncController;` import beside `:8`.

### 37 — `Edit file: api/app/Services/AuditTrail.php`

Add one constant beside the four at `:57–70`:

```php
/** Story 25 (WIS-24). Changing what data moves is as sensitive as connecting. */
public const INTEGRATION_SYNC_CONFIG_CHANGED = 'integration.sync_config_changed';
```

Add it to `events()` (`:79–104`, after `INTEGRATION_TEST_FAILED`) and to `label()` (`:106–134`,
`'Integration sync configured'`). **Rename nothing** — the class docblock at `:16–18` says why.

### 38 — `Edit file: api/app/Providers/AppServiceProvider.php`

In `register()`, beside the tester bind at `:52–56`:

```php
// Story 25 (WIS-24): the SSRF gate, now its own service so the sync engine
// and the reachability probe share ONE implementation. Tests bind an
// allowing fake via bindOutboundUrlGuard(); the guard's own tests keep this.
$this->app->bind(OutboundUrlGuard::class, DnsOutboundUrlGuard::class);
```

In `boot()`, after `:117`:

```php
// Story 25 (WIS-24): enqueue outbound integration events. Registered LAST on
// purpose — TicketResolutionObserver has already created this cycle's
// CsatSurvey by the time this runs, and the resolved event_id includes the
// cycle number.
Ticket::observe(IntegrationEventObserver::class);
```

### 39 — `Edit file: api/phpunit.xml`

Add, beside the `AI_CLASSIFY_ENABLED` line at `:32` (its comment block sits just above) and with a
comment in the same voice:

```xml
<!--
    Story 25 (WIS-24): the outbound event enqueue fires from Ticket::created,
    Ticket::updated and CsatSurveyController@store — three of the busiest
    paths in the suite. OFF by default so no existing test starts writing
    integration_outbox rows; the sync test files opt back in with
    config(['integrations.sync.enabled' => true]) and Http::fake().
-->
<env name="INTEGRATION_SYNC_ENABLED" value="false"/>
```

### 40 — `Edit file: api/tests/TestCase.php`

In `setUp()`, after the two existing resets at `:19–23`:

```php
// Story 25 (WIS-24). Same rationale — the inline-delivery cap is a process static.
IntegrationEvents::resetInlineCounter();
```

### 41 — `Edit file: api/tests/Pest.php`

Add beside `bindIntegrationTester()` at `:26–36`:

```php
/**
 * Story 25 (WIS-24). Binds an allowing (or refusing) OutboundUrlGuard so a
 * sync test never depends on live DNS — the real DnsOutboundUrlGuard calls
 * gethostbyname(), and IntegrationFactory's endpoint is a `.test` host that
 * does not resolve. The guard's OWN tests bind nothing and keep the real one.
 */
function bindOutboundUrlGuard(bool $allow = true, ?string $error = null): void
```

### 42 — `Edit file: api/database/factories/IntegrationFactory.php`

Add two states, keeping `definition()` unchanged so every existing test is unaffected:

```php
/** Inbound sync configured against a resolvable public host. */
public function inbound(array $map = [], array $rules = []): static;

/** Outbound configured for all three events. */
public function outbound(array $events = []): static;
```

Both write `https://api.example.com/...` — a **resolvable** host, so a test that deliberately keeps
the real guard still gets past DNS.

### 43 — `Create file: api/database/factories/SyncRunFactory.php` and `IntegrationOutboxMessageFactory.php`

`SyncRunFactory`: a finished `success` inbound run; states `inbound()`, `outbound()`, `failed()`,
`partial()`, `running()`.
`IntegrationOutboxMessageFactory`: a `pending` `ticket.resolved` message with a valid payload;
states `delivered()`, `dead()`, `due()` (`next_attempt_at` in the past),
`notDue()` (`next_attempt_at` in the future).

### 44 — `Edit file: api/.env.example`

Add a Story-25 sub-block in the WIS-26/27/23 style, every value **commented at its default** so a
fresh clone changes nothing:

```dotenv
# --- Integration data sync (WIS-24) ----------------------------------------
# The engine is on by default; a not-connected or sync-disabled integration
# still moves nothing. Set to false to hard-stop all sync in an environment.
# INTEGRATION_SYNC_ENABLED=true
# INTEGRATION_SYNC_PAGE_SIZE=100
# INTEGRATION_SYNC_MAX_PAGES=50
# INTEGRATION_SYNC_MAX_RECORDS=5000
# INTEGRATION_SYNC_MAX_BYTES=2097152
# INTEGRATION_SYNC_TIMEOUT=15
# INTEGRATION_OUTBOX_MAX_ATTEMPTS=5
# INTEGRATION_OUTBOX_INLINE_MAX=5
# INTEGRATION_OUTBOX_BATCH=100
# INTEGRATION_OUTBOX_TIMEOUT=10
```

### 45 — `Edit file: README.md`

Three anchors, all currently stating the opposite of this story:

- `:214` — the Category 11 row. Rewrite: the admin surface **plus** scheduled inbound customer sync
  and outbound ticket/CSAT events with retry + dead-letter; per-provider message send/receive
  (email/WhatsApp/SMS) is still not wired. Tracker ids become `WIS-19, WIS-24, WIS-27`.
- `:454` — the endpoint table row. Append the five new routes.
- `:787` — "**Integrations are a configuration surface only.**" Rewrite to name what does and does
  not move.

Add `sync:pull-customers` and `sync:flush-outbox` wherever `sla:evaluate` is documented (grep
`sla:evaluate` in `README.md`).

---

## Frontend Tasks

### 46 — `Edit file: web/src/features/integrations/model/types.ts`

Append, without touching the existing `Integration` type's other fields:

```ts
export type ConflictRule = 'remote_wins' | 'wisal_wins';
export type IntegrationEventValue = 'ticket.created' | 'ticket.resolved' | 'csat.submitted';
export type SyncDirection = 'inbound' | 'outbound';
export type SyncRunStatus = 'running' | 'success' | 'partial' | 'failed';
export type SyncRunTrigger = 'scheduled' | 'manual';

/** Mirrors IntegrationResource's `sync` object exactly. */
export type IntegrationSync = {
  inbound_enabled: boolean;
  inbound_url: string | null;
  inbound_field_map: Record<string, string>;
  conflict_rules: Record<string, ConflictRule>;
  last_inbound_sync_at: string | null;
  outbound_enabled: boolean;
  outbound_url: string | null;
  outbound_events: IntegrationEventValue[];
  last_outbound_sync_at: string | null;
  dead_letter_count: number;
};

export type SyncRunError = { external_id: string | null; field: string | null; reason_key: string; detail: string | null };

export type SyncRun = { /* mirrors SyncRunResource */ };
export type OutboxMessage = { /* mirrors OutboxMessageResource */ };

/** The closed set of mappable Wisal fields. Mirrors SyncFieldMap::FIELDS. */
export const SYNC_FIELDS = ['name', 'email', 'phone', 'company', 'tier'] as const;
```

`SYNC_FIELDS` is the one place this list is duplicated across the stack; add a comment saying the
PHP constant is the authority and the two must be changed together.

### 47 — `Edit file: web/src/features/integrations/api/integrationsApi.ts`

Five functions, all on the shared `api` instance, all unwrapping the `{ data }` envelope like the
existing four. **Do not create a second Axios client.**

```ts
export const saveSyncConfig = (type, body: SyncConfigBody): Promise<Integration>;
export const fetchSyncRuns  = (type, page: number): Promise<Paginated<SyncRun>>;
export const runSyncNow     = (type): Promise<SyncRun>;
export const fetchDeadLetters = (type, page: number): Promise<Paginated<OutboxMessage>>;
export const retryDeadLetters = (type): Promise<{ requeued: number }>;
```

### 48 — `Edit file: web/src/features/integrations/api/queryKeys.ts`

```ts
syncRuns: (type: IntegrationTypeValue, page: number) => [...integrationKeys.all, 'sync-runs', type, page] as const,
deadLetters: (type: IntegrationTypeValue, page: number) => [...integrationKeys.all, 'outbox', type, page] as const,
```

Still rooted at `['integrations']`; still never invalidates `ticketKeys.all` — the existing
docblock's rule holds.

### 49 — `Create files: web/src/features/integrations/hooks/{useSyncRuns,useSaveSyncConfig,useRunSyncNow,useDeadLetters,useRetryDeadLetters}.ts`

Copy `useIntegrations.ts` / `useSaveIntegration.ts` exactly. Every mutation's `onSuccess`
invalidates `integrationKeys.all` — that refetches the card list (for `dead_letter_count`) and both
history lists in one line.

### 50 — `Create file: web/src/features/integrations/components/SyncSettingsPanel.tsx`

The configuration form. Sections, in order:

1. **Inbound** — a toggle, the collection URL input (disabled while the toggle is off), then
   `FieldMapEditor`.
2. **Outbound** — a toggle, the receiver URL input, then a checkbox per `IntegrationEventValue`.
3. Footer: Save (disabled while pending), and a **Run now** button that is disabled unless
   `inbound_enabled` is saved-true, showing a spinner label while `useRunSyncNow` is pending and a
   result banner (`t('sync.ranNow', { created, updated, skipped, failed })`) afterwards.

Validation mirrors the FormRequest with a Zod schema in
`model/syncConfigSchema.ts` (following `model/integrationSchema.ts`'s
`createIntegrationSchema(t, requireSecret)` factory shape so messages are translated):
https-only URLs, `external_id` required when inbound is enabled, field-map keys ⊂ `SYNC_FIELDS`.

### 51 — `Create file: web/src/features/integrations/components/FieldMapEditor.tsx`

One row per `SYNC_FIELDS` entry plus a pinned first row for `external_id`:

| Wisal field (static label) | Remote path (text input) | Conflict rule (select) |
|---|---|---|

- The `external_id` row has **no** conflict select — it is the key, not a value (Decision 5).
- An empty remote path means "not mapped": the field is omitted from the submitted map.
- The conflict select is disabled while the row's path is empty.
- Every label, placeholder and option comes from the `integrations` catalogue —
  `npm run lint` runs `scripts/check-no-literals.mjs`.

### 52 — `Create file: web/src/features/integrations/components/SyncRunHistory.tsx`

Ships **all four** async states (index cross-cutting rule):

- **Loading** — reuse `IntegrationsSkeleton`'s bar treatment in a `SyncRunSkeleton` variant.
- **Error** — reuse `IntegrationsError`'s markup with `onRetry={() => void query.refetch()}`.
- **Empty** — a new `SyncEmpty.tsx`. This feature deliberately has no Empty component today
  (`IntegrationsPage.tsx:18–22` explains why); a run history genuinely needs one.
- **Success** — a list of `SyncRunRow`s plus prev/next paging.

`SyncRunRow.tsx`: a direction icon, a `StatusPill`-style status chip (extend `StatusPill` with the
four run statuses rather than writing a second pill), the relative start time via
`formatRelative`, the duration, and the five counters rendered with **direction-specific labels**
(Decision 9). A row with `records_failed > 0` or a non-null `error_key` is expandable into
`SyncRunErrors.tsx`, which renders the capped error list — each entry
`t(unscopeKey(row.reason_key))` plus the external id.

### 53 — `Create file: web/src/features/integrations/components/DeadLetterPanel.tsx`

Rendered only when `integration.sync.dead_letter_count > 0`. A warning banner, the dead messages
(event, event id, attempts, last status, failed-at), and a **Retry all** button wired to
`useRetryDeadLetters` behind a `ConfirmDialog` (the component is already imported by
`IntegrationModal.tsx:4`). Same four states.

### 54 — `Edit file: web/src/features/integrations/components/IntegrationModal.tsx`

Introduce a tab strip above the body: **Connection · Sync · History**.

- `Connection` is the existing form, moved into `ConnectionTab` **unchanged** — the `Phase` union
  (`:15`), the five-button footer (`:135–163`) and the `ConfirmDialog` (`:166–175`) all keep their
  current behaviour, so `IntegrationModal.test.tsx` and `SecretField.test.tsx` keep passing with at
  most a "click the Connection tab first" adjustment.
- `Sync` and `History` are **only rendered when `integration.status !== 'not_connected'`**; for a
  not-connected type the two tabs are visible but disabled with
  `t('sync.connectFirst')` as the `title`.
- The active tab lives in the **URL** alongside the existing `?configure={type}`, as
  `?configure=erp&tab=sync`, following `IntegrationsPage.tsx:27–33`'s "modal state lives in the
  URL" rule. Default `connection`.
- Widen the modal to `width={640}` for the two new tabs; keep `480` for Connection.
- The tab strip is a real `role="tablist"` with `role="tab"` / `aria-selected` /
  arrow-key navigation — `wisal-ui-review`'s accessibility bar.

### 55 — `Edit file: web/src/features/integrations/components/IntegrationCard.tsx`

Two additions under the existing audit strip (`:38–48`):

- When `sync.inbound_enabled` and `last_inbound_sync_at` is set:
  `t('sync.lastPull', { when: formatRelative(...) })`.
- When `sync.dead_letter_count > 0`: a red count chip,
  `t('sync.deadLetters', { count })`.

Do not disturb the existing "Last checked" / "Last check failed" lines — WIS-19's Decision 3 (the
card says *checked*, never *synced*) is now only true for the check strip.

### 56 — `Edit files: web/src/i18n/locales/{en,ar}/integrations.json`

- **Rewrite `notice` (`en:4`) in both files.** It currently reads *"Sending and receiving messages
  through these providers is not enabled in this release."* — the opposite of this story. New text
  must be honest about what moves (customer records inbound, ticket and CSAT events outbound) and
  what still does not (message send/receive per provider).
- Add a `sync` block: `tab.connection` / `tab.sync` / `tab.history`, `inbound.*`, `outbound.*`,
  `fieldMap.*` (including a label per `SYNC_FIELDS` entry and the two conflict-rule labels),
  `runNow`, `ranNow`, `lastPull`, `deadLetters`, `retryAll`, `connectFirst`,
  `direction.inbound` / `direction.outbound`, `trigger.scheduled` / `trigger.manual`,
  `status.running|success|partial|failed`, `counter.inbound.*` and `counter.outbound.*`
  (five each — Decision 9's two label sets), `empty.title` / `empty.body`.
- Add an `error` sub-block for every `integrations.sync.error.*` key the backend can write:
  `not_configured`, `bad_payload`, `payload_too_large`, `missing_external_id`, `missing_name`,
  `duplicate`, `bad_tier`, `bad_email`, `rejected`, `max_attempts`, `no_endpoint`,
  `integration_gone`. **Every backend key must have a catalogue entry**, or `t()` silently falls
  back to a humanised key.
- `catalogueParity.test.ts` requires the `en` and `ar` key sets to be **identical**. Write both.

### 57 — `Edit file: web/src/index.css`

Append the new `.intg-tab*`, `.intg-sync*`, `.intg-run*`, `.intg-dead*` rules after `:4269` and
**before** the `@media` block at `:4272–4274`, then add the narrow-viewport overrides inside that
block. Use existing custom properties (`--text-main`, `--text-muted`) and the `dt-btn*` button
classes; introduce no new colour literals. RTL: use logical properties
(`margin-inline-start`, `padding-inline`) — the run history is a table-like layout and is exactly
where a hard-coded `margin-left` breaks Arabic.

---

## Edge Cases & Failure Modes

1. **Guard rejection at send time.** A stored `inbound_url` edited to `https://10.0.0.5/x` after
   configuration. `OutboundHttpClient` (Task 17, step 1) validates on **every** call, so the socket
   never opens; the run finishes `failed` with `integrations.error.blocked_host`. Proven by Test §G.
2. **DNS failure.** `gethostbyname()` returns the input unchanged →
   `integrations.error.unreachable`. Inbound: run `failed`. Outbound: **retryable** — a DNS blip is
   transient. Note this is the one guard verdict that is *not* permanent; encode it explicitly in
   `OutboxDispatcher` step 6 rather than treating every guard failure alike.
3. **`APP_KEY` rotated after a secret was stored.** Reading `$integration->secret` throws
   `DecryptException` (`Integration.php:16–21`). Caught by `OutboundHttpClient`'s `catch
   (Throwable)` (Task 17, step 3) → `transportFailure()` → retryable. It will exhaust its attempts
   and dead-letter, which is correct: an unreadable credential is not self-healing, and the
   dead-letter panel is where a human sees it.
4. **Remote returns HTML, or `null`, or a bare string.** `json_decode` yields a non-array →
   `integrations.sync.error.bad_payload`, run `failed`, zero writes. Task 23, step 3.
5. **Remote returns 10 MB.** Size cap in `OutboundHttpClient::get()` (Task 17, step 4) →
   `payload_too_large` **without parsing**. Guzzle has already buffered the body, so this bounds
   parse cost and storage, not memory; note that in the comment so nobody claims more than it does.
6. **Remote paginates forever.** `max_pages` (50) and `max_records_per_run` (5000) both stop the
   loop; the run finishes `success`/`partial` with what it read, not `failed`. Decision 7.
7. **Remote `links.next` points at `http://169.254.169.254/`.** Never followed — pagination uses our
   own counter (Decision 7). Test §G asserts the second request's URL is our own base plus
   `page=2`.
8. **A record has no external id.** `records_failed++` with `missing_external_id`; the run
   continues. Task 23.
9. **A record's mapped `name` is blank on create.** `customers.name` is `NOT NULL` →
   `records_failed++` with `missing_name`, no insert. On **update** a blank name is simply an absent
   field (Decision 6) and changes nothing.
10. **Two ERP records share an email.** The second hits `customers_email_unique`
    (`create_customers_table.php:33`). `QueryException` caught per record → `records_failed++` with
    `duplicate`; the run completes `partial`. **One bad row never aborts a run.**
11. **A remote email is `not-an-email`.** Omitted by `SyncFieldMap` with a `bad_email` warning; the
    rest of the record still imports. It must never reach the unique index.
12. **A remote `tier` is `platinum`.** Not in `CustomerTier::values()` → omitted with `bad_tier`;
    the model's `$attributes` default (`Customer.php:27`) keeps `standard` on create.
13. **`wisal_wins` on a field whose local value is null.** Filled — Decision 6 says never *overwrite*
    a non-empty value, not never write.
14. **Second identical run.** Zero writes, `records_skipped = N`, `customers.updated_at` unchanged.
    Done Criterion 1. The trap is writing `external_synced_at` unconditionally, which would dirty
    `updated_at` — Decision 4 forbids it and Test §A4 asserts it.
15. **The field map changes between runs.** The next run's `attributesFor()` produces a different
    array, so previously-unmapped fields become dirty and the row updates. Done Criterion 2,
    Test §B.
16. **A ticket resolved, reopened, resolved again.** Two distinct `event_id`s
    (`…:1`, `…:2`) because the CSAT resolution cycle increments
    (`TicketResolutionObserver.php:70`). Both deliver. An update that touches other columns while
    the ticket is *already* Resolved emits nothing — `wasChanged('status')` is false (Task 24).
17. **A resolve inside a rolled-back transaction.** The outbox insert rolls back with it, and the
    `DB::afterCommit` callback never fires. Test §D3.
18. **A CSAT link submitted twice.** `$affected` is 0 on the second submit
    (`CsatSurveyController.php:69–78`), so the enqueue is skipped; even if it were not, the unique
    `(integration_id, event_id)` on `csat.submitted:{uuid}` makes it a no-op. Two independent
    guards, both asserted.
19. **`POST /api/tickets/bulk` resolving 100 tickets.** 100 outbox rows inserted; at most
    `inline_max_per_request` (5) attempted in that request; the remaining 95 drained by
    `sync:flush-outbox` within five minutes. The cap must **never** skip an enqueue. Test §D5.
20. **Receiver returns 500 five times.** attempts 1→5 with backoff 60/300/900/3600/10800 s, then
    `dead` with `max_attempts`. Done Criterion 3, Test §E1.
21. **Receiver returns 400.** `dead` immediately with `rejected`, `attempts = 1`. Decision 3.
22. **Receiver returns 301.** `allow_redirects => false` means a 3xx arrives as a status →
    permanent `rejected`. A redirect is an unvalidated hop and must not be followed.
23. **Receiver returns 429.** Retryable, same as a 5xx. It is the one 4xx that is.
24. **`sync:flush-outbox` runs with an empty outbox.** Creates **no** `SyncRun` (Task 27, step 5).
25. **Two `sync:flush-outbox` runs overlap.** `withoutOverlapping(10)` prevents it at the schedule
    level. Within one run, `scopeDue` + `orderBy('id')` + the per-message `save()` means a message
    is picked once; there is **no** row lock, so a manually-invoked concurrent run could double-send.
    Recorded as a known limitation — at-least-once is the delivery contract and
    `X-Wisal-Event-Id` is how the receiver de-duplicates.
26. **An integration is disconnected while its outbox has pending rows.** `cascadeOnDelete` removes
    the outbox rows and the run history. Customers keep their data (`nullOnDelete`) and become
    ordinary local customers.
27. **`migrate:fresh --seed`.** No integration is seeded (`IntegrationFactory`'s docblock), so
    `IntegrationEvents::record()` returns at step 2 after one query. Even if one existed, Task 21
    step 7 blocks the inline attempt in console. **Verify with an outbound-request count, do not
    trust the reasoning** — WIS-27 and WIS-23 both ran this check.
28. **The whole suite.** `INTEGRATION_SYNC_ENABLED=false` in `api/phpunit.xml` (Task 39) means no
    existing ticket or CSAT test starts writing outbox rows. A sync test opts in with
    `config(['integrations.sync.enabled' => true])`.
29. **`AdminAuthorizationTest`'s three sweeps hit `POST /integrations/erp/sync` and
    `/outbox/retry`.** Both 403 at the `administrator` middleware before any controller code runs,
    so no request is ever sent. Confirm by keeping `Http::fake()` out of that file and observing it
    still passes.
30. **`config:cache`.** `api/config/integrations.php` reads only `env()` and never throws or opens
    a connection. Verify with `php artisan config:cache && php artisan config:clear`.
31. **Half-applied migration.** The four migrations are independent; `sync_runs` and
    `integration_outbox` are new tables, and the two `Schema::table` migrations add only nullable
    columns and booleans with defaults. Rolling back three steps leaves a working WIS-19 app.
32. **A `json` column on PostgreSQL vs SQLite.** Laravel's `array` cast serialises to text on both.
    **Never query inside the JSON** — nothing in this story does.
33. **Unicode in a remote name or an external id.** `external_id` is `string(191)`; a longer id
    truncates on MySQL-family engines and errors on PostgreSQL. Cap it in `SyncFieldMap::read()`
    with `Str::limit($value, 191, '')` and count an over-long id as a `missing_external_id`-class
    failure rather than silently truncating into a collision.
34. **A run that throws mid-loop.** The `finally` in `CustomerPuller::pull()` finishes the row as
    `failed`, so no `running` row is left behind for a completed process. A row genuinely left
    `running` means the process died — that is information, and the UI renders it as such.

---

## Test Plan

Every test uses `Http::fake()`. **No test makes a real request and no test depends on DNS.**
Happy paths call `bindOutboundUrlGuard()` (Task 41); the security file (§G) binds nothing.
Files that touch the database use `uses(RefreshDatabase::class)`, matching
`api/tests/Feature/Admin/IntegrationListTest.php:9`.

### A — `api/tests/Feature/Sync/InboundCustomerPullTest.php` (new)

1. Imports three new customers from a one-page response; counters read 3 / created 3 / updated 0 /
   skipped 0 / failed 0; run `success`.
2. Follows pagination: two pages of `per_page` records then an empty third; asserts **three**
   recorded requests and that each URL carries our own `page=1|2|3`.
3. Applies the field map — a remote `attributes.display_name` lands in `customers.name`, a remote
   `contact.email` in `customers.email` **lower-cased** (proving the mutator ran).
4. **Idempotency:** run twice over identical data. Second run reads N, creates 0, updates 0, skips
   N; `customers.updated_at` is byte-identical to after the first run. *(Done Criterion 1.)*
5. A changed remote field updates exactly that column and bumps `external_synced_at`.
6. Upserts by `(integration_id, external_id)`, not by email: a remote record whose email matches an
   existing **local** customer with no external id creates a **new** row (and may fail on the unique
   index — assert the `duplicate` error row, not a silent merge).
7. `records_read` counts records, not pages.
8. `max_records_per_run` stops the loop and finishes `success`.
9. A `--dry-run` invocation writes no customer and no `SyncRun`.

### B — `api/tests/Feature/Sync/FieldMapAndConflictTest.php` (new)

1. `remote_wins` overwrites a non-empty local value.
2. `wisal_wins` leaves a non-empty local value untouched.
3. `wisal_wins` **fills** a null local value.
4. An absent remote field is never written under either rule.
5. A `null` remote field is never written.
6. An unmapped field is never written.
7. A field name not in `SyncFieldMap::FIELDS` present in a stored map is ignored.
8. A bad email is omitted with `bad_email` and the record still imports.
9. A bad tier is omitted with `bad_tier`; the row is created with `standard`.
10. **Editing the map changes the next run's writes**: run once with a map, save a new map through
    `PUT /sync-config`, run again, assert the newly-mapped column is now populated.
    *(Done Criterion 2.)*

### C — `api/tests/Feature/Sync/SyncRunHistoryTest.php` (new)

1. A successful run records accurate counters and a null `error_key`.
2. A run with two bad rows finishes `partial` with `records_failed = 2` and two entries in
   `errors`, each carrying an i18n `reason_key`. *(Done Criterion 4.)*
3. The error list is capped at `config('integrations.sync.max_error_rows')` while
   `records_failed` keeps counting past the cap.
4. `errors` never contains the secret, the endpoint, or an exception message — assert the JSON does
   not contain the factory's `sk_test_` prefix.
5. `GET /api/admin/integrations/erp/sync-runs` returns newest-first, paginated.
6. A guard-rejected run finishes `failed` with `finished_at` set and no `running` row left behind.
7. `duration_seconds` is null while running and an integer once finished.

### D — `api/tests/Feature/Sync/OutboundEventEnqueueTest.php` (new)

1. Creating a ticket enqueues exactly one `ticket.created` row with the frozen payload shape.
2. Resolving a ticket enqueues one `ticket.resolved` row with the cycle in its `event_id`.
3. **A rolled-back resolve enqueues nothing** and sends nothing.
4. Submitting a CSAT response enqueues one `csat.submitted`; **submitting the same link twice
   enqueues one row total.**
5. `POST /api/tickets/bulk` resolving 12 tickets enqueues **12** rows and attempts at most
   `inline_max_per_request`.
6. Nothing is enqueued when: `integrations.sync.enabled` is false / no ERP row exists /
   `outbound_enabled` is false / the event is not in `outbound_events` / `outbound_url` is blank.
   Five cases, one `Http::assertNothingSent()` each.
7. The payload contains no internal note, no `TicketMessage` body, no assignee, and no secret.
8. `description` and `comment` are truncated to `payload_max_chars`.
9. Enqueuing the same `event_id` twice inserts one row (unique violation swallowed, no exception
   surfaces to the caller).

### E — `api/tests/Feature/Sync/OutboxDeliveryTest.php` (new)

1. **Retry + dead-letter:** `Http::fakeSequence()` of five 500s. Drive five `sync:flush-outbox`
   runs (travelling past each `next_attempt_at` with `travelTo()`); assert `attempts` climbs 1→5,
   `next_attempt_at` follows the configured backoff, and the fifth leaves `status = dead`,
   `failed_at` set, `last_error_key = integrations.sync.error.max_attempts`.
   *(Done Criterion 3.)*
2. 500 then 200: delivered on the second attempt, `delivered_at` set, `last_error_key` null.
3. A 400 dead-letters immediately with `attempts = 1` and `rejected`.
4. A 301 dead-letters immediately (no redirect followed).
5. A 429 is retryable.
6. A connection exception (`Http::fake(fn () => throw new ConnectionException(...))`) is retryable
   and **stores no exception message anywhere** — assert `last_error_key` is a key and the record
   has no `message` field.
7. A message with `next_attempt_at` in the future is **not** picked up.
8. The POST carries `X-Wisal-Event`, `X-Wisal-Event-Id`, an `Authorization: Bearer` header and an
   `X-Wisal-Signature` whose HMAC verifies against the stored secret and the exact body.
9. `sync:flush-outbox` with an empty outbox creates no `SyncRun`.
10. A drain of 3 messages (2 delivered, 1 deferred) records read 3 / created 2 / skipped 1 /
    failed 0 on one outbound `SyncRun`.
11. `POST /outbox/retry` resets dead rows to pending with `attempts = 0` and returns `requeued`.

### F — `api/tests/Feature/Sync/SyncConfigEndpointTest.php` (new)

1. An administrator saves a valid config; the nine columns persist and the response's `sync` object
   mirrors them.
2. An `INTEGRATION_SYNC_CONFIG_CHANGED` audit row is written with the two URLs and **without** the
   secret or the field-map values.
3. `inbound_enabled: true` with no `inbound_url` → 422.
4. `inbound_enabled: true` with no `external_id` in the map → 422.
5. An `http://` URL → 422 (the FormRequest's `url:https`, before the guard).
6. An unknown field-map key → 422.
7. An unknown conflict rule value → 422.
8. An unknown `outbound_events` entry → 422.
9. Configuring a type with no `integrations` row → 404.
10. `POST /sync` on an integration with `inbound_enabled: false` → 422 `not_configured`.
11. `POST /sync` runs inline and returns a finished run with `trigger = manual`.
12. An Agent and a Team Lead get 403 on all five routes; an unauthenticated caller gets 401.
    *(Redundant with `AdminAuthorizationTest`'s sweep on purpose — that test proves the sweep is
    complete, this one proves these specific routes.)*

### G — `api/tests/Feature/Sync/SyncSsrfTest.php` (new) — **binds no guard fake**

1. `inbound_url = https://192.168.10.10/customers` ⇒ `Http::assertNothingSent()`, run `failed`,
   `error_key = integrations.error.blocked_host`. *(Done Criterion 5.)*
2. `inbound_url = https://127.0.0.1/customers` ⇒ same.
3. `inbound_url = https://localhost/customers` ⇒ same (dotless host).
4. `outbound_url = https://10.1.2.3/hook` ⇒ the message dead-letters with `blocked_host` and
   nothing is sent.
5. The guard runs **at send time**: configure a valid URL, deliver once successfully, then update
   the row to a private IP with a direct model write (bypassing the FormRequest, which is exactly
   the attack), and assert the next attempt sends nothing.
6. Pagination never leaves our base URL: a fake response carrying
   `links.next = "http://169.254.169.254/latest/meta-data"` is followed by a request to our own
   host with `page=2`. Assert on the recorded request URLs.

### H — `api/tests/Unit/Integrations/DnsOutboundUrlGuardTest.php` (new)

Port every case from `api/tests/Feature/Admin/IntegrationSsrfTest.php` to the guard directly:
`http://`, `localhost`, `127.0.0.1`, `192.168.1.10`, `[::1]`, a resolvable public host. Same four
error keys.

### I — `api/tests/Feature/Admin/IntegrationSsrfTest.php` (**unchanged — do not edit**)

It must pass untouched after Task 15. If it needs an edit, the extraction was not faithful. This is
the regression gate for Decision 1.

### J — `api/tests/Unit/Integrations/SyncFieldMapTest.php` (new)

Pure-function coverage of `read()` and `attributesFor()`: dot paths, missing paths, an array value,
a numeric value, whitespace-only, an over-long external id, both conflict rules × (create, update,
null-local, non-empty-local).

### K — `api/tests/Feature/ApiContractTest.php` (extend, do **not** restructure)

Add the `sync` object's keys to the `assertJsonStructure` at `:226–233`, and a second
`assertJsonMissingPath('data.0.sync.secret')` for symmetry with `:235`.

### L — `api/tests/Feature/Admin/AdminAuthorizationTest.php` (extend)

Append the five new routes to the contracted-endpoint list at `:64–85`. **Add no new placeholder.**

### M — `api/tests/Feature/Seeding/…` (extend the existing seeding test file)

Assert `migrate:fresh --seed` writes **zero** `integration_outbox` rows and sends zero outbound
requests, with `Http::fake()` + `Http::assertNothingSent()`.

### N — Frontend

Follow `web/src/features/integrations/pages/IntegrationsPage.test.tsx` and
`components/IntegrationModal.test.tsx` for the render harness.

1. `components/SyncSettingsPanel.test.tsx` — renders the saved config; toggling inbound enables the
   URL input; Save calls `saveSyncConfig` with the built body; an invalid https URL blocks submit.
2. `components/FieldMapEditor.test.tsx` — one row per `SYNC_FIELDS` entry plus `external_id`; the
   `external_id` row has no conflict select; an empty path omits the field from the submitted map;
   the conflict select is disabled while the path is empty.
3. `components/SyncRunHistory.test.tsx` — all four states; counters render with **inbound** labels
   for an inbound run and **outbound** labels for an outbound run; a failed run expands its errors.
4. `components/DeadLetterPanel.test.tsx` — hidden at `dead_letter_count === 0`; Retry all opens the
   confirm dialog and calls the mutation.
5. `components/IntegrationModal.test.tsx` (**extend**) — the three tabs render; Sync and History are
   disabled for a `not_connected` integration; the active tab round-trips through the URL; **every
   existing assertion in the file still passes.**
6. `pages/IntegrationsPage.test.tsx` (**extend**) — a card shows the dead-letter chip when the count
   is non-zero.
7. `web/src/i18n/catalogueParity.test.ts` passes with the new `en`/`ar` keys (it runs
   automatically; listed so the executor knows it is a gate).

**Estimated total: ~62 backend + ~20 frontend assertions across 12 new files and 5 extended ones.**

---

## Migration / Rollback

Four migrations, applied in filename order:

1. `2026_09_09_120000_add_sync_columns_to_integrations_table` — nine nullable/defaulted columns.
2. `2026_09_09_120100_create_sync_runs_table` — new table.
3. `2026_09_09_120200_create_integration_outbox_table` — new table.
4. `2026_09_09_120300_add_external_ref_to_customers_table` — three columns + one raw partial unique
   index.

**Rollback:** `php artisan migrate:rollback --step=4` reverses all four. Migration 4's `down()` must
`DROP INDEX IF EXISTS customers_external_ref_unique` **before** dropping the columns, or PostgreSQL
refuses. Use `dropConstrainedForeignId('integration_id')`, not `dropColumn`, so the FK constraint
goes with it.

**Half-applied states:** each migration is independent and additive. With 1–3 applied and 4 missing,
`CustomerPuller` fails on an unknown column — but nothing calls it, because sync configuration
requires an `integrations` row *and* `inbound_enabled`, which defaults to `false`. With all four
applied and the code rolled back, the columns are inert. **There is no destructive step and no data
backfill.**

**Existing data:** untouched. Every existing `integrations` row gets `inbound_enabled = false` and
`outbound_enabled = false`, so a deployment moves nothing until an administrator configures it.
Every existing `customers` row gets `integration_id = null` / `external_id = null` and is invisible
to the sync's upsert lookup — an ERP import will **not** adopt pre-existing local customers, which
is the safe default and worth stating in the release note.

---

## Verification Steps

1. **Backend migrations:** in `api/` —
   `php artisan migrate` then `php artisan migrate:rollback --step=4` then `php artisan migrate`.
   All three exit 0.
2. **Backend config:** in `api/` — `php artisan config:cache && php artisan config:clear`. Both
   exit 0 (proves `config/integrations.php` never throws).
3. **Backend tests:** in `api/` — `php artisan test`. The pre-WIS-24 baseline is **616 pass /
   ~2,902 assertions**; expect ~700 with this story. **Zero failures.** In particular
   `api/tests/Feature/Admin/IntegrationSsrfTest.php` must pass **unedited**.
4. **Backend style:** in `api/` — `./vendor/bin/pint --test` on the touched paths. New files clean;
   the pre-existing dirty files must gain no new violations.
5. **Scheduler:** in `api/` — `php artisan schedule:list` shows `sync:flush-outbox` every five
   minutes and `sync:pull-customers` hourly, alongside `sla:evaluate`.
6. **Seeder:** in `api/` — `php artisan migrate:fresh --seed`, then
   `php artisan tinker --execute="echo \App\Models\IntegrationOutboxMessage::count();"` → **0**.
7. **Manual inbound evidence** (optional, owner-facing): configure the ERP integration against any
   public JSON endpoint that returns a list, then
   `php artisan sync:pull-customers --dry-run` and read the printed tally. This is *evidence*, not
   a Done Criterion — every criterion is discharged by §A–§G under `Http::fake()`.
8. **Frontend tests:** in `web/` — `npm run test`. Baseline **580 pass / 93 files**; expect ~600.
9. **Frontend lint + i18n:** in `web/` — `npm run lint` (which runs
   `scripts/check-no-literals.mjs`) and `npm run i18n:check`. Both clean.
10. **Frontend build:** in `web/` — `npm run build`. Exit 0.
11. **RTL + dark:** open `/integrations`, switch to Arabic, open the Sync and History tabs, confirm
    the run history mirrors correctly and the counters read right-to-left. Then toggle dark mode.
12. **Secret sweep:** `grep -rn "sk_test_\|->secret" api/app/Services/Integrations api/app/Http/Resources`
    returns only `OutboundHttpClient`'s `withToken`/HMAC use. No resource, no log line, no
    `sync_runs` row, no outbox row carries it.
13. **Regression:** `git diff --name-only` must show **no** change to
    `api/tests/Feature/Admin/IntegrationSsrfTest.php`, and **no** new `composer.json` /
    `package.json` dependency.

---

## Done Criteria

- [x] A scheduled pull imports customers from a test endpoint and is idempotent across runs —
      `sync:pull-customers` registered in `api/routes/console.php`; §A1 and **§A4** (second run:
      created 0, updated 0, `updated_at` unchanged).
- [x] Editing the field map changes what is written on the next run — §B10 saves a new map through
      `PUT /sync-config` between two runs and asserts the newly-mapped column populates.
- [x] A ticket-resolved event is delivered outward, retried on 5xx, and dead-lettered after N
      attempts — §D2 (enqueue), §E2 (delivery), **§E1** (five 500s → `attempts` 1→5, backoff
      honoured, `status = dead`).
- [x] Sync-run history shows accurate counts and per-row errors — §C1, §C2, §C3, §C5, and the
      `SyncRunHistory` component's four states (§N3).
- [x] Every outbound request passes the existing SSRF guard — the guard is **extracted, not copied**
      (Task 14/15), `IntegrationSsrfTest.php` passes unedited (§I), and §G1–§G6 prove the sync path
      is guarded **at send time**, including the pagination-redirect case.
- [x] Tests: idempotency (§A4), conflict rules (§B1–§B5, §J), retry/dead-letter (§E1–§E7), mapping
      (§A3, §B, §J).
- [x] No second HTTP path: `grep -rn "Http::" api/app` returns
      `HttpIntegrationTester.php`, `OpenAiCompatibleAssistGenerator.php` and
      `OutboundHttpClient.php` — **three** hits, and no more.
- [x] No queue, no worker, no `ShouldQueue`, no new composer or npm dependency.
- [x] `migrate:fresh --seed` performs zero outbound requests and writes zero outbox rows (§M,
      Verification 6).
- [x] `web/src/i18n/locales/{en,ar}/integrations.json` `notice` no longer claims nothing moves, and
      `README.md:214`, `:454`, `:787` are corrected.
- [x] `php artisan test` green with zero failures; `npm run test`, `npm run lint`, `npm run build`
      green.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 26.**
