> **Fetched from jira:** [WIS-24](https://ibrahemelahmedy.atlassian.net/browse/WIS-24)  
> *Fetched 2026-09-09T04:39:00.386Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Integration data sync — pull/push with an external ERP (Category 11 completion)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

Category 11 (Integrations) shipped as the admin surface only (
    
                
            
            WIS-19
        
                                                    To Do
            
): an admin can add an integration, store a credential, run a guarded reachability test (HttpIntegrationTester), and read an audit trail. No data actually moves.

Goal

A connected integration keeps customer data in sync and emits ticket/CSAT events outward.

Scope

	Inbound sync: scheduled pull of customers/companies from a connected ERP; upsert by an external id; field-mapping UI; conflict rule (last-write-wins vs. Wisal-wins per field).

	Outbound events: on ticket created / resolved / CSAT submitted, POST a payload to the configured endpoint with retry + dead-letter.

	Sync-run history: per run — records read, created, updated, skipped, failed, with error detail.

	Reuses the existing integrations table and the SSRF-guarded HTTP client.

Out of scope

	A specific vendor connector (SAP/Oracle/Odoo) — this is the generic engine; a vendor mapping is a follow-up.

	Two-way real-time sync; scheduled + event-driven only.

Done criteria

	A scheduled pull imports customers from a test endpoint and is idempotent across runs.

	Editing the field map changes what is written on the next run.

	A ticket-resolved event is delivered outward, retried on 5xx, and dead-lettered after N attempts.

	Sync-run history shows accurate counts and per-row errors.

	Every outbound request passes the existing SSRF guard.

	Tests: idempotency, conflict rules, retry/dead-letter, mapping.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/integration-data-sync/WIS-24/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Integration Data Sync — Inbound Customer Pull & Outbound Event Push (Category 11 completion)
- **Feature slug (folder under `plans/`):** `integration-data-sync`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-24` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Integration data sync — pull/push with an external ERP (Category 11 completion)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Context

Category 11 (Integrations) shipped as the admin surface only (
    
                
            
            WIS-19
        
                                                    To Do
            
): an admin can add an integration, store a credential, run a guarded reachability test (HttpIntegrationTester), and read an audit trail. No data actually moves.

Goal

A connected integration keeps customer data in sync and emits ticket/CSAT events outward.

Scope

	Inbound sync: scheduled pull of customers/companies from a connected ERP; upsert by an external id; field-mapping UI; conflict rule (last-write-wins vs. Wisal-wins per field).

	Outbound events: on ticket created / resolved / CSAT submitted, POST a payload to the configured endpoint with retry + dead-letter.

	Sync-run history: per run — records read, created, updated, skipped, failed, with error detail.

	Reuses the existing integrations table and the SSRF-guarded HTTP client.

Out of scope

	A specific vendor connector (SAP/Oracle/Odoo) — this is the generic engine; a vendor mapping is a follow-up.

	Two-way real-time sync; scheduled + event-driven only.

Done criteria

	A scheduled pull imports customers from a test endpoint and is idempotent across runs.

	Editing the field map changes what is written on the next run.

	A ticket-resolved event is delivered outward, retried on 5xx, and dead-lettered after N attempts.

	Sync-run history shows accurate counts and per-row errors.

	Every outbound request passes the existing SSRF guard.

	Tests: idempotency, conflict rules, retry/dead-letter, mapping.
```

---

## Acceptance criteria

*(The six Done criteria from WIS-24, verbatim, as a checklist.)*

```
[ ] A scheduled pull imports customers from a test endpoint and is idempotent across runs.
[ ] Editing the field map changes what is written on the next run.
[ ] A ticket-resolved event is delivered outward, retried on 5xx, and dead-lettered after N attempts.
[ ] Sync-run history shows accurate counts and per-row errors.
[ ] Every outbound request passes the existing SSRF guard.
[ ] Tests: idempotency, conflict rules, retry/dead-letter, mapping.
```

**All six are code-verifiable with `Http::fake()`. No external account, no live ERP, no real
webhook receiver is needed.** This is the crucial difference from WIS-26 (needed a live AI key)
and WIS-27 (needs Brevo SMTP credentials before its two delivery criteria can be ticked). Every
criterion here describes *our* behaviour toward an HTTP endpoint — the pull's pagination and
upsert, the field map's effect, the retry/backoff/dead-letter state machine, the counters, and the
guard — and Laravel's HTTP fake can express all of it, including a sequence of 500s followed by a
200. `Http::fake()` plus `Http::assertNothingSent()` is already the established proof shape in
this repo (`api/tests/Feature/Admin/IntegrationSsrfTest.php`).

There is **no** "owner must paste a key" tail on this story. The only manual evidence worth
shipping is an `artisan` recipe (`sync:pull-customers --dry-run` against a throwaway public JSON
endpoint) and that is *evidence*, not a Done Criterion.

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | — |

None. Every fact this story needs is in the repository; the exact paths are under
**Technical hints** below.

---

## Dependencies

- **Blocked by:** nothing. WIS-25, WIS-26, WIS-27 and WIS-23 have all cleared.
- **Depends on code areas / other stories:**
  - **Story 18 — integrations-erp (WIS-19)**,
    `.squad/plans/integrations-erp/18-story-integrations-erp.md`. Owns the `integrations` table,
    `Integration`, `IntegrationType`, `IntegrationStatus`, `IntegrationResource`,
    `IntegrationPolicy`, `SaveIntegrationRequest` / `TestIntegrationRequest`,
    `Admin\IntegrationController`, the four `/api/admin/integrations*` routes, the four
    `AuditTrail::INTEGRATION_*` constants, `web/src/features/integrations/**`,
    `web/src/i18n/locales/{en,ar}/integrations.json`, and — the load-bearing one —
    **`IntegrationConnectionTester` + `HttpIntegrationTester`, the SSRF-guarded HTTP path.**
    Every WIS-19 decision still binds: the secret never leaves the server in any form but
    `secret_last_four`; `last_error` is an **i18n key**, never a raw exception message; the absent
    row *is* the not-connected state.
  - **Story 03 — customer-management (WIS-4)**,
    `.squad/plans/customer-management/03-story-customer-management.md`. Owns `customers`,
    `Customer` (including the `email` / `phone` mutators and the two partial unique indexes),
    `CustomerTier`, `CustomerController`, `StoreCustomerRequest` / `UpdateCustomerRequest`,
    `CustomerResource`, `CustomerPolicy`, `customer_notes`, `customer_attachments`. The inbound
    sync writes to `customers` and must not bypass what that story guarantees.
  - **Story 04 — ticket-management (WIS-2)** — the `ticket.created` event source
    (`TicketController@store`) and the `ticket.resolved` source (`TicketController@update` /
    `@bulk`). `ticket_events` stays the single ticket-history table; this story writes none.
  - **Story 13 — csat-collection (WIS-14)** — the `csat.submitted` event source
    (`CsatSurveyController@store`).
  - **Story 23 — transactional-email (WIS-27)** and **Story 24 — ai-customer-intelligence
    (WIS-23)** — the two established "no queue worker" deferral patterns this story copies:
    `DB::afterCommit` inside a model observer
    (`api/app/Observers/TicketResolutionObserver.php:104-138`) and
    `DB::afterCommit` + `app()->terminating()` + a per-process cap + a `$processed` id-set
    (`api/app/Observers/TicketClassificationObserver.php:52-100`).
  - **Story 06 — sla-rules-automation (WIS-6)** — the *only* scheduled-command precedent:
    `api/app/Console/Commands/EvaluateSlaCommand.php` and its registration in
    `api/routes/console.php:19-26`. Both new commands mirror it exactly.
  - **Story 08 — users-roles-admin (WIS-8)** — `AuditTrail`, the `administrator` middleware, and
    `AdminAuthorizationTest`, which walks the live route list.

## Extra notes (optional)

Findings verified against the code at plan time. Each is a trap the executor would otherwise hit.

1. **The SSRF guard is not reusable as written — it is welded into one method.**
   `HttpIntegrationTester::test()` (`api/app/Services/HttpIntegrationTester.php:21-48`) does the
   scheme check, the dotless-host check, the `gethostbyname()` resolution and the
   `FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE` check inline, then immediately performs
   a `HEAD`. There is no way to ask "is this URL safe?" without also making a reachability probe.
   Done Criterion 5 ("every outbound request passes the **existing** SSRF guard") therefore
   requires **extracting** those four checks into a standalone, injectable guard and having
   `HttpIntegrationTester` delegate to it — *not* copying them into a second file. A second copy
   is the failure mode this criterion exists to prevent, and it is also how the two copies drift.
   The extraction must keep the four `integrations.error.*` keys byte-identical, because
   `IntegrationSsrfTest.php` and `web/src/i18n/locales/{en,ar}/integrations.json` both pin them.

2. **`gethostbyname()` in the guard makes DNS a hidden test dependency.** The real guard resolves
   the host, so a happy-path sync test pointed at `https://api.example-erp.test/v1` (which is what
   `IntegrationFactory` writes, `api/database/factories/IntegrationFactory.php:31`) would be
   rejected with `integrations.error.unreachable` before `Http::fake()` ever saw it — the `.test`
   TLD does not resolve. The guard therefore has to be an **injectable seam** with a Pest binder
   (`bindOutboundUrlGuard()`, modelled on the existing `bindIntegrationTester()` at
   `api/tests/Pest.php:26-36`), so sync tests can allow the URL while the guard's own tests
   exercise the real implementation. Never make a test depend on live DNS.

3. **There is no queue worker in this repo, and this story must not pretend otherwise.**
   `QUEUE_CONNECTION=database`, the `jobs` table exists, nothing runs `queue:work`, nothing
   implements `ShouldQueue`, and `api/phpunit.xml:61` forces `sync`. `EvaluateSlaCommand`'s
   docblock says so in as many words. Outbound delivery is therefore: a **persistent outbox row
   written inside the same transaction as the business change** (so a rollback takes the event with
   it), a best-effort inline attempt deferred with `DB::afterCommit` + `app()->terminating()`, and
   a scheduled `sync:flush-outbox` drain that is the *real* delivery guarantee. Inline delivery is
   an optimisation; the outbox is the contract. Without the outbox table a 5xx at request time
   loses the event forever, which Done Criterion 3 forbids.

4. **`CsatSurveyController@store` fires NO Eloquent model event.** It writes with a query-builder
   `update()` inside a transaction (`api/app/Http/Controllers/CsatSurveyController.php:68-79`)
   precisely so a double submission touches zero rows. `CsatSurvey::observe(...)` would therefore
   **never fire** for a submitted response. The `csat.submitted` enqueue must be an explicit call
   in the controller, inside the same `DB::transaction` closure, guarded by `$affected > 0`
   (`:78`) so a re-submitted link enqueues nothing. This is the single most likely mis-implementation
   in the story.

5. **`POST /api/tickets/bulk` resolves up to 100 tickets in ONE transaction.**
   `TicketController@bulk` (`:214-…`) loops inside `DB::transaction`, and
   `BulkTicketActionRequest.php:19` caps `ids` at 100. Enqueuing 100 outbox rows is fine (they are
   inserts). Attempting 100 synchronous HTTP POSTs on the same request is not — WIS-27 hit the
   identical shape and answered it with `config('mail.csat.max_per_request')` (default 10). This
   story needs the same per-process cap on **inline delivery attempts only**; the enqueue is never
   capped, or events would be silently dropped. Anything not attempted inline is drained by the
   scheduled command. Reset the counter in `Tests\TestCase::setUp()` alongside the two counters
   already there (`api/tests/TestCase.php:19-23`).

6. **Every `/api/admin/*` route is walked by `AdminAuthorizationTest`.** `adminRoutes()`
   (`api/tests/Feature/Admin/AdminAuthorizationTest.php:36-58`) substitutes exactly four
   placeholders — `{user}`, `{type}`, `{branch}`, `{department}` — and the three "denies X on
   EVERY route" tests then call each one. A new admin route introducing a **fifth** placeholder
   (`{run}`, `{integration}`, `{message}`) would produce a literal `{run}` in the URL, 404 instead
   of 403, and fail the suite for the wrong reason. Every new endpoint in this story must therefore
   live under `/api/admin/integrations/{type}/...` with **`{type}` as its only route parameter**.
   Note also `api/routes/api.php:208-216`: `{type}` is deliberately left unconstrained, and must
   stay that way.

7. **`ApiContractTest`'s integrations assertion uses `assertJsonStructure`, which is not exact.**
   (`api/tests/Feature/ApiContractTest.php:226-233`.) Adding sync fields to `IntegrationResource`
   will **not** break it, and `assertJsonMissingPath('data.0.secret')` at `:235` keeps guarding the
   secret. So the sync configuration can be folded into the existing resource rather than needing
   its own GET endpoint. The plan should still extend that test with the new keys, so the shape is
   locked rather than merely tolerated.

8. **`customers` has two partial unique indexes created with raw `DB::statement`** —
   `api/database/migrations/2026_08_27_111743_create_customers_table.php:33-34` — because the
   schema builder has no API for them, and they are written to be valid on both PostgreSQL and
   SQLite. A `(integration_id, external_id)` uniqueness constraint that must ignore soft-deleted
   rows follows exactly that precedent; do not reach for a plain `unique()`, which would collide
   with soft-deleted rows.

9. **`Customer::setEmailAttribute` / `setPhoneAttribute` are mutators, not validation.** They
   lower-case, trim, blank-to-null, and derive `phone_normalized`. An inbound sync that writes with
   `Customer::create()` / `->fill()` gets that for free; one that writes with a query-builder
   `upsert()` **bypasses all of it** and will corrupt `phone_normalized` and collide on
   `customers_email_unique`. The sync must go through the model. It must also expect
   `QueryException` on a duplicate email/phone arriving from the ERP — `CustomerController` already
   catches exactly that (`:96-98`, `duplicateResponseFromQueryException`); the sync's equivalent is
   to count the row as **failed with a reason**, never to abort the run.

10. **A remote `updated_at` cannot be trusted, so "last-write-wins" must be redefined.** The intake
    says "last-write-wins vs. Wisal-wins per field". A literal clock comparison needs a trustworthy
    remote timestamp; an arbitrary ERP may not send one, may send it in an unknown timezone, and
    cross-system clock skew makes the comparison unsafe even when it does. The honest reading —
    and the one the plan must adopt and state out loud — is **authority, not chronology**:
    `remote_wins` = the ERP is authoritative for this field and always overwrites; `wisal_wins` =
    never overwrite a non-empty local value (fill a null, leave anything else alone). On **create**
    the rule is moot: every mapped field is written.

11. **The pull response is untrusted input and one specific trap is pagination.** Following a
    `links.next` URL returned *by the remote* re-opens SSRF from inside a response body, after the
    guard has already passed on the configured URL. Pagination must be driven by **our own** page
    counter against **our own** validated base URL, bounded by `max_pages`. Same class of rule:
    cap the response body size, whitelist the writable fields, never `eval`/`unserialize`, and
    never log the payload (it carries customer PII and the request carries the secret — WIS-19's
    rule at `HttpIntegrationTester.php:60-64` is that a transport exception message can embed the
    `Authorization` header, so **never** store `$e->getMessage()` in `sync_runs` or the outbox).

12. **The endpoint stored today is a single URL, and sync needs two more.** `integrations`
    has one `endpoint_url` (`:22` of the migration) used for the reachability probe. Inbound needs
    a *collection* URL and outbound needs a *receiver* URL, and they are not the same resource.
    Storing them as absolute https URLs in their own columns — rather than paths joined onto
    `endpoint_url` — avoids base-join and path-traversal ambiguity and lets the guard validate each
    one independently, at send time.

13. **`web/src/i18n/locales/en/integrations.json:4` currently promises the opposite of this
    story.** The `notice` string reads *"Sending and receiving messages through these providers is
    not enabled in this release."* It must be rewritten, in **both** `en` and `ar`
    (`catalogueParity.test.ts` requires identical key sets), and `npm run lint` runs
    `scripts/check-no-literals.mjs`, so every new string in the sync UI must come from a
    catalogue. The same claim appears in `README.md:214` and `README.md:787`.

14. **The frontend integrations modal is a single-purpose form with a `Phase` state machine.**
    `IntegrationModal.tsx` holds `'idle' | 'testing' | 'test_failed' | 'test_passed' | 'saving'`
    and a footer of five buttons. Sync configuration and run history do not fit inside it as more
    fields — the plan must decide between tabs inside the existing modal and a separate panel, and
    must specify all four async states (loading / error / empty / success) for the history list,
    per the index's cross-cutting rule. There is deliberately **no** Empty component in this
    feature today (`IntegrationsPage.tsx:18-22` explains why); a run-history list genuinely needs
    one.

15. **All SQL must be valid on PostgreSQL *and* SQLite** (index cross-cutting rule). No `NULLS
    LAST`, no `INTERVAL` arithmetic — compute the backoff instant in PHP and bind a Carbon value.
    Both `api/.env` and `api/phpunit.xml:50-56` point at PostgreSQL today because `pdo_sqlite` is
    blocked on the owner's machine (`docs/debugging/002-pdo-sqlite-blocked.md`), but the rule
    still holds. A `json` column type is fine on both engines with Laravel's `array` cast; querying
    *inside* the JSON is not, and this story never needs to.

16. **Nothing in this repo currently retries an outbound HTTP call.** `grep "Http::" api/app`
    returns exactly two hits: `HttpIntegrationTester.php:53` and
    `Services/Ai/OpenAiCompatibleAssistGenerator.php:34`. Neither uses `->retry()`. There is no
    existing backoff helper to reuse and no precedent to follow — the plan owns this design, and
    should prefer **persisted** attempts/`next_attempt_at` over Guzzle's in-process `->retry()`,
    because a dead-letter after N attempts spanning hours cannot live inside one request.

17. **`IntegrationFactory` has no seeder entry, on purpose** (its docblock: a seeded integration
    would show a fabricated CONNECTED card on a fresh install). Nothing this story adds may be
    seeded either. `migrate:fresh --seed` must still perform **zero** outbound requests — the same
    guard WIS-23 needed (`runningInConsole()`), and the same verification WIS-27 ran.

18. **The observer registration point is `AppServiceProvider::boot()`**, which already registers
    two `Ticket` observers (`:110-118`). A third is fine, but note the ordering consequence: all
    three fire on the same `updated` event, and the CSAT observer *creates a survey* which the
    outbound path may also want to reference. Keep the new observer's responsibility single —
    enqueue only, decide nothing — and let `csat.submitted` come from the controller (finding 4),
    not from the survey's creation.

## Technical hints (optional)

Repos/roots: `.` (`api/` Laravel 12 + `web/` React 19 + Vite). Files this story reads or touches:

**Integrations (WIS-19) — the foundation**
- `api/app/Services/IntegrationConnectionTester.php` — the seam interface and its docblock rules.
- `api/app/Services/HttpIntegrationTester.php:21-48` — **the guard to extract**, `:50-79` the
  probe, `:60-64` the never-log-the-exception rule.
- `api/app/Models/Integration.php` — `$fillable`, `$hidden`, the `encrypted` cast, the
  `DecryptException` note.
- `api/database/migrations/2026_09_03_100000_create_integrations_table.php`.
- `api/app/Enums/IntegrationType.php` (5 cases + `labelKey()` + `values()`),
  `api/app/Enums/IntegrationStatus.php` (3 cases, `NotConnected` never persisted).
- `api/app/Http/Controllers/Admin/IntegrationController.php` — `index()`'s "all five types, one
  query" contract, `save()`'s transaction + audit `match`, `destroy()`'s idempotent 204.
- `api/app/Http/Requests/SaveIntegrationRequest.php` (`url:https`, nullable secret),
  `TestIntegrationRequest.php`.
- `api/app/Http/Resources/IntegrationResource.php` — `forType()`, and the no-`secret` rule.
- `api/app/Policies/IntegrationPolicy.php`.
- `api/app/Services/AuditTrail.php:57-70` — the four `INTEGRATION_*` constants, `:79-104`
  `events()`, `:106-134` `label()`, `:154-161` `target()`. New constants are **added**, never
  renamed.
- `api/routes/api.php:208-220` — the admin integrations block and the `{type}`-unconstrained note.
- `api/database/factories/IntegrationFactory.php` — `error()` state; endpoint is `.test` (finding 2).

**Customers (WIS-4) — the inbound target**
- `api/database/migrations/2026_08_27_111743_create_customers_table.php` — columns and the two
  raw partial unique indexes at `:33-34`.
- `api/app/Models/Customer.php` — `$fillable` (`:20`), `$attributes` tier default (`:27`),
  `setEmailAttribute` (`:38-43`), `setPhoneAttribute` (`:50-56`), `normalizePhone`,
  `phoneMatchCandidates`, `scopeSearch`'s `ESCAPE '\'` note.
- `api/app/Enums/CustomerTier.php`.
- `api/app/Http/Controllers/CustomerController.php:88-101` — `store()` and the
  `QueryException` → duplicate mapping; `update()` at `:110-…`.
- `api/app/Http/Resources/CustomerResource.php`, `api/app/Policies/CustomerPolicy.php`,
  `api/database/factories/CustomerFactory.php`.

**The three outbound event sources**
- `api/app/Http/Controllers/TicketController.php:65-121` (`store`, ticket.created — note it runs
  **outside** a transaction), `:126-201` (`update`, the resolve path, `:188-194` the
  `DB::transaction`), `:214-…` (`bulk`, up to 100 in one transaction).
- `api/app/Http/Requests/BulkTicketActionRequest.php:19` — the 100 cap.
- `api/app/Observers/TicketResolutionObserver.php:52-64` — how "status became Resolved" is
  detected; `:104-138` — the `DB::afterCommit` + cap + `catch (Throwable)` pattern.
- `api/app/Observers/TicketClassificationObserver.php:41-100` — the
  `DB::afterCommit` + `app()->terminating()` + `runningInConsole()` guard + `$processed` id-set
  pattern, and why each piece exists.
- `api/app/Http/Controllers/CsatSurveyController.php:56-83` — `store()`, the query-builder
  `update()` at `:69-77` and the `$affected > 0` branch at `:78` (finding 4).
- `api/app/Models/CsatSurvey.php` — `uuid` is the only public id; `$fillable`; `state` accessor.
- `api/app/Models/Ticket.php:19-33` (`CATEGORIES`, `$fillable`), `casts()`, `booted()`.
- `api/app/Enums/{TicketStatus,Priority,Channel}.php`.

**Scheduling (WIS-6) — the only precedent**
- `api/routes/console.php:10-26` — `tasks:dispatch-due-reminders` and `sla:evaluate`
  (`everyFiveMinutes()->withoutOverlapping(10)->runInBackground()`), with the "no queue worker"
  comment that is this story's constraint in writing.
- `api/app/Console/Commands/EvaluateSlaCommand.php` — signature with `--dry-run`, `chunkById`,
  per-pass `$this->info("...: {$count}")` reporting, idempotence via nullable-timestamp guards.
- `api/app/Console/Commands/AiSmokeCommand.php`, `MailTestCommand.php` — the owner-facing
  manual-verification command shape.

**Config, bootstrap, providers**
- `api/config/ai.php` — the shape a new `api/config/integrations.php` should follow (env-backed
  values, no throwing, `config:cache` safe).
- `api/app/Providers/AppServiceProvider.php:52-56` (the `IntegrationConnectionTester` bind — where
  a guard bind goes), `:110-118` (`Ticket::observe(...)`).
- `api/bootstrap/app.php` — middleware aliases and the six rate limiters (this story needs none).
- `api/.env.example` — the per-story sub-block convention WIS-26/27/23 established.

**Frontend**
- `web/src/features/integrations/pages/IntegrationsPage.tsx` — URL-driven modal state
  (`?configure={type}`), the four states, and the "no Empty component" rationale.
- `web/src/features/integrations/components/IntegrationModal.tsx` — the `Phase` machine and the
  five-button footer.
- `web/src/features/integrations/components/{IntegrationCard,StatusPill,SecretField,IntegrationsSkeleton,IntegrationsError}.tsx`.
- `web/src/features/integrations/api/integrationsApi.ts` (the shared `api` Axios instance; do not
  create a second client), `api/queryKeys.ts` (`integrationKeys`, rooted at `['integrations']`,
  deliberately not under `ticketKeys.all`).
- `web/src/features/integrations/hooks/{useIntegrations,useSaveIntegration,useTestIntegration,useDisconnectIntegration}.ts`.
- `web/src/features/integrations/model/{types.ts,integrationSchema.ts}` — `unscopeKey()` and why
  it exists.
- `web/src/i18n/locales/{en,ar}/integrations.json` — including `notice` (finding 13) and the
  `error.*` keys the guard writes.
- `web/src/i18n/{index.ts,instance.ts,catalogueParity.test.ts,noHardcodedStrings.test.ts}`,
  `web/scripts/check-no-literals.mjs`.
- `web/src/features/integrations/{pages/IntegrationsPage.test.tsx,components/IntegrationModal.test.tsx,components/SecretField.test.tsx}`
  — the existing tests that must keep passing.

**Tests**
- `api/tests/Pest.php:20-36` — `bindIntegrationTester()`, the shape a `bindOutboundUrlGuard()`
  helper copies; `:48-72` the controller-caching warning that applies to any mid-test rebind.
- `api/tests/TestCase.php:12-24` — `setUp()`, where per-process counters are reset.
- `api/tests/Feature/Admin/IntegrationSsrfTest.php` — calls the **real** tester directly and
  asserts `Http::assertNothingSent()`; the guard extraction must keep every one of these green.
- `api/tests/Feature/Admin/{IntegrationListTest,IntegrationSaveTest,IntegrationSecrecyTest,IntegrationDisconnectTest,IntegrationTestConnectionTest,IntegrationAuditTest}.php`.
- `api/tests/Feature/Admin/AdminAuthorizationTest.php:36-58` (`adminRoutes()`), `:60-85` (the
  contracted-endpoint list), `:87-117` (the three deny-everything sweeps).
- `api/tests/Feature/ApiContractTest.php:216-235` — the integrations shape lock.
- `api/tests/Feature/{CustomerCrudTest,CustomerDuplicateTest,CustomerListTest,CustomerPolicyTest}.php`.
- `api/tests/Feature/Csat/*`, `api/tests/Feature/Sla/*`, `api/tests/Feature/Seeding/*`.
- `api/tests/Unit/IntegrationTypeTest.php`.
- `api/phpunit.xml` — the pgsql test connection, `MAIL_MAILER=array`, `QUEUE_CONNECTION=sync`,
  and `AI_CLASSIFY_ENABLED=false` (the precedent for defaulting a new outbound feature OFF in
  tests).

## Out of scope

- **No vendor connector.** No SAP / Oracle / Odoo / NetSuite adapter, no vendor-specific auth
  flow, no canned field map for a named product. This is the generic engine; the field map is how
  a vendor is expressed.
- **No two-way real-time sync.** No inbound webhook receiver, no push-from-ERP endpoint, no
  websocket, no polling loop faster than the scheduler. Scheduled pull + event-driven push only.
- **No queue, no worker, no `ShouldQueue`, no change to `QUEUE_CONNECTION`.** There is no
  infrastructure to run one (Extra note 3).
- **No new composer or npm dependency.** Laravel's `Http` client and Eloquent are sufficient.
- **No outbound sync of anything but the three named events.** No customer push, no KB push, no
  message-level mirroring, no attachment transfer.
- **No inbound sync of anything but customers/companies.** No ticket import, no order import, no
  product catalogue. `company` is a *column on `customers`*, not a separate entity — this story
  does not introduce a `companies` table.
- **No deletion propagation in either direction.** A customer removed from the ERP is not
  soft-deleted in Wisal; a customer deleted in Wisal is not deleted in the ERP. Deletes are a
  later story and the wrong thing to get wrong first.
- **No conflict *resolution UI*.** The per-field rule is configuration, chosen ahead of time; there
  is no "review these 12 conflicts and pick a winner" inbox.
- **No second HTTP path.** Every outbound request in this story — pull and push — goes through the
  one guarded client. A `Http::post(...)` written anywhere else in `api/app` is a defect.
- **No secret in any new surface.** Not in `sync_runs.errors`, not in an outbox payload, not in a
  log line, not in a response. `secret_last_four` remains the only derived value that leaves.
- **No changes to `ticket_events` or `audit_logs` semantics.** Sync activity is recorded in
  `sync_runs`; the four existing `AuditTrail::INTEGRATION_*` events cover admin configuration
  changes and this story adds at most a `integration.sync_config_changed` sibling.
- **No seeded integration and no seeded sync data.** `migrate:fresh --seed` must still make zero
  outbound requests (Extra note 17).
- **Not WIS-22.** No channel ingestion, no WhatsApp/SMS inbound, no message-provider webhooks.
