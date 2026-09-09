# integration-data-sync — plan overview

Entry point for the **integration-data-sync** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 25 | [25-story-integration-data-sync.md](25-story-integration-data-sync.md) | Integration Data Sync — Inbound Customer Pull & Outbound Event Push (Category 11 completion) | WIS-24 | Stories 18, 03, 04, 13, 06, 23, 24 |

## Dependency notes

**This is the second half of Category 11.** Story 18 (WIS-19) shipped the admin surface — connect,
store a credential, probe reachability, read an audit trail — and moved no data. This story makes a
connected integration actually sync. Planned at **full** depth: every path, line range and signature
was verified against real code at plan time.

- **Depends on** [`../integrations-erp/18-story-integrations-erp-admin.md`](../integrations-erp/18-story-integrations-erp-admin.md).
  Story 18 owns `integrations`, `Integration`, the two integration enums, `IntegrationResource`,
  `IntegrationPolicy`, `Admin\IntegrationController`, the four `/api/admin/integrations*` routes,
  the four `AuditTrail::INTEGRATION_*` constants and `web/src/features/integrations/**`. **Its
  hardest constraint is the one this story inherits wholesale:** `HttpIntegrationTester` is the only
  SSRF-guarded outbound path in the application, and Done Criterion 5 requires the sync engine to
  use *that* guard rather than a second copy of it.
- **Depends on** [`../customer-management/00-overview.md`](../customer-management/00-overview.md).
  The inbound pull writes to `customers`, through the model, so the `email` / `phone` mutators and
  the two partial unique indexes keep holding.
- **Depends on** Story 04 (ticket-management, WIS-2) and Story 13 (csat-collection, WIS-14) — the
  three outbound event sources. **The CSAT source is the trap:**
  `CsatSurveyController@store` writes with a query-builder `update()`, so no model event fires and
  an observer would never see it.
- **Depends on** Story 06 (sla-rules-automation, WIS-6) for `api/routes/console.php` and
  `EvaluateSlaCommand` — the only scheduled-command precedent in this repo, and the file whose
  comment states the no-queue-worker constraint as a design fact.
- **Depends on** Stories 23 and 24 (WIS-27, WIS-23) for the two deferral patterns it copies:
  `DB::afterCommit` inside an observer, and `DB::afterCommit` + `app()->terminating()` + a
  per-process cap.
- **Blocks nothing.** A leaf. WIS-22 (live channel ingestion) is next in `.squad/pipeline.md` and
  touches message providers, not this engine.

**Contracts this story establishes**, which a later story consumes rather than redefines:

- **`App\Services\Integrations\OutboundUrlGuard` is the one SSRF gate.** Extracted from
  `HttpIntegrationTester`, which now delegates to it. Any future outbound call — a WIS-22 channel
  provider included — binds this interface and calls `validate()` **at send time**. A second copy of
  the four checks is a defect.
- **`App\Services\Integrations\OutboundHttpClient` is the one outbound HTTP path for integrations.**
  `allow_redirects => false`, configured timeouts, bearer auth from the stored secret, a body-size
  cap on reads, and never a raw exception message in a stored field.
- **The outbox is the delivery guarantee; the inline attempt is an optimisation.** The row is
  inserted **inside the business transaction**; delivery is retried by `sync:flush-outbox`. This is
  the shape every later "send something outward" story should reuse, because there is still no queue
  worker.
- **Retries are persisted, and retryable ≠ permanent.** `attempts` + `next_attempt_at` +
  `config('integrations.sync.outbound.backoff')`; 408/429/5xx/transport are retryable, every other
  3xx/4xx and every guard rejection is permanent and dead-letters immediately.
- **Idempotency is a unique `(integration_id, event_id)` outbound and a zero-write no-op inbound.**
  A second identical pull writes nothing at all — not even `external_synced_at`.
- **"Last-write-wins vs Wisal-wins" means authority, not chronology.** A remote `updated_at` is not
  trusted; `remote_wins` always overwrites, `wisal_wins` only fills an empty local value.
- **The mappable field set is closed**: `SyncFieldMap::FIELDS` = `name, email, phone, company,
  tier`, plus `external_id` as the key. A remote record is never splatted into `fill()`.
- **`sync_runs` is one table for both directions**, and the counter meanings per direction are
  documented in `App\Models\SyncRun`'s docblock — one place, not two.
- **Sync error strings are i18n keys resolved in the SPA**, following this feature's own WIS-19
  convention rather than the repo-wide server-side rule. No `api/lang/*/integrations.php` exists.
- **Every new admin route carries `{type}` as its only parameter.** `AdminAuthorizationTest`
  substitutes exactly four placeholders; a fifth breaks the suite for the wrong reason.
- **`INTEGRATION_SYNC_ENABLED=false` in `api/phpunit.xml`** keeps the enqueue out of the three
  busiest paths in the suite; sync tests opt back in.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **A vendor connector.** SAP / Oracle / Odoo / NetSuite field maps and auth flows. This story is the
  generic engine; a vendor is expressed as a stored field map, and a canned preset is a small story.
- **A queue worker.** Would remove the inline-delivery cap, the per-process counter and the
  five-minute drain latency in one move. It is an infrastructure decision the owner has not made —
  the same deferral WIS-27 and WIS-23 both recorded.
- **An inbound webhook receiver.** Two-way real-time sync is explicitly out of scope; a
  `POST /api/integrations/{type}/events` endpoint with signature verification is its own story, and
  its own threat model.
- **Deletion propagation, in both directions.** A customer removed from the ERP is not soft-deleted
  here, and a customer deleted here is not deleted there. Deletes are the wrong thing to get wrong
  first.
- **Ticket, order and product import.** Only customers/companies are pulled, and `company` remains a
  column on `customers` — there is still no `companies` table.
- **A row lock on the outbox drain.** `withoutOverlapping(10)` prevents scheduled overlap; a
  manually-invoked concurrent `sync:flush-outbox` could double-send. At-least-once is the stated
  contract and `X-Wisal-Event-Id` is how a receiver de-duplicates. A `lockForUpdate` on the due
  query is the fix the day that matters.
- **`sync_runs` retention.** Nothing prunes the table. At an hourly pull plus a five-minute drain
  that is a bounded but unbounded-in-time growth; a `--prune` flag or a scheduled sweep is a
  one-task follow-up.
- **A conflict-resolution inbox.** The per-field rule is configuration chosen ahead of time; there is
  no "review these 12 conflicts and pick a winner" screen.
- **Adopting pre-existing local customers.** An ERP import matches only on
  `(integration_id, external_id)`, so it will never claim a customer created in Wisal. A one-off
  "match by email and link" reconciliation command is deliberately not built.
