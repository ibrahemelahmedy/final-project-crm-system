# live-channel-ingestion — plan overview

Entry point for the **live-channel-ingestion** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 26 | [26-story-live-channel-ingestion.md](26-story-live-channel-ingestion.md) | Live Channel Ingestion — Inbound Webhooks, Thread Matching & Outbound Channel Replies (Category 3 completion) | WIS-22 | Stories 14, 04, 05, 03, 25, 18, 23, 24, 17, 06 |

## Dependency notes

**This is the second half of Category 3, and the last story in `.squad/pipeline.md`.** Story 14
(WIS-15) shipped the Channels screen as a read-only aggregate over `tickets.channel` and said
plainly on screen that nothing arrives automatically. This story makes a connected channel actually
deliver. Planned at **full** depth: every path, line range and signature was verified against real
code at plan time.

- **Depends on** [`../channels-overview/14-story-channels-overview.md`](../channels-overview/14-story-channels-overview.md).
  Story 14 owns `ChannelOverviewController`, `ChannelOverviewRequest`, `ChannelOverviewResource`,
  `web/src/features/channels/**`, `web/src/i18n/locales/{en,ar}/channels.json` and the three test
  files under `api/tests/Feature/Channels/`. **Its hardest constraint is that it wrote
  "not connected" into the suite as an assertion, not a comment:**
  `ChannelOverviewAuthTest.php:14-25` asserts `not_connected` for all five channels, and `:27-37`
  asserts that **exactly one** route's URI contains the substring `channels`, with no write verbs.
  Both are rewritten — not deleted — by this story's Task 60, and the second one fails the moment
  any route is added.
- **Depends on** [`../integration-data-sync/25-story-integration-data-sync.md`](../integration-data-sync/25-story-integration-data-sync.md).
  The most important dependency. WIS-24's own overview names this story twice: *"Any future
  outbound call — a WIS-22 channel provider included — binds this interface and calls `validate()`
  at send time. A second copy of the four checks is a defect."*, and its deferral list records
  *"An inbound webhook receiver … with signature verification is its own story, and its own threat
  model."* This story is that story. It inherits `OutboundUrlGuard` / `DnsOutboundUrlGuard` /
  `OutboundUrlVerdict` **by binding, never copying**, reuses `OutboundResponse` verbatim, and
  reproduces the outbox shape (durable row inside the business transaction, capped inline attempt,
  scheduled drain as the guarantee) including the Edge-Case-2 carve-out at
  `OutboxDispatcher.php:59-66` that WIS-24's plan-review had to add as a defect fix.
- **Depends on** Story 04 (ticket-management, WIS-2) and Story 05 (conversation-thread, WIS-3) —
  `tickets`, `ticket_messages`, `App\Enums\Channel`, `ticket_events`, and
  **`TicketMessageController.php:59`, the only place in `api/app` that writes an agent-authored
  message from a request.** That single call site is why the outbound enqueue is explicit rather
  than a model observer: `TicketScenarioSeeder` writes several hundred messages through the model.
- **Depends on** Story 03 (customer-management, WIS-4) — the `email`/`phone` mutators and
  **`Customer::phoneMatchCandidates()` (`Customer.php:104`)**, the existing tested answer to
  "which customer is this number?", which WhatsApp and SMS ingestion resolve senders with instead
  of writing a second normaliser.
- **Depends on** Story 23 (transactional-email, WIS-27) — outbound *email* replies ride WIS-27's
  Brevo-over-`smtp` mailer and its shared `resources/views/mail/layout.blade.php`. They get no new
  transport. **WIS-27's two delivery criteria are still unticked for want of Brevo credentials, so
  this story's Done Criterion 1 has two external dependencies, not one.**
- **Depends on** Story 24 (ai-customer-intelligence, WIS-23) for the `DB::afterCommit` +
  `app()->terminating()` + per-process-cap pattern and the `phpunit.xml` feature-flag precedent —
  **and is deliberately separate from its `portal_chat_*` tables.** WIS-23's chatbot is an AI
  conversation for an already-identified customer keyed on `portal_session_id`; this story's widget
  is an anonymous visitor on a third-party page whose whole purpose is to open a ticket.
- **Depends on** Story 17 (customer-portal, WIS-16) — `PortalAuth.php:20-51` and
  `PortalRequest.php:15-33` are the templates for the widget session middleware and accessor, and
  `portal_sessions` is the template for `chat_sessions`.
- **Depends on** Story 18 (integrations-erp, WIS-19) for the credential posture (`encrypted` cast
  + `$hidden` + absent from every Resource) and the error-is-an-i18n-key rule, and Story 08
  (users-roles-admin, WIS-8) for `AuditTrail`, the `administrator` gate and
  `AdminAuthorizationTest`.
- **Depends on** Story 06 (sla-rules-automation, WIS-6) for `api/routes/console.php` and the
  no-queue-worker constraint stated there as a design fact.
- **Blocks nothing.** A leaf, and the end of the pipeline.

**Contracts this story establishes**, which a later story consumes rather than redefines:

- **`channel_connections` is the one place a live channel is configured**, keyed on
  `App\Enums\Channel`, and **the absent row IS the `not_connected` state** — WIS-19's Decision 3
  reused, which is why the status enum has no `not_connected` case and disconnecting is a `DELETE`.
  `integrations` is **not** reused and **not** touched: its `type` is unique per ERP-shaped
  integration, its `endpoint_url` is NOT NULL, `IntegrationType` has no `chat` case, and its nine
  WIS-24 sync columns are ERP-record-shaped.
- **`App\Enums\ChannelProvider` is the third overlapping set**, after `Channel` and
  `IntegrationType`. It is keyed by *who signs the payload*, and one provider serves exactly one
  channel.
- **The signature is the only authentication a webhook has.** Verification hashes
  `$request->getContent()` — the raw bytes, never a re-encoded array — and compares with
  `hash_equals`. `App\Services\Channels\InboundWebhookAdapter` is the seam; a fourth provider is a
  new adapter and a config entry, not a change to the controller.
- **A verified webhook always answers 2xx.** Only an unverified request, or one whose body exceeds
  the pre-hash size cap, answers 4xx. Providers retry non-2xx aggressively and some disable a
  webhook after sustained failures, so every downstream outcome is caught and counted.
- **Idempotency is a unique `(channel_connection_id, provider_message_id)`**, and the second
  arrival is a **zero-write no-op** — it does not touch the ledger, `last_inbound_at`, or
  `tickets.updated_at`. The same table is the email threading map: one table, two jobs.
- **Sender identity beats headers, always.** `ThreadMatcher` discards any candidate ticket whose
  `customer_id` differs from the resolved sender, and returns `null` outright for an unrecognised
  sender. A forged `In-Reply-To` or a guessed `[#412]` subject token cannot inject a message into a
  stranger's thread.
- **`App\Services\Channels\ChannelHttpClient` is the one new socket**, and it binds
  `OutboundUrlGuard` and calls `validate()` **at send time on every call**. After this story
  `grep -rn "Http::" api/app` must return exactly **four** files; a fifth is a defect.
- **Outbound delivery is the outbox, not the inline attempt.** The row is written inside the
  agent's reply transaction (a rollback takes the delivery with it), the inline attempt is capped
  by `channels.outbound.inline_max_per_request`, and `channels:flush-outbound` is the guarantee —
  because there is still no queue worker.
- **A fourth audience.** `chat_sessions` + the `chat-widget` middleware is neither
  `auth:sanctum`/staff, nor `portal_sessions`/portal customer, nor a signed CSAT link. A widget
  token is structurally incapable of authenticating a staff or a portal route, and its routes are
  deliberately **outside** the `api/portal/` prefix, whose gate at `ApiContractTest.php:344-366` a
  webhook or an anonymous visitor cannot satisfy.
- **The widget embeds without a single security relaxation.** `config/cors.php`,
  `SecurityHeaders.php` and the contracted CSP string are byte-unchanged. The loader injects an
  iframe pointing at an unauthenticated **SPA** route, and `web/vercel.json` — which sets no
  headers and proxies `/api/(.*)` — makes that document framable *and* same-origin to the API. Any
  design that XHRs cross-origin from the host page has to widen `allowed_origins` for the whole
  `api/*` surface and is rejected.
- **Polling, not WebSockets**, following `api/routes/api.php:285-289`'s stated decision for
  notifications and the absence of anything to run a broadcaster beside.
- **`CHANNELS_ENABLED=false` in `api/phpunit.xml`**, joining `AI_CLASSIFY_ENABLED` (WIS-23) and
  `INTEGRATION_SYNC_ENABLED` (WIS-24), because the enqueue fires from
  `TicketMessageController@store`. Channel tests opt back in.
- **Errors are i18n keys resolved in the SPA**, following this feature's own convention
  (`ChannelOverviewResource`'s `label_key`) and WIS-24 Decision 11, not the repo-wide server-side
  `*_label` rule.
- **Ingested tickets inherit the existing observers for free.** `Ticket::created` already fires
  WIS-23's classification and WIS-24's ERP enqueue (`AppServiceProvider.php:123-133`), so an
  ingested ticket is classified with zero new code — and an ingestion test that binds an assist
  fake will have its queued response consumed by the classification observer, which is WIS-23's
  Edge Case 21 restated.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **Message attachments, in either direction.** The Jira scope permits *"a single attachment per
  message"*, but there is **no `ticket_message_attachments` table** — only `customer_attachments`,
  which hangs off a customer. Media also arrives from WhatsApp as a media id needing a second
  authenticated fetch. A table, a provider media-download path and a size/type/scan policy is its
  own story. Ingestion records that an attachment was present, says so in the message body, and
  drops the payload.
- **WhatsApp message templates.** A free-form reply more than 24 hours after the customer's last
  message is rejected by Meta and requires a pre-approved template. The rejection dead-letters with
  a readable reason; the template submission and approval flow is a separate story.
- **IMAP polling.** The Jira scope offered *"inbound webhook or IMAP poll"*. An IMAP client is a
  new composer dependency, a long-lived connection, credentials with far broader scope than a
  webhook secret, and a second ingestion path with different idempotency semantics.
- **WebSockets / push infrastructure.** Would remove the widget's poll interval and let an agent
  reply appear instantly. It is the same infrastructure decision as the queue worker, and the owner
  has not made it.
- **A queue worker.** Would remove the inline-delivery cap, the per-process counter and the
  five-minute drain latency in one move — the same deferral WIS-27, WIS-23 and WIS-24 each
  recorded.
- **Instagram, Messenger, Facebook page messaging and voice.** Verbatim from the Jira scope.
- **More than one connection per channel.** `channel_connections.channel` is unique, so a tenant
  cannot wire two inboxes or two WhatsApp numbers. Relaxing it means a routing rule (which
  connection owns which ticket) and is a real story, not a migration.
- **Outbound sends other than an agent's public reply.** No proactive or marketing sends, no bulk
  send, no template broadcast.
- **Agent-visible delivery state in the thread.** A dead-lettered reply is recorded in
  `channel_outbound_messages` and readable by an admin, but the thread does not yet render a
  "not delivered" marker beside the message. That is a small, self-contained follow-up and the
  first thing an agent will ask for.
- **Ledger retention.** Nothing prunes `channel_inbound_messages` or delivered
  `channel_outbound_messages`. Growth is bounded per message but unbounded in time; a `--prune`
  flag or a scheduled sweep is a one-task follow-up, the same one WIS-24 recorded for `sync_runs`.
- **A row lock on the outbound drain.** `withoutOverlapping(10)` prevents scheduled overlap; a
  manually-invoked concurrent `channels:flush-outbound` could double-send. At-least-once is the
  stated contract; a `lockForUpdate` on the due query is the fix the day that matters.
- **Widget appearance customisation.** No per-site theming, position, or copy beyond the site key
  and the allowed origins. The loader reads `data-*` attributes, so this is additive later.
