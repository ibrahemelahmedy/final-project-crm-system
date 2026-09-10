# Story 26 — Live Channel Ingestion: Inbound Webhooks, Thread Matching & Outbound Channel Replies (Story: WIS-22)

The final story in the `.squad/pipeline.md` order, and the largest. It completes **Category 3**.

---

## Prerequisites

- **Story 14 completed** (`channels-overview`, WIS-15) —
  [`../channels-overview/14-story-channels-overview.md`](../channels-overview/14-story-channels-overview.md).
  Owns `ChannelOverviewController`, `ChannelOverviewResource`, `web/src/features/channels/**` and
  the three test files under `api/tests/Feature/Channels/`. **Every central claim it made is what
  this story reverses, and it wrote two of them into the suite as assertions** — see Decision 12.
- **Story 04 completed** (`ticket-management`, WIS-2) — `tickets`, `Ticket`, `App\Enums\Channel`,
  `ticket_events`, `Ticket::CATEGORIES`.
- **Story 05 completed** (`conversation-thread`, WIS-3) — `ticket_messages`, `TicketMessage`,
  `TicketMessageController` (the one agent-reply write site) and `scopePublicOnly()`.
- **Story 03 completed** (`customer-management`, WIS-4) — `customers`, the `email`/`phone`
  mutators, and `Customer::phoneMatchCandidates()`.
- **Story 25 completed** (`integration-data-sync`, WIS-24) —
  [`../integration-data-sync/25-story-integration-data-sync.md`](../integration-data-sync/25-story-integration-data-sync.md).
  **The most important dependency.** Its `00-overview.md` names this story twice: *"Any future
  outbound call — a WIS-22 channel provider included — binds this interface and calls `validate()`
  at send time. A second copy of the four checks is a defect."*, and its deferral list contains
  *"An inbound webhook receiver … with signature verification is its own story, and its own threat
  model."* **This is that story.**
- **Story 23 completed** (`transactional-email`, WIS-27) — the only real mail transport, the shared
  `resources/views/mail/layout.blade.php`, and `php artisan mail:test` as the discharge-recipe
  shape. Outbound *email* replies ride this; they do not get a new transport.
- **Story 24 completed** (`ai-customer-intelligence`, WIS-23) — `portal_chat_conversations` /
  `portal_chat_messages` and `/api/portal/chat*`. **A different feature from this story's chat
  widget; do not reuse either.** Also the source of the `DB::afterCommit` +
  `app()->terminating()` + per-process-cap pattern and the `phpunit.xml` feature-flag precedent.
- **Story 17 completed** (`customer-portal`, WIS-16) — `PortalAuth` and `portal_sessions` are the
  templates for the widget session middleware and table.
- **Story 18 completed** (`integrations-erp`, WIS-19) — the `encrypted` secret posture, the
  i18n-key-not-message error rule, and the `administrator`-gated admin group.
- **Story 06 completed** (`sla-rules-automation`, WIS-6) — `api/routes/console.php` and the
  no-queue-worker constraint stated there as a design fact.
- **Coordinate with nobody.** This is a leaf and the last story in the pipeline.

---

## Story Goal

Make a connected channel actually deliver. Six user-visible outcomes:

1. **A provider webhook becomes a ticket.** A verified inbound payload on a connected channel
   creates a ticket — or appends a public message to the right existing thread — with no agent
   action, through the same creation sequence `PortalRequestController@store` uses.
2. **A redelivered webhook changes nothing.** The provider's own message id is the idempotency
   key; the second arrival is a zero-write no-op that still answers `2xx`.
3. **An agent's public reply goes back out over the channel it arrived on.** Enqueued inside the
   reply's own transaction, attempted inline best-effort, and guaranteed by a scheduled drain with
   persisted backoff and dead-lettering — WIS-24's shape, because there is still no queue worker.
4. **A chat widget embeds on any static page and opens a ticket.** One `<script>` tag, no CORS
   change, no CSP exception, no external account. This is the channel this story can fully
   deliver, and the plan is arranged so it is provably done.
5. **`/channels` tells the truth in four states.** Per channel: `not_connected`, `connected` with
   a last-inbound timestamp and a 24-hour inbound count, or `error` with a localised reason when
   the credential is rejected.
6. **An Administrator can connect, test and disconnect a channel** from the Channels screen, with
   the secret never leaving the server in any form but `secret_last_four`.

**Not in scope** (the intake's Out-of-scope section is binding, and the four most likely
scope-creep temptations are): no Instagram/Messenger/voice; **no message attachments in either
direction** (there is no `ticket_message_attachments` table and building one is its own story);
**no WebSocket / push / Reverb** — polling, matching `api/routes/api.php:285-289`; **no IMAP
poll** — webhook only; no new composer or npm dependency; no queue worker; no second
SSRF-guarded HTTP path.

**Two of the six Done Criteria cannot be ticked in this story** — criterion 1 (a *real* inbound
email plus a delivered reply) and criterion 2 (a reply that *reaches a phone*) both need external
accounts the owner has not created. Criteria 3, 4, 5 and 6 are code-verifiable and must be green.
See **Owner Setup** below; this mirrors WIS-26's two live-key criteria and WIS-27's two delivery
criteria exactly, and `.squad/pipeline.md:13-17` already authorises it.

---

## Context — Read These Files First

1. `api/app/Enums/Channel.php` — the five cases (`email`, `whatsapp`, `chat`, `sms`, `web_form`)
   and `label()` resolving `__('enums.channel.'.$value)`. Labels live at
   `api/lang/en/enums.php:31-37` and the `ar` sibling. **`web_form` never gets a connection.**
2. `api/app/Http/Controllers/ChannelOverviewController.php` — the whole read path. Note
   `visibleTo($request->user())` **first** (the security boundary, inherited not re-derived), the
   single grouped aggregate, and the `'status' => 'not_connected'` literal in the `map()`.
3. `api/app/Http/Resources/ChannelOverviewResource.php:8-15,29-45` — the `data[]` + `meta` shape
   and the docblock claiming `status` is *"the literal string `not_connected` for every channel in
   this release"*. Both change.
4. `api/tests/Feature/Channels/ChannelOverviewAuthTest.php:14-37` — **the two tests this story
   must rewrite.** `:14-25` asserts `not_connected` for all five; `:27-37` filters the live route
   list on `str_contains($r->uri(), 'channels')` and asserts **`toHaveCount(1)`** with no write
   verbs. Read both before adding a single route.
5. `api/tests/Feature/Channels/ChannelOverviewTest.php` and `ChannelOverviewEmptyTest.php` —
   assert only `ticket_count` and `meta.*`. **Safe.** Adding keys to the resource does not touch
   them; do not edit them.
6. `api/app/Services/Integrations/OutboundUrlGuard.php` (interface) and
   `DnsOutboundUrlGuard.php:13-45` — the four checks in order (scheme, dotless host, resolution,
   private/reserved range) with their four `integrations.error.*` keys. **Bind and call; never
   copy.**
7. `api/app/Services/Integrations/OutboundHttpClient.php:18-135` — the posture to imitate:
   `validate()` at send time on **every** call (`:23-27`, `:72-76`), `allow_redirects => false`,
   configured timeouts, a body-size cap (`:57-61`), the `X-Wisal-Signature` HMAC (`:91`), and the
   catch at `:44-55` that logs `$e::class` and **never** `$e->getMessage()`.
8. `api/app/Services/Integrations/OutboundResponse.php:142-185` — the retryable/permanent
   classification and the five constructors. Reuse this class verbatim for channel sends; do not
   write a second response DTO.
9. `api/app/Services/Integrations/OutboxDispatcher.php:16-95` — the complete retry / backoff /
   dead-letter state machine, including the Edge-Case-2 carve-out at `:59-66` (a guard
   `unreachable` verdict is the one guard failure that is retryable). Copy the shape.
10. `api/app/Services/Integrations/IntegrationEvents.php:27-33,48-146` — the enqueue seam. Read
    the `:35-47` docblock: the payload is a **`Closure`** because building it eagerly ran a
    `loadMissing()` on every `Ticket::created` even with the flag off and poisoned an unrelated
    test's cached relation. Same trap here.
11. `api/app/Http/Controllers/TicketMessageController.php:42-124` — the **only** `AUTHOR_AGENT`
    write from a request (`:59`), the transaction boundary (`:56-105`), the `ticket_events`
    `replied` row (`:66-75`), and the advance-only `last_contact_at` rule (`:99-107`).
12. `api/app/Http/Controllers/Portal/PortalRequestController.php:101-153` — the programmatic
    ticket-creation sequence to mirror: explicit `status`/`channel`/`priority`, `created_by = null`,
    `Ticket::create()` **then** `SlaClock::applyTo()` **then** `save()` (the `:112-115` comment
    explains why the order is load-bearing), `TicketAssigner::pick()`, `recordAutoAssigned()`, and
    the first `ticket_messages` row from the description.
13. `api/app/Http/Requests/StoreTicketRequest.php:18-29` — why ingestion **cannot** use it:
    `category`, `priority` and `channel` are all `required`, and `authorize()` calls
    `$this->user()->can(...)` with no user on a webhook.
14. `api/app/Models/Customer.php:31-34,61-79,104-112` — `$fillable`, `setEmailAttribute` /
    `setPhoneAttribute` (which derive `phone_normalized`), and **`phoneMatchCandidates()`** — the
    existing tested answer to "which customer is this number?".
15. `api/app/Models/TicketMessage.php:16-22,26-28,63-78` — the author-type constants, `$fillable`
    (note `channel` is fillable but *"never client-supplied"* per `TicketMessageController.php:60`)
    and `scopePublicOnly()`, the customer-facing enforcement point.
16. `api/app/Http/Middleware/PortalAuth.php:20-51` — the template for a token-to-row middleware:
    resolve the bearer, check liveness, bind onto `$request->attributes`, **never** `Auth::login()`,
    one identical 401 body for every failure. Plus `api/app/Http/PortalRequest.php:15-33`, the
    accessor pattern.
17. `api/database/migrations/2026_09_02_100100_create_portal_sessions_table.php` — the session
    table template (`token_hash` unique, `expires_at`, `last_used_at`, `revoked_at`, `user_agent`).
18. `api/app/Http/Middleware/SecurityHeaders.php:11-21` — `X-Frame-Options: DENY` and
    `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, appended **globally**
    at `api/bootstrap/app.php:82` (so `routes/web.php` too), and asserted verbatim at
    `api/tests/Feature/ApiContractTest.php:43-50`.
19. `api/config/cors.php:11-30` — `paths: ['api/*']`, `allowed_origins` from `FRONTEND_URL`
    (default `http://localhost:5173`), `supports_credentials: false`. **Do not widen this.**
20. `web/vercel.json` — **no headers of any kind**, and `{ "source": "/api/(.*)", "destination":
    "https://wisal-crm-api.vercel.app/api/$1" }`. The SPA origin is framable *and* proxies the
    API. This single file is why Decision 10 works.
21. `web/vite.config.ts:5-12` — **there is no `server.proxy`.** The dev server does not serve
    `/api`. Adding one is Task 55, and without it the widget cannot be demonstrated locally.
22. `api/routes/api.php:53` (staff group), `:192-252` (admin group, and the `{type}`-only comment
    at `:222-233`), `:306-345` (the two portal groups and the never-`auth:sanctum` docblock at
    `:306-314`), `:347-363` (the signed public CSAT surface). Four groups today; this story adds
    two.
23. `api/bootstrap/app.php:22-79` — the seven named rate limiters and how they are registered;
    `:81-97` — the global appends and the three middleware aliases.
24. `api/tests/Feature/Admin/AdminAuthorizationTest.php:35-59` — **`adminRoutes()` substitutes
    exactly four placeholders** (`{user}`, `{type}`, `{branch}`, `{department}`). `:61-96` is the
    contracted endpoint list; `:126-138` asserts every `api/admin/*` route carries `auth:sanctum`
    + `administrator` + `active`.
25. `api/tests/Feature/ApiContractTest.php:337-366` — the portal-route gate: every `api/portal/*`
    route must carry a portal limiter or the `portal` guard and must **not** carry `auth:sanctum`.
    An anonymous widget route under that prefix cannot satisfy it. `:382-405` — the two WIS-23
    chat shape locks, which prove the portal chatbot is a separate feature.
26. `api/tests/Pest.php:27-38` (`bindIntegrationTester`), `:46-59` (`bindOutboundUrlGuard` and the
    DNS reason it exists), `:76-123` (`bindAssistGenerator` and the *route caches the resolved
    controller* warning — bind once per test, not per call), `:130-147` (`bindThrowingMailer`).
27. `api/tests/TestCase.php:13-28` — the three process-static counter resets. A fourth goes here.
28. `api/phpunit.xml:23-40` — the two feature-flag `<env>` blocks with their why-comments; `:71-76`
    the Postgres connection; `:79` `QUEUE_CONNECTION=sync`.
29. `api/config/integrations.php` — how a feature's knob file is laid out: nothing throws, nothing
    opens a connection, `config:cache` stays green.
30. `api/routes/console.php:16-47` — the four scheduled commands and the comment stating the
    no-queue-worker constraint.
31. `api/app/Console/Commands/AiSmokeCommand.php` and `MailTestCommand.php` — the owner-facing
    "prove it works" command shape this story needs three of.
32. `web/src/features/channels/model/channel.ts:11,55-66` — `export type ChannelStatus =
    'not_connected'` and `STATUS_LABEL_KEYS` with the comment *"There is deliberately NO
    `connected` entry … so a future bug cannot render a fabricated healthy state"*. Both change.
33. `web/src/features/channels/pages/ChannelsPage.tsx:186-275` and
    `components/ChannelCard.tsx:122-176` — the four async states, the admin-only release notice,
    and the card's status badge + three-state count slot.
34. `web/src/features/integrations/model/types.ts:1-42` and `components/StatusPill.tsx` — the
    mirror-the-Resource-exactly convention and the one-pill-not-two convention.
35. `web/src/lib/api.ts:30-50` — the one shared axios instance, its **absolute** `VITE_API_URL`
    base, and the `Accept-Language` interceptor with its *"any axios/fetch call made OUTSIDE this
    instance bypasses this"* warning. Decision 10 takes a documented exception to it.
36. `web/src/App.tsx:56-83` — the unauthenticated top-level routes (`/login`, `/feedback/:uuid`,
    `/portal/*`) that `/widget/chat` sits beside; `:143` — `/channels`.
37. `web/scripts/i18n-allowlist.json:3-22` — the 19 enforced roots. A **new** feature folder is
    not enforced automatically; adding it is Task 66.
38. Grep before you start, and again at the end:
    `grep -rn "Http::" api/app` returns **exactly three** files today
    (`Services/HttpIntegrationTester.php`, `Services/Ai/OpenAiCompatibleAssistGenerator.php`,
    `Services/Integrations/OutboundHttpClient.php`). After this story it must return **four**, the
    fourth being this story's one named channel client. A fifth is a defect.

---

## Decisions

Thirteen decisions. Each names the alternative it rejects and why, because several of them
contradict either the Jira text or a comment a previous story left in the code, and an executor
who does not know that will "fix" them back.

### Decision 1 — Channel connections live in a **new `channel_connections` table keyed on `App\Enums\Channel`**. `integrations` is **not** reused.

The Jira description says *"Builds on the existing channel enum and integrations table."* The enum,
yes. The table, no — and the reasons are structural, not stylistic:

- `integrations.type` is `string(32)->unique()`
  (`2026_09_03_100000_create_integrations_table.php:22`), so there is exactly one row per type.
- `endpoint_url` is `string(2048)` **NOT NULL** (`:25`). An inbound-only email channel has no
  outbound endpoint URL to put there, and a WhatsApp send URL is derived from a phone-number id,
  not configured.
- `App\Enums\IntegrationType`'s own docblock states it is *"deliberately NOT `App\Enums\Channel`"*
  and it **has no `chat` case** — the one channel this story can fully deliver.
- WIS-24 hung nine ERP-record-shaped columns off the same table
  (`2026_09_09_120000_add_sync_columns_to_integrations_table.php`); `inbound_field_map`,
  `conflict_rules` and `outbound_events` are meaningless for a message channel.
- `IntegrationResource` is contracted by `ApiContractTest.php:226-235`
  (`assertJsonStructure` over `data.0.sync` plus `assertJsonMissingPath('data.0.secret')`).

So: a new table, `channel_connections`, `channel` unique, one row per live channel. **The absent
row IS the `not_connected` state** — that is WIS-19's Decision 3, reused deliberately, which is
why there is no `not_connected` value in the status enum and why disconnecting is a `DELETE`.
`integrations` is not touched by this story at all: `git diff` must show no change to
`api/app/Models/Integration.php`, `IntegrationResource.php` or any `integrations` migration.

**Rejected:** adding `chat` to `IntegrationType` and folding channels into `integrations`. It
would make `endpoint_url` nullable (a schema change to another story's table), give
`IntegrationResource` two mutually-exclusive shapes, and put message channels on the Integrations
screen when Done Criterion 4 is explicitly about `/channels`.

### Decision 2 — Inbound webhooks are a **fifth public route group** at `api/webhooks/channels/{provider}`, gated by signature + a dedicated limiter. Never under `api/portal/`.

Four public/semi-public groups exist today (staff, admin, the two portal groups, signed CSAT).
This adds one more, with three properties:

- **`{provider}`, not `{channel}`.** One channel can change provider without changing its URL
  space, and the signature scheme belongs to the provider. The controller resolves
  `App\Enums\ChannelProvider::tryFrom($provider)` and `abort(404)` on an unknown value — the same
  one-layer-in guarantee `Admin\IntegrationController` gives for `{type}`.
- **Two verbs on the same URI.** `GET` is Meta's subscription handshake (Decision 3); `POST` is
  delivery. Twilio and the email relay use `POST` only, and their adapters answer the `GET` with
  `405`.
- **Not under `api/portal/`.** `ApiContractTest.php:344-366` walks every `api/portal/*` route and
  requires a portal limiter or the `portal` guard. A webhook has neither and never will.

Authentication is the **signature**, nothing else. There is no bearer token, no session, no signed
URL. A `throttle:channel-webhook` limiter is present but deliberately generous
(Decision 4's second half explains why a 429 here is dangerous).

### Decision 3 — Signature verification is a per-provider adapter over the **raw request body**, compared with `hash_equals`, and it is the whole threat model.

`InboundWebhookAdapter` has three methods and no others:

```php
interface InboundWebhookAdapter
{
    /** Constant-time signature check over the RAW body. Never throws. */
    public function verify(Request $request, ChannelConnection $connection): bool;

    /** Provider subscription handshake. Null when the provider has none. */
    public function challenge(Request $request, ChannelConnection $connection): ?Response;

    /** @return list<InboundMessage> Zero or more; never throws on malformed input. */
    public function parse(Request $request, ChannelConnection $connection): array;
}
```

**`$request->getContent()`, read once, is the only thing hashed.** `$request->all()` and
`$request->json()` hand back a re-decoded structure whose key order, unicode escaping and slash
escaping differ from the bytes that were signed, so the HMAC can never match. Comparison is
`hash_equals()`, never `===`.

The three schemes, all pure functions of `(raw body, headers, secret)` and therefore **fully
unit-testable with a hand-computed digest and no credentials**:

- **`whatsapp_cloud`** — `X-Hub-Signature-256: sha256=<hmac_sha256(raw, app_secret)>`. Handshake:
  `GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=N` → `200` with **`N` as
  `text/plain`** when `hub.verify_token` matches the stored verify token, `403` otherwise. Echoing
  the challenge without checking the token is the classic mistake and hands an attacker a
  subscription.
- **`twilio_sms`** — `X-Twilio-Signature` = `base64(hmac_sha1(fullUrl + concat(sorted POST params
  as key.value), authToken))`. It signs the **URL**, so it breaks behind a proxy that rewrites the
  host — recorded in Owner Setup, not worked around.
- **`email_webhook`** — providers differ and several offer no HMAC at all, so this reuses the
  repo's own scheme: `X-Wisal-Signature: sha256=<hmac_sha256(raw, secret)>`, byte-identical to what
  `OutboundHttpClient.php:91` *sends*. One scheme in the codebase, in both directions.

A failed verification returns **`401` with body `{"message": "..."}` and nothing else** — never
which of secret/payload/channel was wrong, and never whether the channel is connected. A missing
connection row returns the same `401`, so the endpoint does not disclose which channels are live.

### Decision 4 — A webhook that **passes** verification always answers `2xx`. Only verification failure is 4xx.

Providers retry non-2xx aggressively and some disable a webhook after sustained failures. So once
the request is proven authentic, every downstream outcome — unparseable envelope, unknown message
type, an ingestion exception, a duplicate — is caught, recorded, and answered `202 Accepted`. The
response body is `{"received": <int>}`, the count of messages accepted. Nothing else.

The corollary is the limiter: `throttle:channel-webhook` is **120/min keyed on
`provider|ip`**, not the 20-60/min the human-facing limiters use, because a 429 during a provider's
burst redelivery turns one slow request into an escalating retry storm. The limiter exists to bound
an attacker who has no valid signature, and unsigned requests are rejected before any query runs.

### Decision 5 — Idempotency is a **unique `(channel_connection_id, provider_message_id)`** on `channel_inbound_messages`, and that one table is also the **email threading map**.

Every provider supplies its own message id (`messages[0].id` for WhatsApp, `MessageSid` for
Twilio, the RFC-5322 `Message-ID` for email), so the guarantee is an index and not a heuristic.
Following WIS-24's Decision 4 and the note at
`2026_09_09_120200_create_integration_outbox_table.php:8-9`, a **plain `unique()`** is correct
here because the table has no soft deletes.

The second arrival is a **zero-write no-op**: it does not touch the row, does not bump
`channel_connections.last_inbound_at`, and does not create a `ticket_events` row — so
`tickets.updated_at` is *provably* unchanged, which is what the test asserts. It still answers
`202`.

The same table stores `external_thread_ref` (the `Message-ID`, `In-Reply-To` or `References` value
the message threads against), which makes it the lookup Decision 6's email branch needs. One
table, two jobs — the alternative is a second table that must be kept in lockstep with this one.

**The PostgreSQL detail WIS-24 was bitten by, recorded at `IntegrationEvents.php:92-104` and in
the pipeline run log:** on Postgres a unique violation **aborts the entire transaction**, so the
insert that may collide must sit in its own nested `DB::transaction()` (a SAVEPOINT) or the very
next statement fails with *"current transaction is aborted"*. The suite runs on Postgres
(`api/phpunit.xml:71-76`), so this surfaces in tests, not only in production.

### Decision 6 — Thread matching is **three genuinely different mechanisms** behind one `ThreadMatcher`, and **sender identity beats headers, always**.

```php
final class ThreadMatcher
{
    public function match(InboundMessage $message, ?Customer $customer): ?Ticket;
}
```

- **Email** — look up `channel_outbound_messages.provider_message_id` and then
  `channel_inbound_messages.provider_message_id` for each id in `In-Reply-To` + `References`
  (right-most first: the most recent ancestor wins). A hit yields the ticket. Fallback: a
  `[#<id>]` token in the subject, matched against `config('channels.subject_token_pattern')`.
- **WhatsApp / SMS** — no threading headers exist. `Customer::phoneMatchCandidates($from)` →
  customer → their most recent **non-closed** ticket **on that same channel** whose
  `updated_at` is inside `config('channels.thread_window_hours')` (default **72**) → else a new
  ticket. The window is a product decision (a reply three weeks later is a new issue) and lives in
  config, not in a magic number.
- **Chat** — `chat_sessions.ticket_id` holds the answer. There is nothing to match.

**The hard rule, enforced in `ThreadMatcher` and not in a caller:** a candidate ticket is discarded
unless `$ticket->customer_id === $customer?->id`. A forged `In-Reply-To` or a guessed `[#412]`
subject token is otherwise a way to inject a message into a stranger's ticket, and the subject
token in particular is trivially enumerable. When `$customer` is `null` (an unrecognised sender)
matching returns `null` unconditionally — a new customer never joins an existing thread.

An appended message is always `visibility = public`, `author_type = AUTHOR_CUSTOMER`,
`user_id = null`, `channel = $ticket->channel`. **Nothing ingested is ever `internal`.**
A message appended to a `Resolved` ticket reopens it, mirroring
`PortalRequestController.php:184-187` exactly (status → `Open`, `resolved_at = null`,
`recordReopened()`).

### Decision 7 — Ingestion creates tickets through **`IngestedTicketFactory`**, which mirrors `PortalRequestController@store`. It does **not** go through `StoreTicketRequest`.

`StoreTicketRequest.php:21-27` makes `category`, `priority` and `channel` all `required` and its
`authorize()` calls `$this->user()->can(...)`; there is no user on a webhook. The factory
reproduces the exact commented sequence from `PortalRequestController.php:105-146`:

1. `status = Open`, `channel = <the arriving channel>`, `priority = Priority::Normal`,
   `category = 'general'`, `created_by = null`, `customer_id = <resolved>`. Priority and category
   are set **explicitly** — `create()` does not re-read a DB default into the in-memory model and
   `SlaClock::applyTo()` needs a real `Priority` instance (`PortalRequestController.php:112-115`).
2. `Ticket::create()`, **then** `$this->clock->applyTo($ticket)`, **then** `$ticket->save()` —
   `applyTo()` anchors on `created_at`, which does not exist until the insert.
3. `TicketAssigner::pick()`; on a non-null pick set `assigned_to` and call
   `recordAutoAssigned($id)` (`Ticket.php:260-263`).
4. The first `ticket_messages` row from the body, `AUTHOR_CUSTOMER`, `user_id = null`.

**What comes for free, and must be asserted rather than rebuilt:** `Ticket::created` already fires
`TicketResolutionObserver`, `TicketClassificationObserver` (WIS-23 AI classification) and
`IntegrationEventObserver` (WIS-24 outbound ERP enqueue), in that order
(`AppServiceProvider.php:123-133`). An ingested ticket therefore gets AI classification and an
ERP event with **zero new code**. The symmetric trap: an ingestion test that binds an assist fake
finds its queued response **consumed by the classification observer** — exactly the mistake
WIS-23's Edge Case 21 recorded. Ingestion tests do not bind an assist fake;
`AI_CLASSIFY_ENABLED=false` is already the suite default (`api/phpunit.xml:32`).

Customer resolution is its own service, `InboundCustomerResolver`, and writes **through the
model** so `setEmailAttribute` / `setPhoneAttribute` still derive `phone_normalized`
(`Customer.php:61-79`). Match order: email (exact, lower-cased by the mutator) → then
`phoneMatchCandidates()` against `phone_normalized`. On no match, create with
`name = <provider display name> ?? <the identifier>`, `created_by = null`. A duplicate arriving
concurrently hits one of the two partial unique indexes
(`2026_08_27_111743_create_customers_table.php:34-35`) — catch `QueryException`, re-query, and
proceed; never abort the ingestion.

### Decision 8 — Outbound replies use **WIS-24's outbox shape** in a new `channel_outbound_messages` table, enqueued **explicitly at `TicketMessageController.php:59`**, not from a model observer.

There is still no queue worker: `api/routes/console.php:16-27` states it, `api/phpunit.xml:79`
forces `QUEUE_CONNECTION=sync`, nothing implements `ShouldQueue`. So the shape is the one WIS-24
proved: a durable row written **inside the reply's own transaction** (a rollback takes the delivery
with it), a best-effort inline attempt via `DB::afterCommit` + `app()->terminating()` bounded by a
per-process counter, and `channels:flush-outbound` as the actual guarantee.

**Explicit enqueue, not a `TicketMessage` observer.** `grep -rn "AUTHOR_AGENT" api/app
api/database` returns eleven hits; exactly one — `TicketMessageController.php:59` — is a write from
a request. The others are `TicketMessageFactory.php:35` and `TicketScenarioSeeder.php:281,452`,
and the seeder writes several hundred messages through the model on `migrate:fresh --seed`
(`TicketScenarioSeeder.php:444-460`). An observer would need a `runningInConsole` guard, a
visibility guard and an author guard just to stay silent; the controller already knows it is
handling a human agent's public reply. This is the same reasoning that forced WIS-24's explicit
`CsatSurveyController` enqueue.

Guards the enqueue applies, in order, each an early return:
`config('channels.enabled')` → `visibility === Public` → the ticket's channel is in
`Channel::deliverable()` (`email`, `whatsapp`, `sms` — **never** `chat` or `web_form`) → a
`channel_connections` row for that channel exists with status `connected` → the recipient
identifier is resolvable from the customer. Like `IntegrationEvents::record()`, the payload is
built by a **`Closure` invoked only after every guard has passed** — see the docblock at
`IntegrationEvents.php:35-47` for the bug that rule exists to prevent.

Idempotency: `unique(channel_connection_id, ticket_message_id)`. One reply, one delivery, however
many times the enqueue runs.

### Decision 9 — Email sends ride **WIS-27's mailer**; WhatsApp and SMS ride **one new guarded HTTP client**. The `ChannelSender` seam is what tests replace.

```php
interface ChannelSender
{
    public function send(ChannelConnection $connection, ChannelOutboundMessage $message): OutboundResponse;
}
```

`OutboundResponse` (`Services/Integrations/OutboundResponse.php`) is **reused verbatim** — its
five constructors already express exactly the retryable/permanent split the dispatcher needs.
Do not write a second response DTO.

- **`MailChannelSender`** — builds `ChannelReplyMail` on WIS-27's shared
  `resources/views/mail/layout.blade.php`, sets an explicit `Message-ID` and an `In-Reply-To`
  pointing at the inbound message it answers, sends through the configured mailer, and records the
  `Message-ID` it generated into `channel_outbound_messages.provider_message_id` — which is what
  makes Decision 6's email branch work on the *next* inbound. A `Throwable` from the transport is
  caught and mapped to `OutboundResponse::transportFailure()` (retryable), never logged with
  `getMessage()`.
- **`WhatsappCloudSender`** and **`TwilioSmsSender`** — both go through
  **`App\Services\Channels\ChannelHttpClient`**, the one new class in this story that opens a
  socket. It **injects `OutboundUrlGuard` and calls `validate()` at send time on every call**,
  mirroring `OutboundHttpClient.php:23-27`, with `allow_redirects => false`, configured timeouts,
  and the `:44-55` catch that logs `$e::class` only. This is the fourth and final `Http::` site in
  `api/app`; Verification Step 9 greps for it.

Both provider URLs are built from `config('channels.providers.*.base_url')` plus stored ids —
**never** from a value in a response body, which is WIS-24's Decision 7 applied here.
`graph.facebook.com` and `api.twilio.com` both resolve publicly over https and pass the real
guard; the *fake* guard (`bindOutboundUrlGuard()`, `api/tests/Pest.php:46-59`) exists because the
real one calls `gethostbyname()` and a test must not depend on live DNS.

**The WhatsApp 24-hour window is documented, not engineered around.** A free-form reply outside
24 hours of the customer's last message requires an approved message template. `WhatsappCloudSender`
sends free-form, and a `470`/`131047`-class rejection dead-letters with
`channels.error.outside_window`. Templates are explicitly out of scope.

### Decision 10 — The chat widget is a **loader script that injects an iframe pointing at an unauthenticated SPA route**. No CORS change, no CSP exception, no header override.

This is the decision that makes Done Criterion 3 achievable at all, and it turns on two facts in
the repo:

- **Laravel is hostile to embedding, by contract.** `SecurityHeaders.php:15-18` sets
  `X-Frame-Options: DENY` and `frame-ancestors 'none'` on every response the app produces, it is
  appended **globally** (`bootstrap/app.php:82`) so `routes/web.php` inherits it, and
  `ApiContractTest.php:43-50` asserts the exact CSP string. Meanwhile `config/cors.php:11-30`
  allows only `FRONTEND_URL`. A widget XHR-ing directly from a customer's site is refused; an
  iframe pointed at any Laravel route is refused.
- **The SPA deployable is not.** `web/vercel.json` sets **no headers at all** and rewrites
  `/api/(.*)` to the API host.

So: `web/public/widget.js` (plain ES5-safe JS, no build step, no JSX and therefore outside
`check-no-literals.mjs`) reads its own `<script data-*>` attributes and injects an iframe at
`<origin>/widget/chat?key=…`. The iframe document is a new **unauthenticated** SPA route
rendering `WidgetChatPage`, which calls `/api/widget/*` **same-origin** through the Vercel proxy.
Result: zero CORS involvement, zero CSP exception, zero per-route header override, and
`config/cors.php` is byte-unchanged.

Two consequences to implement rather than discover:

- **A second axios instance.** `web/src/lib/api.ts:30-35` builds the shared instance from an
  **absolute** `VITE_API_URL`, and its own comment warns that any call made outside it bypasses
  the `Accept-Language` interceptor. `web/src/features/chat-widget/api/widgetClient.ts` is a
  documented exception: `baseURL: '/api'` (relative, so the proxy applies), the same
  `Accept-Language` interceptor re-registered, and a docblock saying why it may not reuse `api`.
- **A Vite dev proxy.** `web/vite.config.ts:5-12` has no `server.proxy`, so `/api` 404s in local
  dev and the widget cannot be demonstrated. Task 55 adds
  `server: { proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } } }`.

The host page is untrusted, so the iframe is sandboxed from our side too: the widget posts nothing
back to the parent except a height message on a `wisal-widget:` prefixed channel, and
`WidgetChatPage` never reads `document.referrer` for authorisation — the site key is checked
server-side against `channel_connections.config->allowed_origins`, and the `Origin` header, not
the referrer, is what is compared.

### Decision 11 — Widget identity is its own **`chat_sessions`** table and a **`chat-widget`** middleware, modelled on `PortalAuth`. Delivery is **polling**.

An anonymous visitor on a third-party page is a fourth audience: not staff (`users` +
`auth:sanctum`), not a portal customer (`portal_sessions` + `portal`), not a signed CSAT link.
`PortalAuth.php:20-51` is the template — resolve the bearer to a row, check liveness, bind onto
`$request->attributes`, **never** `Auth::login()`, and return one identical `401` for missing,
unknown, revoked and expired. `App\Http\ChatWidgetRequest` is the single accessor, mirroring
`api/app/Http/PortalRequest.php:15-33`.

`chat_sessions.customer_id` is **nullable** — the visitor has no identity until they volunteer a
name and email through `POST /api/widget/chat/identify`, which is also what promotes the session
to a ticket. Before that, messages are held on the session and the ticket does not exist. This is
why WIS-23's tables cannot be reused: `portal_chat_conversations` is keyed on
`portal_session_id` and its whole premise is an already-identified customer (see
`ApiContractTest.php:382-405`).

**Polling, not WebSockets.** The Jira scope offers *"a websocket (or polling) transport"*; the repo
has already made this call twice and stated it — `api/routes/api.php:285-289`: *"MVP delivery is
POLLING, not WebSocket push — a deliberate decision"* — and there is no worker to run a
broadcaster beside. `GET /api/widget/chat/messages?after=<id>` returns messages newer than `<id>`;
the widget polls it on `config('channels.chat.poll_seconds')` (default 5) with a documented
`chat_sessions.last_seen_message_id` as the read cursor.

### Decision 12 — `/channels/overview` gains a `connection` object per channel. The two `ChannelOverviewAuthTest` tests are **rewritten, not deleted**, and the frontend's three "no connected state" claims are undone deliberately.

Story 14 did not merely comment that channels are read-only — it asserted it. Both landmines are
in `api/tests/Feature/Channels/ChannelOverviewAuthTest.php`:

- `:14-25` asserts `$channel['status'] === 'not_connected'` for all five channels.
- `:27-37` filters the live route list on `str_contains($r->uri(), 'channels')`, asserts
  **`toHaveCount(1)`**, and asserts no write verbs. **Every** route this story adds whose URI
  contains the substring `channels` — `api/admin/channels/{channel}`,
  `api/webhooks/channels/{provider}` — fails it the day it lands.

The rewrite (Task 60) preserves the *intent* of both rather than dropping them:

- The status test becomes: with no `channel_connections` rows every channel is `not_connected`
  (the honest default is still the default), and with one connected row exactly that channel is
  `connected` and the other four are not.
- The route test becomes: every route whose URI contains `channels` and is **not** under
  `api/webhooks/` carries either `auth:sanctum` (the overview) or `administrator` (the config
  routes); the only `GET /api/channels/*` route is still the overview; and no write verb exists
  outside the `administrator`-gated group. That is a **stronger** guarantee than
  `toHaveCount(1)` — it survives a sixth route instead of forbidding one.

The resource gains a nested `connection` object rather than overloading `status`, so
`ChannelOverviewTest.php` and `ChannelOverviewEmptyTest.php` — which assert only `ticket_count`
and `meta.*` — keep passing untouched. `status` itself becomes `not_connected` | `connected` |
`error`, sourced from the row and not a literal.

On the frontend the same claim is duplicated three times and each has to be undone deliberately:
`channel.ts:11` (`ChannelStatus`), `:55-66` (`STATUS_LABEL_KEYS` and its *"deliberately NO
`connected` entry … so a future bug cannot render a fabricated healthy state"* comment — the
comment is replaced with why it is now safe: the value comes from a row, not from a default), and
`ChannelsPage.test.tsx:73` (`getAllByText('Not connected')).toHaveLength(5)`).
`ChannelsPage.roles.test.tsx:22` pins `/Channel integrations are not available in this release/i`
in three tests; the notice becomes a link to the connect panel for an Administrator and the three
tests become "an Administrator sees the connect affordance; an Agent and a Team Lead see none",
which is the assertion that actually mattered.

### Decision 13 — `CHANNELS_ENABLED=false` in `api/phpunit.xml`, and three artisan commands are the owner's discharge recipe.

The precedent is three stories deep and is a hard rule: `api/phpunit.xml:32`
(`AI_CLASSIFY_ENABLED=false`, WIS-23) and `:40` (`INTEGRATION_SYNC_ENABLED=false`, WIS-24), each
with a comment naming the busy path it protects. This story's enqueue fires from
`TicketMessageController@store` — one of the busiest paths in the suite — so `CHANNELS_ENABLED`
joins them, and the channel test files opt back in with
`config(['channels.enabled' => true])`. The per-process inline-attempt counter resets in
`api/tests/TestCase.php` beside the three already there.

Three commands, modelled on `AiSmokeCommand.php` and `MailTestCommand.php`, because two of the six
Done Criteria can only ever be discharged by the owner:

- **`php artisan channels:ingest-fixture {provider} {--file=}`** — replays a stored provider
  payload through the *real* verification + ingestion pipeline (signing the fixture with the
  stored secret so verification genuinely runs) and prints the resulting ticket id. This is how
  the owner sees ingestion work before any account exists, and how they confirm a real payload
  they captured is understood.
- **`php artisan channels:test-send {channel} {ticket} {--body=}`** — enqueues and immediately
  attempts one outbound reply, printing the `OutboundResponse` outcome. This is the discharge for
  Done Criteria 1 and 2 once credentials are pasted.
- **`php artisan channels:flush-outbound`** — the scheduled drain, registered in
  `api/routes/console.php` beside the four already there, `everyFiveMinutes()` +
  `withoutOverlapping(10)` + `runInBackground()`, matching `sync:flush-outbox` (`:36-39`).

---

## Backend Tasks

### 1 — `Create file: api/config/channels.php`

Every knob the engine reads. Nothing throws, nothing opens a connection, no database access —
`artisan config:cache` must stay green (the rule `api/config/integrations.php` follows).

```php
return [
    // Master switch. OFF in tests (api/phpunit.xml) so no existing ticket/reply
    // test starts enqueuing or ingesting. A not-connected channel still moves
    // nothing even when this is true.
    'enabled' => (bool) env('CHANNELS_ENABLED', true),

    'inbound' => [
        // Bytes. A webhook body larger than this is rejected 413 BEFORE the
        // HMAC is computed — hashing an unbounded body is the cheap DoS.
        'max_body_bytes' => (int) env('CHANNEL_WEBHOOK_MAX_BYTES', 512 * 1024),
        // Longest inbound body copied into ticket_messages.body.
        'max_message_chars' => (int) env('CHANNEL_MESSAGE_MAX_CHARS', 5000),
        // Messages one webhook request may ingest (a WhatsApp envelope can
        // carry several).
        'max_per_request' => (int) env('CHANNEL_INBOUND_MAX_PER_REQUEST', 10),
        // Decision 6: how recently a ticket must have been touched to absorb a
        // phone-matched reply instead of a new ticket being opened.
        'thread_window_hours' => (int) env('CHANNEL_THREAD_WINDOW_HOURS', 72),
        // Decision 6's email fallback. Matched against the subject.
        'subject_token_pattern' => '/\[#(\d+)\]/',
    ],

    'outbound' => [
        'max_attempts' => (int) env('CHANNEL_OUTBOUND_MAX_ATTEMPTS', 5),
        // Seconds before attempt N+1, indexed by (attempts - 1); the last entry
        // repeats. Same ladder as config('integrations.sync.outbound.backoff').
        'backoff' => [60, 300, 900, 3600, 10800],
        // Deliveries ONE request may attempt inline. Bounds a burst of replies;
        // never bounds the enqueue, or replies vanish.
        'inline_max_per_request' => (int) env('CHANNEL_OUTBOUND_INLINE_MAX', 3),
        'batch_size' => (int) env('CHANNEL_OUTBOUND_BATCH', 100),
        'timeout' => (int) env('CHANNEL_OUTBOUND_TIMEOUT', 10),
        'connect_timeout' => 5,
    ],

    'chat' => [
        'poll_seconds' => (int) env('CHANNEL_CHAT_POLL_SECONDS', 5),
        'session_ttl_minutes' => (int) env('CHANNEL_CHAT_SESSION_TTL', 240),
        'max_messages_per_session' => (int) env('CHANNEL_CHAT_MAX_MESSAGES', 100),
        'max_message_chars' => (int) env('CHANNEL_CHAT_MAX_CHARS', 2000),
    ],

    // Provider base URLs are CONFIG, never read from a response body
    // (WIS-24 Decision 7 applied here). Guard-validated at send time regardless.
    'providers' => [
        'whatsapp_cloud' => [
            'base_url' => env('WHATSAPP_CLOUD_BASE_URL', 'https://graph.facebook.com/v21.0'),
        ],
        'twilio_sms' => [
            'base_url' => env('TWILIO_BASE_URL', 'https://api.twilio.com/2010-04-01'),
        ],
        'email_webhook' => [],
        'wisal_chat' => [],
    ],
];
```

### 2 — `Create file: api/app/Enums/ChannelProvider.php`

```php
enum ChannelProvider: string
{
    case EmailWebhook = 'email_webhook';
    case WhatsappCloud = 'whatsapp_cloud';
    case TwilioSms = 'twilio_sms';
    case WisalChat = 'wisal_chat';

    /** The Channel this provider can serve. One provider, one channel. */
    public function channel(): Channel { /* email|whatsapp|sms|chat */ }

    /** @return array<int, string> */
    public static function values(): array;
}
```

Docblock must state, like `IntegrationType`'s does, that this is **deliberately not**
`App\Enums\Channel` and deliberately not `App\Enums\IntegrationType`: it is the third overlapping
set, keyed by *who signs the payload*.

### 3 — `Create file: api/app/Enums/ChannelConnectionStatus.php`

`Connected = 'connected'`, `Error = 'error'`. **No `not_connected` case** — that state is the
absent row, exactly as `App\Enums\IntegrationStatus` documents at its `:6-12` docblock. (The
*resource* still reports `not_connected`; the enum does not carry it, so nothing can persist it.)

### 4 — `Create file: api/app/Enums/ChannelDeliveryStatus.php`

`Pending = 'pending'`, `Delivered = 'delivered'`, `Dead = 'dead'`. Mirrors
`App\Enums\OutboxStatus`.

### 5 — `Edit file: api/app/Enums/Channel.php`

Add two derived helpers and nothing else. **Do not add a sixth case and do not touch `label()` or
`options()`** — `ChannelOverviewController` iterates `Channel::cases()` and
`ChannelOverviewAuthTest` counts five.

```php
/** Channels a provider can be connected to. `web_form` never can — it is the portal form. */
public static function connectable(): array;   // email, whatsapp, chat, sms

/** Channels an agent reply can be delivered OUT over. `chat` is polled; `web_form` has no return path. */
public static function deliverable(): array;   // email, whatsapp, sms
```

Both derived from `cases()` by exclusion, so a sixth enum case does not silently become
connectable.

### 6 — `Create file: api/database/migrations/2026_09_09_140000_create_channel_connections_table.php`

One row per live channel. No CHECK constraints (the cross-engine rule in
`.squad/plans/00-index.md:136-140`, and the precedent at
`2026_09_03_100000_create_integrations_table.php:36-39`) — the enums plus the FormRequest are the
authority.

```php
Schema::create('channel_connections', function (Blueprint $table) {
    $table->id();
    // App\Enums\Channel value. Unique: one connection per channel, mirroring
    // integrations.type. The ABSENT row is the not_connected state.
    $table->string('channel', 16)->unique();
    $table->string('provider', 32);                 // App\Enums\ChannelProvider

    // Laravel's `encrypted` cast. text, never a sized string — ciphertext is
    // ~1.4x plaintext plus a MAC envelope (create_integrations_table.php:29-32).
    $table->text('secret')->nullable();             // HMAC / auth token
    $table->string('secret_last_four', 4)->nullable();  // the ONLY thing that leaves
    $table->text('verify_token')->nullable();       // WhatsApp handshake; encrypted

    // Non-secret provider settings: phone_number_id, from_number, account_sid,
    // inbound_address, allowed_origins[], site_key. NEVER a credential.
    $table->json('config')->nullable();

    $table->string('status', 16)->default('connected');   // ChannelConnectionStatus
    $table->timestamp('last_inbound_at')->nullable();
    $table->timestamp('last_outbound_at')->nullable();
    // Already an i18n key at write time (`channels.error.*`). NEVER a raw
    // exception message — a transport exception can embed the Authorization
    // header (OutboundHttpClient.php:44-55).
    $table->string('last_error_key', 120)->nullable();
    $table->timestamp('last_error_at')->nullable();

    $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

### 7 — `Create file: api/database/migrations/2026_09_09_140100_create_channel_inbound_messages_table.php`

The idempotency ledger **and** the email threading map (Decision 5).

```php
Schema::create('channel_inbound_messages', function (Blueprint $table) {
    $table->id();
    $table->foreignId('channel_connection_id')->constrained('channel_connections')->cascadeOnDelete();
    // The PROVIDER's own id: WhatsApp messages[0].id, Twilio MessageSid, the
    // RFC-5322 Message-ID. 191 to stay inside a btree key on any engine.
    $table->string('provider_message_id', 191);
    // The header this message threaded against (In-Reply-To / References tail),
    // so Decision 6's email branch is one indexed lookup.
    $table->string('external_thread_ref', 191)->nullable();

    $table->foreignId('ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
    $table->foreignId('ticket_message_id')->nullable()->constrained('ticket_messages')->nullOnDelete();
    $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
    // Whether this arrival opened a ticket or appended to one. Read by the tests.
    $table->string('outcome', 16);                  // created | appended | ignored
    $table->timestamp('received_at');
    $table->timestamps();

    // THE idempotency guarantee (Decision 5). A plain unique() is correct —
    // no soft deletes on this table (create_integration_outbox_table.php:8-9).
    $table->unique(['channel_connection_id', 'provider_message_id']);
    $table->index('external_thread_ref');
    $table->index(['ticket_id', 'received_at']);
    // Powers the /channels 24h inbound count in ONE aggregate.
    $table->index(['channel_connection_id', 'received_at']);
});
```

### 8 — `Create file: api/database/migrations/2026_09_09_140200_create_channel_outbound_messages_table.php`

The outbox, mirroring `2026_09_09_120200_create_integration_outbox_table.php`.

```php
Schema::create('channel_outbound_messages', function (Blueprint $table) {
    $table->id();
    $table->foreignId('channel_connection_id')->constrained('channel_connections')->cascadeOnDelete();
    $table->foreignId('ticket_id')->constrained('tickets')->cascadeOnDelete();
    $table->foreignId('ticket_message_id')->constrained('ticket_messages')->cascadeOnDelete();

    // Resolved at enqueue, not at send: the customer's email/phone can change
    // afterwards and the delivery must go where the reply was addressed.
    $table->string('recipient', 191);
    $table->text('body');
    // The Message-ID / provider id we EMITTED. Populated on success; this is
    // what the next inbound In-Reply-To matches against (Decision 9).
    $table->string('provider_message_id', 191)->nullable();
    // The inbound Message-ID this reply answers, for the In-Reply-To we send.
    $table->string('in_reply_to', 191)->nullable();

    $table->string('status', 16)->default('pending');   // ChannelDeliveryStatus
    $table->unsignedTinyInteger('attempts')->default(0);
    $table->timestamp('next_attempt_at')->nullable();
    $table->unsignedSmallInteger('last_status')->nullable();
    $table->string('last_error_key', 120)->nullable();  // i18n key only
    $table->timestamp('delivered_at')->nullable();
    $table->timestamp('failed_at')->nullable();
    $table->timestamps();

    // Decision 8: one reply, one delivery, however many times enqueue runs.
    $table->unique(['channel_connection_id', 'ticket_message_id']);
    $table->index(['status', 'next_attempt_at']);
    $table->index('provider_message_id');
});
```

### 9 — `Create file: api/database/migrations/2026_09_09_140300_create_chat_sessions_table.php`

Modelled on `2026_09_02_100100_create_portal_sessions_table.php`, with `customer_id` and
`ticket_id` **nullable** (Decision 11).

```php
Schema::create('chat_sessions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('channel_connection_id')->constrained('channel_connections')->cascadeOnDelete();
    // sha256 of the plaintext token, never the token (PortalSession::hashToken).
    $table->string('token_hash')->unique();
    // Nullable until the visitor identifies themselves. A chat_sessions token
    // is structurally incapable of authenticating a staff OR a portal route.
    $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
    $table->foreignId('ticket_id')->nullable()->constrained('tickets')->nullOnDelete();
    $table->string('visitor_name', 120)->nullable();
    $table->string('visitor_email', 191)->nullable();
    // The Origin header at start, checked against config->allowed_origins.
    $table->string('origin', 255)->nullable();
    $table->unsignedInteger('message_count')->default(0);
    $table->unsignedBigInteger('last_seen_message_id')->nullable();  // read cursor
    $table->timestamp('expires_at');
    $table->timestamp('last_used_at')->nullable();
    $table->timestamp('revoked_at')->nullable();
    $table->string('user_agent', 255)->nullable();
    $table->timestamps();

    $table->index(['ticket_id']);
});
```

### 10 — `Create file: api/app/Models/ChannelConnection.php`

`$fillable` = `channel, provider, secret, secret_last_four, verify_token, config, status,
last_inbound_at, last_outbound_at, last_error_key, last_error_at, connected_by`.
`$hidden = ['secret', 'verify_token']`. Casts: `channel => Channel::class`,
`provider => ChannelProvider::class`, `status => ChannelConnectionStatus::class`,
`secret => 'encrypted'`, `verify_token => 'encrypted'`, `config => 'array'`, the three timestamps
`datetime`. Relations: `connectedBy()`, `inboundMessages()`, `outboundMessages()`,
`chatSessions()`.

The docblock is `api/app/Models/Integration.php:11-26` restated for this table, verbatim in
substance: encrypted + `$hidden` + absent from every Resource means *"two independent things must
both fail before it can reach a response"*; rotating `APP_KEY` makes stored secrets
undecryptable and reading `secret` then throws `DecryptException`; the only places that read
plaintext are the adapters and senders, and each catches it.

### 11 — `Create file: api/app/Models/ChannelInboundMessage.php`

`$fillable` for every column; `received_at => 'datetime'`. Relations `connection()`, `ticket()`,
`ticketMessage()`, `customer()`. One scope, `scopeSince(Builder, CarbonInterface)`, used by the
24-hour count so the window lives in one place.

### 12 — `Create file: api/app/Models/ChannelOutboundMessage.php`

`$fillable` for every column; `status => ChannelDeliveryStatus::class`, the three timestamps
`datetime`. Relations `connection()`, `ticket()`, `ticketMessage()`. One scope, `scopeDue()`,
copying the shape `FlushOutboxCommand` uses: `status = pending` **and**
(`next_attempt_at IS NULL` **or** `next_attempt_at <= now()`), ordered by `id`.

### 13 — `Create file: api/app/Models/ChatSession.php`

Copy `api/app/Models/PortalSession.php` in structure: a static `hashToken(string $plain): string`
(sha256), an `isLive(): bool` (`revoked_at === null && expires_at > now()`), and a factory.
Relations `connection()`, `customer()`, `ticket()`.

### 14 — `Create file: api/app/Services/Channels/InboundMessage.php`

The canonical, provider-agnostic DTO every adapter produces and the ingestor consumes. A
`final readonly class` with a private constructor and named static builders, matching
`OutboundResponse`'s style.

```php
final readonly class InboundMessage
{
    public function __construct(
        public string $providerMessageId,
        public Channel $channel,
        /** Sender identity as the provider gave it: an email address or an E.164 number. */
        public ?string $fromEmail,
        public ?string $fromPhone,
        public ?string $fromName,
        public string $subject,          // '' for whatsapp/sms; the ingestor derives one
        public string $body,             // plain text, already stripped of quoted replies
        /** In-Reply-To / References tail, right-most first. Empty for whatsapp/sms. */
        public array $threadRefs,
        public bool $hadAttachment,      // recorded, never stored (Out of scope)
        public CarbonImmutable $occurredAt,
    ) {}
}
```

### 15 — `Create file: api/app/Services/Channels/InboundWebhookAdapter.php`

The interface exactly as in Decision 3. Docblock rules, stated as rules:

- `verify()` hashes **`$request->getContent()`** and compares with **`hash_equals`**. It must
  never throw and never log the signature or the secret.
- `parse()` must never throw on malformed input — it returns `[]`. Decision 4 depends on this.
- `challenge()` returns `null` for providers with no handshake; the controller then answers `405`
  on `GET`.

### 16 — `Create file: api/app/Services/Channels/WhatsappCloudAdapter.php`

- `verify()` — `X-Hub-Signature-256`, expected `'sha256='.hash_hmac('sha256', $raw, $secret)`,
  `hash_equals`. Absent header → `false`.
- `challenge()` — when `hub.mode === 'subscribe'`: `hash_equals` the query `hub.verify_token`
  against `$connection->verify_token`; on match `response($request->query('hub.challenge'), 200,
  ['Content-Type' => 'text/plain'])`; on mismatch `403`. **Checking the token is the point** —
  echoing the challenge unconditionally hands an attacker the subscription.
- `parse()` — walk `entry[].changes[].value.messages[]`. Skip `statuses[]` entirely (delivery
  receipts are not messages). Per message: `id`, `from` (E.164 without `+` — normalise by
  prefixing `+`), `text.body` or, for a non-text type, `hadAttachment = true` and a body of
  `__('channels.inbound.attachment_placeholder')`. Contact name from
  `value.contacts[].profile.name`. `threadRefs = []`.

### 17 — `Create file: api/app/Services/Channels/TwilioSmsAdapter.php`

- `verify()` — build the expected signature: the **full request URL** (`$request->fullUrl()`)
  concatenated with every POST parameter sorted by key as `key.value`, then
  `base64_encode(hash_hmac('sha1', $data, $token, true))`, compared to `X-Twilio-Signature` with
  `hash_equals`. **This is the one adapter that legitimately reads the parsed form fields** —
  Twilio signs a canonicalised parameter list, not the raw body. Say so in the docblock so nobody
  "fixes" it to `getContent()`.
- `challenge()` — `null`.
- `parse()` — one message: `MessageSid`, `From`, `Body`, `NumMedia > 0 → hadAttachment`.

### 18 — `Create file: api/app/Services/Channels/EmailWebhookAdapter.php`

- `verify()` — `X-Wisal-Signature`, `'sha256='.hash_hmac('sha256', $raw, $secret)`, `hash_equals`.
  Byte-identical in shape to what `OutboundHttpClient.php:91` sends.
- `challenge()` — `null`.
- `parse()` — one message from a documented envelope
  (`{message_id, from: {email, name}, subject, text, in_reply_to, references[], attachments[]}`).
  `threadRefs` = `references` reversed with `in_reply_to` first. Strip the quoted reply: cut at the
  first line matching `/^(>|On .+ wrote:|-{2,}\s*$)/m`, then `Str::limit(...,
  config('channels.inbound.max_message_chars'))`. A missing `text` with an HTML body falls back to
  `strip_tags`.

### 19 — `Create file: api/app/Services/Channels/ChannelAdapters.php`

The registry. `for(ChannelProvider $provider): InboundWebhookAdapter` via `match`, resolved from
the container so tests can rebind one adapter. An unknown provider is unreachable (the controller
resolves the enum first) but returns a `NullInboundWebhookAdapter` that verifies `false` — **never
throws**, following `AppServiceProvider.php:92-96`'s rule about `default` arms.

### 20 — `Create file: api/app/Services/Channels/InboundCustomerResolver.php`

`resolve(InboundMessage $message): Customer` per Decision 7: email first, then
`Customer::phoneMatchCandidates()` against `phone_normalized`, then create **through the model**
so the mutators run. Wrap the create in its own nested `DB::transaction()` and catch
`QueryException`; on a unique violation re-query and return the winner. Never abort ingestion for
a duplicate.

### 21 — `Create file: api/app/Services/Channels/ThreadMatcher.php`

Decision 6, in full, with the identity rule as the **last** step so it cannot be skipped:

```php
public function match(InboundMessage $message, ?Customer $customer): ?Ticket
{
    if ($customer === null) {
        return null;   // an unrecognised sender NEVER joins an existing thread
    }
    $candidate = match (true) {
        $message->threadRefs !== []      => $this->byThreadRefs($message),
        default                          => null,
    }
        ?? $this->bySubjectToken($message)
        ?? $this->byRecentChannelTicket($message, $customer);

    // THE security boundary. A forged In-Reply-To or a guessed [#412] subject
    // token must never attach a message to a stranger's ticket.
    if ($candidate === null || $candidate->customer_id !== $customer->id) {
        return null;
    }
    return $candidate;
}
```

- `byThreadRefs()` — for each ref, right-most first, look up
  `ChannelOutboundMessage::where('provider_message_id', $ref)` then
  `ChannelInboundMessage::where('provider_message_id', $ref)`; first hit's `ticket_id` wins.
- `bySubjectToken()` — `preg_match(config('channels.inbound.subject_token_pattern'), $subject)`
  → `Ticket::find($m[1])`.
- `byRecentChannelTicket()` — `whereBelongsTo($customer)`, `where('channel', $message->channel)`,
  `whereNot('status', TicketStatus::Closed)`, `where('updated_at', '>=',
  now()->subHours(config('channels.inbound.thread_window_hours')))`, `latest('updated_at')`,
  `first()`.

### 22 — `Create file: api/app/Services/Channels/IngestedTicketFactory.php`

Decision 7's four numbered steps, in that order, with the `PortalRequestController.php:112-115`
comment reproduced so the ordering is not "tidied". Constructor injects `SlaClock` and
`TicketAssigner`. Returns the `Ticket`. Subject: `$message->subject` when filled, otherwise
`__('channels.inbound.default_subject', ['channel' => $channel->label()])` truncated to 255
(`tickets.subject` is `string()`).

### 23 — `Create file: api/app/Services/Channels/MessageIngestor.php`

The provider-agnostic core. One public method; never throws.

```php
public function ingest(ChannelConnection $connection, InboundMessage $message): string  // the outcome
```

Order, each step an early return:

1. `config('channels.enabled')` false → `'ignored'`, no row.
2. **Duplicate check first**, before any write: an existing
   `(channel_connection_id, provider_message_id)` row → return `'duplicate'` having touched
   **nothing** — not the ledger, not `last_inbound_at`, not `tickets.updated_at`. Decision 5's
   zero-write no-op is asserted on exactly this.
3. `InboundCustomerResolver::resolve()`.
4. `ThreadMatcher::match()`.
5. In one `DB::transaction()`: either append (create the `ticket_messages` row `AUTHOR_CUSTOMER`
   / `user_id = null` / `channel = $ticket->channel` / `visibility = public`; `$ticket->touch()`;
   a `ticket_events` `replied` row exactly as `PortalRequestController.php:174-182` writes it;
   reopen if `Resolved`; advance `customers.last_contact_at` forward-only as
   `TicketMessageController.php:99-107` does) **or** create via `IngestedTicketFactory`. Then
   insert the `channel_inbound_messages` ledger row **inside its own nested `DB::transaction()`**
   (the Postgres SAVEPOINT of Decision 5) and catch `QueryException`: a unique violation means a
   concurrent duplicate — roll the outer work back and return `'duplicate'`.
6. After commit, `$connection->forceFill(['last_inbound_at' => now()])->saveQuietly()` —
   `saveQuietly` so the bump fires no model events, matching `PortalAuth.php:38-39`.

Never log the message body (customer PII) and never log the signature.

### 24 — `Create file: api/app/Services/Channels/ChannelHttpClient.php`

The **one** new class in this story that opens a socket, and the fourth `Http::` site in
`api/app`. Constructor injects `OutboundUrlGuard`. `post(string $url, array $payload, array
$headers, ?string $bearer, ?array $basicAuth): OutboundResponse`, structured exactly like
`OutboundHttpClient::post()`:

1. `$this->guard->validate($url)`; `! $verdict->ok` → `OutboundResponse::blocked($verdict->error)`.
   **At send time, every call** — the stored config can change between configuration and dispatch.
2. `Http::withOptions(['allow_redirects' => false])->timeout(...)->connectTimeout(...)`
   from `config('channels.outbound.*')`, `->acceptJson()`.
3. `try/catch (Throwable)` → `Log::warning` with `['host' => parse_url($url, PHP_URL_HOST),
   'exception' => $e::class]` and `OutboundResponse::transportFailure()`. **Never**
   `$e->getMessage()` — it can embed the `Authorization` header
   (`OutboundHttpClient.php:44-55`). This catch also covers a `DecryptException` from reading
   `$connection->secret`.
4. Classify with the same table as `OutboundHttpClient::classify()` (`:118-129`): 2xx success;
   408/429/5xx transient; everything else rejected.

### 25 — `Create file: api/app/Services/Channels/ChannelSender.php`

The interface from Decision 9. Docblock: implementations **never throw** and **never** put a raw
exception message into a returned or stored field; `OutboundResponse` is reused, not re-invented.

### 26 — `Create file: api/app/Services/Channels/WhatsappCloudSender.php`

`POST {base_url}/{phone_number_id}/messages` with a bearer of `$connection->secret` and body
`{"messaging_product":"whatsapp","to":<recipient>,"type":"text","text":{"body":<body>}}`. On
success read `messages[0].id` into the caller's `provider_message_id`. Map a
`131047`/`470`-class rejection body to `OutboundResponse::rejected()` and let the dispatcher
dead-letter it with `channels.error.outside_window` (Decision 9's documented 24-hour window).

### 27 — `Create file: api/app/Services/Channels/TwilioSmsSender.php`

`POST {base_url}/Accounts/{account_sid}/Messages.json`, basic auth `account_sid:auth_token`,
form body `From`/`To`/`Body`. On success read `sid`.

### 28 — `Create file: api/app/Services/Channels/MailChannelSender.php`

Decision 9's mail half. Generates a `Message-ID` of the shape
`<wisal-{ticketId}-{messageId}-{random}@{config('channels.providers.email_webhook.domain')}>`,
sends `ChannelReplyMail` with that id and an `In-Reply-To` of `$message->in_reply_to`, and returns
`OutboundResponse::success(200, '')` with the generated id assigned back. A `Throwable` from the
transport → `Log::warning($e::class)` + `OutboundResponse::transportFailure()`. Do not use
`Mail::fake()`-hostile constructs; the tests use `Mail::fake()` and read the sent mailable.

### 29 — `Create file: api/app/Mail/ChannelReplyMail.php` and `api/resources/views/mail/channel-reply.blade.php`

`@extends('mail.layout')` — WIS-27's shared layout — following
`api/resources/views/mail/csat-invitation.blade.php`. Copy `App\Mail\Concerns\BrandsMail` usage
from the existing mailables. Headers (`Message-ID`, `In-Reply-To`, `References`) go through
Symfony's `Headers` in `Mailable::headers()`, not into the view. Locale resolution copies WIS-27's
correction: set it in the **constructor**, not in `build()` (`Mailable::render()`/`send()` already
wrap `build()` in `withLocale()`, so the plan-then and the fix-now are recorded in
`.squad/pipeline.md`).

### 30 — `Create file: api/app/Services/Channels/ChannelSenders.php`

`for(ChannelProvider $provider): ChannelSender` via `match`, resolved from the container so
`bindChannelSender()` can replace one. `default` returns a `NullChannelSender` whose `send()`
returns `OutboundResponse::blocked('channels.error.no_provider')` — never throws.

### 31 — `Create file: api/app/Services/Channels/ChannelOutbox.php`

The enqueue seam, structurally `IntegrationEvents` (`:27-33,48-146`) with the same five parts:

```php
final class ChannelOutbox
{
    private static int $attemptedThisRequest = 0;

    public static function resetInlineCounter(): void;

    /** Never throws: a delivery enqueue must not fail the agent's reply. */
    public function enqueue(TicketMessage $reply, \Closure $payload): void;
}
```

Guards in Decision 8's order, then:

- Insert the row **inside the caller's transaction**, in its own nested `DB::transaction()`, and
  swallow a unique violation (`23000`/`23505` — copy `IntegrationEvents::isUniqueViolation()`
  at `:148-153`) as "already enqueued".
- `++self::$attemptedThisRequest > config('channels.outbound.inline_max_per_request')` → return;
  the drain will get it. **Never** log the body.
- `app()->runningInConsole() && ! app()->runningUnitTests()` → return, so
  `migrate:fresh --seed` performs zero sends.
- `DB::afterCommit(fn () => app()->terminating(fn () => /* re-read, attempt if still pending */))`,
  with the whole body in a `try/catch (Throwable)` that logs `$e::class` only. Re-reading the row
  and checking `status === Pending` is the guard — no `$processed` id-set is needed, exactly as
  `IntegrationEvents.php:129-136` explains.

**`$payload` is a `Closure`.** Read the docblock at `IntegrationEvents.php:35-47` before writing
this: building the envelope eagerly ran a relation load on every message create even with the flag
off, and poisoned an unrelated test's cached relation.

### 32 — `Create file: api/app/Services/Channels/ChannelOutboxDispatcher.php`

`attempt(ChannelOutboundMessage $message): ChannelDeliveryStatus`. Port
`OutboxDispatcher.php:16-95` line for line, with three substitutions and one addition:

- connection gone → `Dead`, `channels.error.connection_gone`.
- connection `status !== Connected` → **`Pending`** with the next backoff, not `Dead`: an admin
  fixing a rejected credential must not have lost the reply. (`OutboxDispatcher` has no analogue;
  this is the addition, and Edge Case 18 pins it.)
- `ChannelSenders::for($connection->provider)->send(...)`; on success write
  `provider_message_id`, `delivered_at`, `status = Delivered`, and bump
  `channel_connections.last_outbound_at`.
- **Keep the Edge-Case-2 carve-out from `OutboxDispatcher.php:59-66` verbatim in spirit:**
  `$retryable = $response->retryable || $response->errorKey === 'integrations.error.unreachable'`.
  A DNS blip is transient; `scheme` and `blocked_host` still dead-letter on attempt 1. WIS-24's
  plan-review found this missing and it was a real defect — do not lose it a second time.
- On a permanent failure, also write `last_error_key` + `last_error_at` and set
  `status = Error` on the **connection** when the response was an auth rejection (401/403), so
  Done Criterion 4's error state has a source.

### 33 — `Create file: api/app/Http/Controllers/Webhooks/ChannelWebhookController.php`

Two actions, and the ordering of the checks *is* the threat model.

```php
public function verify(Request $request, string $provider): Response;   // GET
public function receive(Request $request, string $provider): JsonResponse;  // POST
```

`receive()`:

1. `ChannelProvider::tryFrom($provider) ?? abort(404)`.
2. `strlen($request->getContent()) > config('channels.inbound.max_body_bytes')` → **`413`,
   before any HMAC is computed.** Hashing an unbounded body is the cheap DoS.
3. Look up the `ChannelConnection` for `$provider->channel()`. Absent, or
   `status !== Connected`, → the **same** `401` as a bad signature (Decision 3's
   non-disclosure rule).
4. `$adapter->verify($request, $connection)` false → `401`, body
   `['message' => __('channels.webhook_rejected')]` and nothing else. **This is the only 4xx
   path after step 2.**
5. `$adapter->parse(...)`, sliced to `config('channels.inbound.max_per_request')`.
6. Loop, `MessageIngestor::ingest()` each inside its own `try/catch (Throwable)` → log
   `$e::class` and count it as failed.
7. `response()->json(['received' => $accepted], 202)`. **Always 2xx from here on** (Decision 4).

`verify()`: resolve the provider, look up the connection (absent → `401`), then
`$adapter->challenge($request, $connection)`; `null` → `abort(405)`.

### 34 — `Edit file: api/app/Http/Controllers/TicketMessageController.php`

**One** addition, and it must land **after** the `DB::transaction()` at `:56-105` closes and
beside the existing after-commit mention dispatch at `:109-118` — the enqueue writes its row
inside the transaction via `DB::afterCommit`, so calling it here keeps the transaction boundary
the plan's Decision 8 describes:

```php
// Story 26 (WIS-22), Decision 8. The ONLY enqueue site — this is the one place
// in api/app that writes an agent-authored message from a request. Guards
// (feature flag, public-only, deliverable channel, connected channel, resolvable
// recipient) all live in ChannelOutbox::enqueue(); this call site stays one line.
$outbox->enqueue($message, fn () => ChannelOutbox::replyPayload($message, $ticket));
```

Inject `ChannelOutbox $outbox` as a **method** parameter on `store()`, matching how
`MentionResolver` and `NotificationDispatcher` are already injected at `:44-47`. **Do not** change
the transaction, the `ticket_events` row, the mention flow, or the `last_contact_at` rule.

### 35 — `Edit file: api/app/Http/Controllers/ChannelOverviewController.php`

Add the connection join and the 24-hour count. Keep `visibleTo($request->user())` **first** and
keep the single grouped aggregate — the docblock's *"ONE aggregate query — never fetch rows and
count them in PHP"* still binds.

- One extra query: `ChannelConnection::query()->get()->keyBy(fn ($c) => $c->channel->value)`
  (at most four rows).
- One extra aggregate: `ChannelInboundMessage::query()->since(now()->subDay())
  ->groupBy('channel_connection_id')->selectRaw('channel_connection_id, count(*) as aggregate')
  ->pluck('aggregate', 'channel_connection_id')`.
- In the `map()`, replace the `'status' => 'not_connected'` literal with the row's status (absent
  row → `not_connected`) and add a `connection` key: `['provider', 'last_inbound_at',
  'inbound_24h', 'last_error_key', 'connectable']`, or `null` when there is no row.

**The 24-hour count is deliberately NOT `visibleTo`-scoped**, and the docblock must say why: it
counts *arrivals on a wire*, not tickets an agent may read, so scoping it would make two agents
disagree about whether a channel is receiving traffic. `ticket_count` stays scoped exactly as it
is.

### 36 — `Edit file: api/app/Http/Resources/ChannelOverviewResource.php`

Add the nested `connection` object to each `data[]` entry and **rewrite the `:8-15` docblock** —
it currently claims `status` is *"the literal string `not_connected` for every channel in this
release — it is a field, not a computed health check"*. It is now sourced from a row. Say that,
and say that `last_error_key` is an i18n key resolved in the SPA (Decision 14 in the intake's
Extra note 14 — this feature's convention, following `label_key`).

Adding keys is safe: `ChannelOverviewTest.php` and `ChannelOverviewEmptyTest.php` assert only
`ticket_count` and `meta.*`.

### 37 — `Create file: api/app/Http/Resources/ChannelConnectionResource.php`

`channel`, `label_key`, `provider`, `status`, `secret_last_four`, `config` **filtered to a
non-secret allowlist** (`phone_number_id`, `from_number`, `account_sid`, `inbound_address`,
`allowed_origins`, `site_key`), `last_inbound_at`, `last_outbound_at`, `last_error_key`,
`last_error_at`. **No `secret`, no `verify_token`, ever.** Model the allowlist on
`IntegrationResource`'s `secret_last_four`-only posture; a `config` blob echoed wholesale is how a
credential leaks once someone stores one in it.

### 38 — `Create file: api/app/Http/Requests/SaveChannelConnectionRequest.php`

`authorize()` → `$this->user()->can('update', ChannelConnection::class)`. Rules:

- `provider` — `required`, `Rule::in(ChannelProvider::values())`, plus an `after` hook rejecting a
  provider whose `channel()` is not the route's `{channel}` (422, not a silent mismatch).
- `secret` — `nullable|string|max:500`. **Absent means "keep the stored one"**, empty string means
  clear — the same three-state contract `SaveIntegrationRequest` uses.
- `verify_token` — `nullable|string|max:255`, same three states.
- `config` — `array`, with per-key rules and **no wildcard**: `config.phone_number_id`,
  `config.from_number`, `config.account_sid`, `config.inbound_address`,
  `config.allowed_origins` (`array|max:10`, each `url`), `config.site_key`. An unlisted key is
  dropped by `validated()`, which is what keeps a credential out of `config`.
- Route `{channel}` must be in `Channel::connectable()` — a `PUT` for `web_form` is **404** from
  the controller, matching `Admin\IntegrationController`'s unknown-type behaviour.

### 39 — `Create file: api/app/Http/Controllers/Admin/ChannelConnectionController.php`

Four actions, `{channel}` as the **only** route parameter (Task 41's note).
`index()` (all connectable channels, connected or not), `save()` (upsert + `AuditTrail`),
`test()` (a credential probe — for `whatsapp_cloud` a `GET {base_url}/{phone_number_id}` through
`ChannelHttpClient`; for `twilio_sms` a `GET .../Accounts/{sid}.json`; for `email_webhook` and
`wisal_chat` a **local** validation only, since neither has an endpoint to probe — return
`{"ok": true, "checked": false}` rather than faking a probe), and `destroy()` (delete the row;
the absent row is the not-connected state).

`save()` writes `secret_last_four` from the plaintext before the `encrypted` cast swallows it,
never echoes the secret, and stores `last_error_key` as a key. `test()` failure sets
`status = Error` + `last_error_key`; success sets `status = Connected` and clears both.

### 40 — `Create file: api/app/Policies/ChannelConnectionPolicy.php` (+ register)

Copy `api/app/Policies/IntegrationPolicy.php`: administrator-only for `viewAny`/`update`/`delete`.
The route group already carries the `administrator` middleware, so this is the second, in-depth
layer WIS-19 established — and it is what makes the 403 come from the same authority
`AdminAuthorizationTest` asserts against.

### 41 — `Edit file: api/routes/api.php`

Three additions.

**(a) Inside the existing `Route::prefix('admin')->middleware('administrator')` group**
(`:192-252`), after the WIS-24 sync block:

```php
// ---- Channel connections (Story 26, WIS-22) --------------------------
//
// `{channel}` is the ONLY route parameter in this block. It is the FIFTH
// placeholder AdminAuthorizationTest::adminRoutes() must substitute — Task 62
// adds it to that list at AdminAuthorizationTest.php:49-53. Without that edit a
// literal "{channel}" reaches the router, 404s before the administrator gate can
// 403, and three tests in that file fail for the wrong reason.
//
// {channel} is INTENTIONALLY unconstrained, for the same reason {type} is at
// :210-216: a ->whereIn() constraint makes the literal URI 404 first. The
// controller resolves App\Enums\Channel and aborts 404 on a value outside
// Channel::connectable().
Route::get('/channels', [ChannelConnectionController::class, 'index']);
Route::put('/channels/{channel}', [ChannelConnectionController::class, 'save']);
Route::post('/channels/{channel}/test', [ChannelConnectionController::class, 'test']);
Route::delete('/channels/{channel}', [ChannelConnectionController::class, 'destroy']);
```

**(b) A new public webhook group**, after the CSAT block (`:363`), with a docblock explaining that
the signature *is* the authentication, that it is deliberately not under `api/portal/` (the gate
at `ApiContractTest.php:344-366` cannot be satisfied by a webhook), and that the limiter is
deliberately generous per Decision 4:

```php
Route::prefix('webhooks/channels')->middleware('throttle:channel-webhook')->group(function () {
    Route::get('/{provider}', [ChannelWebhookController::class, 'verify'])->name('channels.webhook.verify');
    Route::post('/{provider}', [ChannelWebhookController::class, 'receive'])->name('channels.webhook.receive');
});
```

**(c) Two widget groups** — a public bootstrap and a session-gated body, mirroring how the portal
splits at `:315-345`:

```php
Route::prefix('widget')->group(function () {
    Route::post('/chat/sessions', [ChatWidgetController::class, 'start'])
        ->middleware('throttle:widget-start')->name('widget.chat.start');
});

Route::prefix('widget')->middleware(['chat-widget', 'throttle:widget'])->group(function () {
    Route::get('/chat/messages', [ChatWidgetController::class, 'messages'])->name('widget.chat.messages');
    Route::post('/chat/messages', [ChatWidgetController::class, 'send'])->name('widget.chat.send');
    Route::post('/chat/identify', [ChatWidgetController::class, 'identify'])->name('widget.chat.identify');
});
```

### 42 — `Create file: api/app/Http/Middleware/ChatWidgetAuth.php` and `api/app/Http/ChatWidgetRequest.php`

`ChatWidgetAuth` is `PortalAuth.php:20-51` with `ChatSession` substituted: resolve the bearer,
`ChatSession::hashToken()`, `isLive()`, `saveQuietly` the `last_used_at` bump,
`$request->attributes->set('chat_session', $session)`, and **one identical `401`** for missing,
unknown, revoked and expired. It **must not** call `Auth::login()` and **must not** bind a
customer as `$request->user()`.

`ChatWidgetRequest::session(Request): ChatSession` mirrors
`api/app/Http/PortalRequest.php:15-33` — `abort_unless($s instanceof ChatSession, 401)`.

### 43 — `Create file: api/app/Http/Controllers/Widget/ChatWidgetController.php`

- `start()` — validate `site_key` and check `Origin` against
  `$connection->config['allowed_origins']` (the **`Origin` header**, never `document.referrer`).
  Mismatch → `403`. Creates a `chat_sessions` row with a 32-byte random token, returns
  `{token, expires_at, poll_seconds}` and **no ticket**.
- `messages()` — public messages for the session's ticket newer than `?after=<id>`, through
  `TicketMessage::publicOnly()` **in the query** (`.squad/plans/00-index.md:150-153` — *"Any
  customer-facing render of a ticket thread goes through `TicketMessage::publicOnly()` in the
  query"*). No ticket yet → `{messages: [], state: 'awaiting_identity'}`.
- `identify()` — validate `name` + `email`, resolve/create the `Customer` through
  `InboundCustomerResolver`, open the ticket through `IngestedTicketFactory` with
  `Channel::Chat`, attach it to the session, and replay the held messages into the thread.
- `send()` — cap on `config('channels.chat.max_messages_per_session')` and
  `max_message_chars`; before identity, hold the body on the session; after identity, append to
  the ticket through the same path `MessageIngestor` uses, with a synthetic
  `provider_message_id` of `chat:{session}:{n}` so the same idempotency ledger covers chat.

Every response is `200` with a `state` field (`awaiting_identity` | `open` | `ended`), following
WIS-23's Decision 10 (`ApiContractTest.php:382-405`) — a `503` in an iframe is a dead end.

### 44 — `Create file: api/app/Console/Commands/IngestChannelFixtureCommand.php`

`channels:ingest-fixture {provider} {--file=}`, modelled on `AiSmokeCommand.php`. Loads the
payload, **signs it with the stored secret** so `verify()` genuinely runs, calls the adapter and
the ingestor directly, and prints the provider message id, the outcome
(`created`/`appended`/`duplicate`) and the ticket id. Ships with the three fixtures from Task 51 as
defaults, so `php artisan channels:ingest-fixture whatsapp_cloud` works with no arguments.

### 45 — `Create file: api/app/Console/Commands/TestChannelSendCommand.php`

`channels:test-send {channel} {ticket} {--body=}`. Enqueues one reply and immediately calls
`ChannelOutboxDispatcher::attempt()`, printing status / `last_status` / `last_error_key`. **This
is the discharge path for Done Criteria 1 and 2.** Warn and exit 0 (never fail) when the channel
is not connected or `channels.enabled` is false, matching `MailTestCommand`'s behaviour with
`MAIL_MAILER=log`.

### 46 — `Create file: api/app/Console/Commands/FlushChannelOutboundCommand.php`

`channels:flush-outbound {--limit=}`. Copies `FlushOutboxCommand.php`: take
`ChannelOutboundMessage::due()->limit(config('channels.outbound.batch_size'))`, attempt each,
print a per-status tally. Never throws out of the loop.

### 47 — `Edit file: api/routes/console.php`

Append beside the four existing schedules, with a comment stating the same constraint the file
already states at `:16-18`:

```php
// WIS-22: the channel delivery drain. Same constraints as sync:flush-outbox — no
// queue worker exists to hand work to, so the inline attempt ChannelOutbox
// registers is best-effort and capped, and THIS is the delivery guarantee. Five
// minutes matches the shortest configured backoff (60s).
Schedule::command('channels:flush-outbound')
    ->everyFiveMinutes()
    ->withoutOverlapping(10)
    ->runInBackground();
```

### 48 — `Edit file: api/app/Providers/AppServiceProvider.php`

In `register()`, four binds, all lazy closures (nothing may read config or open a connection while
the container boots — the rule stated at `:39-45`):

```php
$this->app->bind(InboundWebhookAdapter::class, fn () => throw new LogicException(
    'Resolve an adapter through ChannelAdapters::for(), never from the container directly.'
));
```

— **no.** Do not bind the interface at all; `ChannelAdapters` and `ChannelSenders` are the only
resolution paths and both are plain `match` registries resolved from the container per concrete
class. Bind nothing for the interfaces, and add nothing to `boot()`: **this story registers no
model observer** (Decision 8). Leave `AppServiceProvider::boot()`'s three `Ticket::observe(...)`
calls at `:123-133` untouched.

### 49 — `Edit file: api/bootstrap/app.php`

**(a)** Three named limiters in the `then:` closure, after `portal-chat` (`:73-78`):

```php
// Story 26 (WIS-22), Decision 4. DELIBERATELY generous and keyed on
// provider|ip: a 429 during a provider's burst redelivery turns one slow
// request into an escalating retry storm, and some providers disable a webhook
// after sustained failures. Unsigned requests are rejected before any query
// runs, so this limiter only has to bound an attacker with no valid signature.
RateLimiter::for('channel-webhook', fn (Request $request) => Limit::perMinute(120)
    ->by('channel-webhook:'.$request->route('provider').'|'.$request->ip()));

// The public widget bootstrap — the only unauthenticated widget route.
RateLimiter::for('widget-start', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

// The session-gated widget, keyed on the bearer like `portal` (:56-57).
RateLimiter::for('widget', fn (Request $request) => Limit::perMinute(30)
    ->by('widget:'.($request->bearerToken() ?? $request->ip())));
```

**(b)** One alias beside the three at `:91-97`: `'chat-widget' => ChatWidgetAuth::class`, with a
comment that it is neither `auth:sanctum` nor `portal` — a fourth audience.

**Do not touch `SecurityHeaders`, the CSP string, or the exception renderers.**
`ApiContractTest.php:43-50` contracts the CSP and Decision 10 is built so no exception is needed.

### 50 — `Edit file: api/app/Services/AuditTrail.php`

Add one constant beside `INTEGRATION_SYNC_CONFIG_CHANGED` (`:72`) and one label in `events()` /
`label()`:

```php
/** Story 26 (WIS-22). Channel connection created, updated, tested or removed. */
public const CHANNEL_CONNECTION_CHANGED = 'channel_connection.changed';
```

One constant, not four: the audit row's `context` carries the verb, and `AuditLogTest.php:144`
walks the event list.

### 51 — `Create files: api/tests/fixtures/channels/{whatsapp-cloud-text.json,twilio-sms-form.json,email-inbound.json}`

Real-shaped provider payloads, one per adapter, with **no credentials in them**. These are the
input to §B/§C/§D and the default arguments of `channels:ingest-fixture`. `grep` them for `Bearer`,
`token`, `secret` before committing.

### 52 — `Edit file: api/lang/{en,ar}/enums.php`

Nothing to change — `channel` labels already exist at `en:31-37`. **Do not add a sixth entry.**
Listed as a task so the executor confirms rather than assumes.

### 53 — `Create file: api/lang/{en,ar}/channels.php`

Server-side strings that are genuinely server-side: `webhook_rejected` (the one webhook 401 body),
`inbound.default_subject`, `inbound.attachment_placeholder`, and the `ChannelReplyMail` subject
line. **Connection and delivery *errors* are NOT here** — they are i18n keys resolved in the SPA,
following this feature's own convention (`ChannelOverviewResource`'s `label_key`, and WIS-24
Decision 11). Both files must have identical key sets.

### 54 — `Edit file: api/.env.example`

A new commented block at the tail, after the WIS-24 block, following that block's style exactly:

```
# --- Live channel ingestion (WIS-22) ---------------------------------------
# The engine is on by default; a channel with no channel_connections row still
# moves nothing. Set to false to hard-stop all ingestion and delivery.
# CHANNELS_ENABLED=true
# CHANNEL_WEBHOOK_MAX_BYTES=524288
# CHANNEL_MESSAGE_MAX_CHARS=5000
# CHANNEL_INBOUND_MAX_PER_REQUEST=10
# CHANNEL_THREAD_WINDOW_HOURS=72
# CHANNEL_OUTBOUND_MAX_ATTEMPTS=5
# CHANNEL_OUTBOUND_INLINE_MAX=3
# CHANNEL_OUTBOUND_BATCH=100
# CHANNEL_OUTBOUND_TIMEOUT=10
# CHANNEL_CHAT_POLL_SECONDS=5
# CHANNEL_CHAT_SESSION_TTL=240
#
# Provider base URLs. Overridden only to point at a sandbox; never at a private
# host — App\Services\Integrations\OutboundUrlGuard rejects those by design.
# WHATSAPP_CLOUD_BASE_URL=https://graph.facebook.com/v21.0
# TWILIO_BASE_URL=https://api.twilio.com/2010-04-01
#
# Credentials are NOT env vars. They are stored per channel, encrypted, in
# channel_connections.secret via Admin -> Channels. See section "Owner setup"
# in .squad/plans/live-channel-ingestion/26-story-live-channel-ingestion.md.
```

Note the deliberate asymmetry with WIS-26: AI keys are env vars because there is one provider per
deployment; channel credentials are per-row because there are four channels and the admin UI is a
Done Criterion.

### 55 — `Edit file: api/phpunit.xml`

One `<env>` beside `:32` and `:40`, with the same shape of comment:

```xml
<!--
    Story 26 (WIS-22): the outbound delivery enqueue fires from
    TicketMessageController@store — one of the busiest paths in the suite — and
    ingestion writes tickets. OFF by default so no existing thread test starts
    writing channel_outbound_messages; the channel test files opt back in with
    config(['channels.enabled' => true]).
-->
<env name="CHANNELS_ENABLED" value="false"/>
```

### 56 — `Edit file: api/tests/TestCase.php`

One line in `setUp()` beside the three at `:20-27`:

```php
// Story 26 (WIS-22). Same rationale — the inline-delivery cap is a process static.
ChannelOutbox::resetInlineCounter();
```

### 57 — `Edit file: api/tests/Pest.php`

Two binders, after `bindOutboundUrlGuard()` (`:46-59`), each with the docblock convention that
file uses. Note `:76-84`'s warning: **bind once per test, not per HTTP call** — the Route object
caches the resolved controller, so a second `app()->instance()` mid-test silently has no effect.

```php
/**
 * Story 26 (WIS-22). One fake ChannelSender for every provider, recording each
 * (connection, message) pair in $sent and returning a queued OutboundResponse
 * (falling back to success). Drive different behaviour across calls on this ONE
 * instance via respondWith(), never by rebinding — see bindAssistGenerator's
 * docblock at :76-84.
 */
function bindChannelSender(): object;

/**
 * Story 26 (WIS-22). Creates a connected ChannelConnection with a known
 * plaintext secret and returns [$connection, $secret], so a test can compute a
 * real HMAC and drive the REAL verification path. Signature tests use this;
 * they never stub verify().
 */
function connectChannel(Channel $channel, ChannelProvider $provider, array $config = []): array;
```

### 58 — `Create files: api/database/factories/{ChannelConnectionFactory,ChannelInboundMessageFactory,ChannelOutboundMessageFactory,ChatSessionFactory}.php`

`ChannelConnectionFactory` needs states `whatsapp()`, `sms()`, `email()`, `chat()` and `errored()`.
**The URLs any state produces must resolve** — WIS-24's execute run discovered that
`api.example.com` is NXDOMAIN and only the bare `example.com` resolves; the guard's real
implementation calls `gethostbyname()`. Tests that keep the real guard use `https://example.com/...`;
everything else binds `bindOutboundUrlGuard()`.

### 59 — `Edit file: api/database/seeders/DatabaseSeeder.php` — **no change**

Stated explicitly: there is **no** seeded `channel_connections` row, by design, so
`migrate:fresh --seed` performs zero outbound requests and writes zero ledger rows.
`TicketScenarioSeeder`'s existing whatsapp/sms/chat *ticket* rows stay exactly as WIS-25 authored
them (`TicketScenarioSeeder.php:145,246-283,444-460`) — they are historical data, not evidence of
a connection. **Do not edit `TicketScenarioSeeder.php` or any file under
`api/database/seeders/data/`.** Verification Step 7 checks this by row count, not by reasoning.

### 60 — `Edit file: api/tests/Feature/Channels/ChannelOverviewAuthTest.php`

Decision 12's rewrite. Rewrite exactly two tests; leave `:10-12` (the 401 test) alone.

- `:14-25` becomes two tests: (a) with no `channel_connections` rows, every one of the five
  channels is `not_connected` and `connection` is `null` — the honest default is still the
  default; (b) with one connected `whatsapp` row, that channel is `connected` with a non-null
  `connection.last_inbound_at`/`inbound_24h` and the other four are unchanged.
- `:27-37` becomes: for every route whose URI contains `channels`, either it is under
  `api/webhooks/` (signature-authenticated, no session), or it carries `auth:sanctum` (the
  overview), or it carries `administrator` (the four config routes); no route with a write verb
  lacks `administrator`; and `GET /api/channels/overview` is still the only `GET` under
  `api/channels/`. Keep the test's name and its intent — *no unguarded channel configuration* —
  and say in a comment that the count assertion was replaced by a gate assertion because the
  count now grows legitimately.

### 61 — `Edit file: api/tests/Feature/ApiContractTest.php`

**Extend, do not restructure.** WIS-24's plan-review recorded that a `pint` auto-fix turned ~90 of
that file's diff lines into an FQCN→import normalisation where the plan said "extend"; run `pint`
on the file **before** editing it if it is dirty, so the reformat is not attributed to this story.

Add three shape locks, each in the style of `:382-405`:

1. `GET /api/channels/overview` — `data[].{value,label_key,status,ticket_count,connection}` and
   `meta.*`, with `connection` null when no row exists.
2. `POST /api/widget/chat/sessions` — exactly `{token, expires_at, poll_seconds, state}` via
   `toEqualCanonicalizing(array_keys(...))`.
3. `GET /api/admin/channels` — `data[].{channel,label_key,provider,status,secret_last_four,...}`
   plus **`assertJsonMissingPath('data.0.secret')`** and
   **`assertJsonMissingPath('data.0.verify_token')`**, mirroring `:235`.

Plus one route-gate test beside `:344-366`: every route under `api/webhooks/` carries
`throttle:channel-webhook` and carries **neither** `auth:sanctum` **nor** `portal` — the
structural statement that the signature is the only authentication.

### 62 — `Edit file: api/tests/Feature/Admin/AdminAuthorizationTest.php`

Two edits, and the first is the one that fails three tests if it is forgotten.

1. `:49-53` — add `{channel}` as the **fifth** placeholder, substituting `'whatsapp'`:

```php
$uri = str_replace(
    ['{user}', '{type}', '{branch}', '{department}', '{channel}'],
    [(string) $targetId, 'erp', (string) $branchId, (string) $departmentId, 'whatsapp'],
    $route->uri()
);
```

2. `:61-96` — append the four contracted endpoints:
   `GET /api/admin/channels`, `PUT /api/admin/channels/whatsapp`,
   `POST /api/admin/channels/whatsapp/test`, `DELETE /api/admin/channels/whatsapp`.

No `beforeEach` change is needed — `'whatsapp'` is a valid `Channel::connectable()` value, so the
controller resolves it without a database row and the `administrator` gate 403s before any lookup.

---

## Frontend Tasks

### 63 — `Edit file: web/src/features/channels/model/channel.ts`

- `:11` — `export type ChannelStatus = 'not_connected' | 'connected' | 'error';`
- `:13-18` — `ChannelOverviewItem` gains `connection: ChannelConnectionSummary | null`.
- New types: `ChannelConnectionSummary` (`provider`, `last_inbound_at`, `inbound_24h`,
  `last_error_key`, `connectable`), `ChannelProviderValue`, `ChannelConnection` (mirroring
  `ChannelConnectionResource` **exactly**, with **no `secret` field** — the
  `web/src/features/integrations/model/types.ts:5-7` convention).
- `:55-66` — `STATUS_LABEL_KEYS` gains `connected` and `error`. **Replace** the *"deliberately NO
  `connected` entry … so a future bug cannot render a fabricated healthy state"* comment with why
  it is now safe: the value comes from a `channel_connections` row, and the absent row still
  yields `not_connected` — the default is unchanged, only the ceiling is raised.
- `presentationFor()` and `CHANNEL_PRESENTATION_KEYS` (`:79-112`) stay as they are; only the
  help-line **copy** changes, in the catalogue (Task 68).

### 64 — `Edit files: web/src/features/channels/api/{channelsApi.ts,queryKeys.ts}`

Four functions through the shared `api` instance (`fetchChannelConnections`,
`saveChannelConnection`, `testChannelConnection`, `disconnectChannel`) and two keys added to
`channelKeys` (`:1-6`): `connections: () => ['channels','connections']` and
`connection: (c) => ['channels','connections',c]`. Every mutation invalidates `channelKeys.all`,
so the overview's status pill and the connect panel can never disagree.

### 65 — `Create files: web/src/features/channels/hooks/{useChannelConnections,useSaveChannelConnection,useTestChannelConnection,useDisconnectChannel}.ts`

`useQuery` / `useMutation` in the shape of `useChannelOverview.ts` and
`web/src/features/integrations/hooks/useSaveIntegration.ts`.

### 66 — `Create files: web/src/features/channels/components/{ChannelConnectPanel,ChannelConnectModal,ChannelSecretField}.tsx`

Administrator-only. `ChannelConnectModal` is a focus-trapped dialog per
`web/src/features/integrations/components/IntegrationModal.tsx`; `ChannelSecretField` is
`components/SecretField.tsx`'s behaviour — the stored secret is shown only as `•••• 1234` from
`secret_last_four`, an empty field means "keep", and the plaintext is never read back. Provider
options come from the **API response**, never a local array (the `types.ts:8-11` convention). All
four async states, and a per-channel "Test" button surfacing `last_error_key` through `t()`.

### 67 — `Edit files: web/src/features/channels/components/ChannelCard.tsx` and `pages/ChannelsPage.tsx`

- `ChannelCard` — the badge renders `statusLabel(item.status, t)` for all three states with a
  distinct dot class per state (**never colour alone** — `docs/design/brief.md`'s rule, as
  `StatusPill.tsx` implements it), plus, when `connection` is non-null, a line reading
  "Last message <relative time> · <n> in 24h" from the catalogue, and, when `status === 'error'`,
  `t(connection.last_error_key)`.
- `ChannelsPage` — replace the admin release notice (`:235-242`) with `ChannelConnectPanel`.
  Non-admins keep exactly no configuration affordance. The pending-state fallback at `:209-216`
  keeps `status: 'not_connected'` and adds `connection: null`, so a failed request still cannot
  render a fabricated healthy state.

### 68 — `Edit files: web/src/i18n/locales/{en,ar}/channels.json`

New keys: `status.connected`, `status.error`, `card.lastInbound`, `card.inbound24h`,
`connect.*` (title, provider, secret, verifyToken, phoneNumberId, fromNumber, accountSid,
inboundAddress, allowedOrigins, siteKey, save, test, disconnect, testing, testOk, testFailed,
confirmDisconnect), `error.*` (one key per `channels.error.*` the API can return, plus the four
inherited `integrations.error.*` the guard produces), and `webhookUrl` (the copyable URL an
Administrator must paste into the provider dashboard).

**Rewrite the five stale strings**: `page.noticeStrong`/`page.noticeRest` (currently *"Channel
integrations are not available in this release."*), `page.subtitleAdmin` (currently *"— no
integrations connected"*), and the `presentation.*.helpLine` lines that read *"once an inbox is
configured"* / *"Requires a WhatsApp Business API account."* — the last is still true as *owner
setup*, so say that, not that the feature is absent.

Both files must end with identical key sets — `web/src/i18n/catalogueParity.test.ts` asserts it.

### 69 — `Create files: web/src/features/chat-widget/**`

`api/widgetClient.ts` (Decision 10's documented second axios instance: `baseURL: '/api'`,
the `Accept-Language` interceptor re-registered, and a docblock naming
`web/src/lib/api.ts:42-47` and saying why the shared instance cannot be used — its base is
absolute and the widget needs the same-origin proxy), `model/widget.ts`,
`hooks/useWidgetChat.ts` (the `config('channels.chat.poll_seconds')` poll, `after` cursor,
`stopPolling` on `state === 'ended'`), `components/{WidgetComposer,WidgetTranscript,WidgetIdentifyForm}.tsx`,
and `pages/WidgetChatPage.tsx`.

`WidgetChatPage` is the **iframe document**: no `AppLayout`, no `AuthContext`, no nav. It reads
`?key=` from the URL, calls `POST /api/widget/chat/sessions`, and holds the token in a
module-scoped variable, **never** `localStorage` — the same decision
`web/src/lib/api.ts:3-6` records for the staff token, and here it additionally keeps a shared
device from leaking one visitor's chat to the next. It posts only a
`{type: 'wisal-widget:height', value: n}` message to the parent and reads nothing from it.
All four async states, RTL-correct, and every string from the catalogue.

### 70 — `Edit file: web/src/App.tsx`

One route beside the other unauthenticated ones (`:56-83`), **outside** `RequireAuth` and outside
the `/portal` layout:

```tsx
{/* Story 26 (WIS-22), Decision 10. The chat-widget iframe document. Deliberately
    outside RequireAuth AND outside the portal layout — a fourth audience, an
    anonymous visitor on a third-party page. Framable because web/vercel.json sets
    no headers; same-origin to /api because it proxies. */}
<Route path="/widget/chat" element={<WidgetChatPage />} />
```

### 71 — `Create file: web/public/widget.js`

Plain, dependency-free, ES5-safe JS. Not `.tsx`, so `check-no-literals.mjs` does not apply — say
so in a header comment so nobody moves it into `src/`. It reads its own
`document.currentScript.dataset` (`siteKey`, `origin`, optional `title`), injects a launcher button
and an iframe at `<origin>/widget/chat?key=<siteKey>`, listens for the height message on the
`wisal-widget:` channel with an origin check, and exposes `window.WisalChat = { open, close }`.
Under 120 lines. It never reads cookies and never sends anything to the parent page.

### 72 — `Create file: web/public/widget-demo.html`

**This file is how Done Criterion 3 is discharged.** A deliberately plain static page — no build
step, no framework, its own inline `<style>` — with one `<script src="/widget.js"
data-site-key="…" data-origin="…">` tag and a paragraph of prose saying what it is. Vercel serves
`web/public/*` before the `/(.*)` → `/index.html` rewrite in `web/vercel.json`, so
`/widget-demo.html` resolves in production and in `vite preview`.

### 73 — `Edit file: web/vite.config.ts`

Decision 10's second consequence. There is no `server.proxy` today (`:5-12`), so `/api` 404s in
dev and the widget cannot be demonstrated locally:

```ts
server: {
  // Story 26 (WIS-22), Decision 10. The chat widget iframe calls /api
  // SAME-ORIGIN so no CORS change is needed in production (web/vercel.json
  // proxies /api/(.*)). Dev needs the same shape or the widget 404s locally.
  // The staff SPA is unaffected — it uses the absolute VITE_API_URL.
  proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
},
```

### 74 — `Edit file: web/scripts/i18n-allowlist.json`

Add `"src/features/chat-widget"` to the `roots` array (`:3-22`). A new feature folder is **not**
enforced automatically, and `:23` says the list was closed by WIS-17 — this reopens it
deliberately, so note the story in the `_rootsNote` or in the entry's ordering.

### 75 — `Edit file: web/src/features/channels/index.ts`

Export `ChannelsPage` (unchanged) and, from the new feature, `WidgetChatPage` via
`web/src/features/chat-widget/index.ts` — one public surface per feature, as the existing
one-line comment states.

### 76 — `Edit file: web/src/index.css`

Style classes for the three status pills, the connect panel, the connect modal, and the widget
(launcher, transcript, composer, identify form). WIS-23's plan-review recorded that its commit
added **no CSS** and shipped two unstyled class families; do not repeat that. Dark theme and RTL
per `docs/design/brief.md`.

### 77 — `Edit file: README.md`

Five stale claims, at verified line numbers:

- `:220` — the Category 3 row: `⚠️ Partial` → `✅ Done` for ingestion, naming
  `api/app/Services/Channels`, the webhook route and the widget, and stating plainly that the two
  live-delivery criteria await provider credentials.
- `:231` — the Category 11 row's tail, *"inbound email, WhatsApp and SMS send-and-receive are
  still not wired"* → wired, pending credentials.
- `:246` — the assumptions row *"Whether 'multi-channel' means live inboxes | No."* — rewrite to
  the answer that is now true: yes, via signed provider webhooks, with the per-provider account
  setup named as the remaining owner step.
- `:455` — the endpoint table: `/channels/overview` moves out of **Reports** into a new
  **Channels** row alongside `/admin/channels*`, `/webhooks/channels/{provider}` and
  `/widget/chat*`.
- `:817-818` — Known gaps, *"Channels are read-only."* → replace with the honest residual: the
  engine is live and the two "a real message arrives / arrives back" criteria need provider
  accounts. Also add the two deliberate deferrals (no attachments, no WhatsApp templates) here
  rather than leaving them silent.

Additionally add a short **"Connect a channel"** subsection under the Run-it section, in the shape
WIS-26/27 used for `ai:smoke` / `mail:test`, giving the three artisan commands and the webhook URL
the owner pastes into each provider dashboard.

---

## Edge Cases & Failure Modes

1. **Unsigned or wrongly-signed webhook.** → `401`, body is the single
   `channels.webhook_rejected` string, nothing else. Enforced in
   `ChannelWebhookController::receive()` step 4. Never says which of secret/payload/channel was
   wrong.
2. **Webhook for a channel with no connection row, or a row in `error`.** → the **same** `401` as
   a bad signature (step 3), so the endpoint does not disclose which channels are live.
3. **Body larger than `channels.inbound.max_body_bytes`.** → `413` **before** the HMAC is
   computed (step 2). Hashing an unbounded body is the cheap DoS, and this is the one 4xx that
   precedes verification.
4. **Verified but unparseable envelope.** `parse()` returns `[]`; the controller answers
   `202 {"received": 0}`. A `4xx` here would make the provider retry a payload we will never
   understand — Decision 4.
5. **Verified, parseable, but ingestion throws.** Caught per message in the loop, logged as
   `$e::class`, counted as failed, still `202`. One bad message in a multi-message WhatsApp
   envelope never discards its siblings.
6. **Exact webhook redelivery.** The duplicate check is `MessageIngestor::ingest()` **step 2,
   before any write**: no ledger write, no `last_inbound_at` bump, no `tickets.updated_at` change.
   §D asserts `updated_at` is byte-identical, which is only true because the check precedes
   everything.
7. **Two identical webhooks racing.** Both pass step 2; the loser's ledger insert violates
   `unique(channel_connection_id, provider_message_id)`. The insert is in its own nested
   `DB::transaction()` (a Postgres SAVEPOINT), the `QueryException` is caught, the outer work rolls
   back, and the response is still `202`. Without the SAVEPOINT the aborted transaction takes the
   next statement with it — the exact failure WIS-24 hit and recorded.
8. **WhatsApp `statuses[]` delivery receipt.** `WhatsappCloudAdapter::parse()` skips it entirely
   and returns `[]` → `202 {"received": 0}`. A receipt is not a message and must not open a
   ticket. This is the single highest-volume payload Meta sends.
9. **`GET` on a provider with no handshake.** `challenge()` returns `null` → `405`. Only
   `whatsapp_cloud` answers `GET`.
10. **WhatsApp handshake with a wrong `hub.verify_token`.** `403`, and the challenge is **not**
    echoed. Echoing unconditionally hands an attacker the subscription — the reason `hash_equals`
    against the stored token is a hard requirement in `WhatsappCloudAdapter::challenge()`.
11. **Forged `In-Reply-To` pointing at another customer's ticket.** `ThreadMatcher::match()`'s
    final `customer_id` check discards the candidate and a **new** ticket is opened instead. §E
    asserts this with two customers and a stolen reference.
12. **Guessed `[#412]` subject token.** Same guard, same outcome. The subject-token space is
    trivially enumerable, which is exactly why identity is checked after matching and not before.
13. **Unrecognised sender with thread headers.** `ThreadMatcher` returns `null` immediately when
    `$customer === null` — a brand-new customer never joins an existing thread, whatever the
    headers claim.
14. **Reply arriving after `thread_window_hours`.** `byRecentChannelTicket()` finds nothing and a
    new ticket opens. Deliberate: a reply three weeks later is a new issue.
15. **Reply to a `Closed` ticket.** `whereNot('status', Closed)` excludes it; a new ticket opens.
    A reply to a `Resolved` ticket **reopens** it and writes a `reopened` event, mirroring
    `PortalRequestController.php:184-187`.
16. **Inbound with an attachment.** `hadAttachment = true`; the body gets
    `channels.inbound.attachment_placeholder` appended and the media is **dropped**. There is no
    `ticket_message_attachments` table (Out of scope). The placeholder is visible to the agent, so
    the loss is stated, not silent.
17. **Agent posts an internal note on an email ticket.** `ChannelOutbox::enqueue()`'s
    `visibility === Public` guard returns early. **An internal note must never leave the
    building** — §H asserts zero rows and `Http::assertNothingSent()`.
18. **Channel credential rejected (401/403) mid-delivery.** The dispatcher writes
    `status = Error` + `last_error_key` on the **connection** (Done Criterion 4's error state) and
    dead-letters that message. Subsequent enqueues are refused by the connected-status guard, so
    replies queue up rather than burning attempts. When a message is attempted while the
    connection is not `Connected`, the dispatcher returns **`Pending`** with the next backoff, not
    `Dead` — an admin fixing the credential must not have lost the reply. This is the one place
    this story deliberately diverges from `OutboxDispatcher`.
19. **Transport failure / DNS blip on send.** `ChannelHttpClient`'s catch →
    `transportFailure()` (retryable). A guard `integrations.error.unreachable` verdict is **also**
    retryable, per the carve-out at `OutboxDispatcher.php:59-66`; `scheme` and `blocked_host`
    dead-letter on attempt 1. Losing this distinction was a real defect in WIS-24, found at
    plan-review.
20. **`max_attempts` exhausted.** `status = Dead`, `failed_at`, `last_error_key =
    channels.error.max_attempts`. The row is kept: it is the dead-letter record and the agent-visible
    "this reply was not delivered" source.
21. **`APP_KEY` rotated after a secret was stored.** Reading `$connection->secret` throws
    `DecryptException`. In `verify()` it is caught and returns `false` (→ `401`); in a sender it is
    caught by `ChannelHttpClient`'s `Throwable` catch → `transportFailure()`. Never a 500, never a
    logged message. Same posture as `OutboundHttpClient.php:44-55`.
22. **100-ticket bulk operation generating a burst of replies.** `POST /api/tickets/bulk` resolves
    up to 100 tickets (`BulkTicketActionRequest.php:19`) but writes no messages, so it enqueues
    nothing. A burst of individual replies is bounded by
    `channels.outbound.inline_max_per_request` (3) on the **inline attempt only**; the enqueue is
    never capped, or replies would vanish. The drain picks up the rest within five minutes.
23. **`migrate:fresh --seed`.** Zero `channel_connections` rows exist (Task 59), and
    `ChannelOutbox` additionally returns early on `runningInConsole() && ! runningUnitTests()`.
    Zero outbound requests, zero ledger rows, zero outbox rows. Verified by count, not by
    reasoning.
24. **Widget `start` from a disallowed origin.** `403`. The **`Origin` header** is compared, never
    `document.referrer` — a referrer is trivially forged and often absent.
25. **Widget messages before identification.** Held on the session; `messages()` returns
    `{messages: [], state: 'awaiting_identity'}` and no ticket exists. `identify()` opens the
    ticket and replays them in order, so nothing the visitor typed is lost.
26. **Widget session expiry mid-conversation.** `ChatWidgetAuth` returns the one `401`; the widget
    renders an ended state with a "start a new chat" affordance and stops polling. It does not
    silently start a second session.
27. **Widget message cap reached.** `422` with `channels.error.chat_limit`, and the transcript
    stays readable. The cap exists so an abandoned iframe cannot grow a thread without bound.
28. **A sixth `Channel` enum case added later.** `connectable()` and `deliverable()` are derived by
    **exclusion**, so a new case is **not** silently connectable; `ChannelOverviewController` still
    iterates `cases()` and the card falls back to `presentationFor()`'s generic help line
    (`channel.ts:99-112`). The only thing that breaks is the count in
    `ChannelOverviewAuthTest`, which is Story 14's contract and should break loudly.
29. **`web_form`.** Never connectable, never deliverable, `PUT /api/admin/channels/web_form` is
    `404`. It is the portal form (`PortalRequestController.php:111`), not a provider.
30. **Provider redelivering in a burst.** `throttle:channel-webhook` is 120/min keyed on
    `provider|ip` (Decision 4) — deliberately generous, because a 429 escalates a slow request
    into a retry storm and some providers disable a webhook after sustained failures.
31. **Twilio behind a host-rewriting proxy.** `verify()` signs `$request->fullUrl()`; if a proxy
    rewrites the host the signature never matches. **Not worked around** — recorded in Owner Setup
    as "register the webhook with the exact public URL, including scheme and any trailing slash".
32. **WhatsApp reply outside the 24-hour customer-service window.** Meta rejects free-form text;
    the response maps to `rejected()` and dead-letters with `channels.error.outside_window`. The
    agent sees a delivery failure with a reason. Templates are out of scope, and this is the
    honest consequence.
33. **`config` blob used to store a credential.** `SaveChannelConnectionRequest` has **no
    wildcard** — `validated()` drops any unlisted key — and `ChannelConnectionResource` echoes only
    an allowlist. Two independent gates, matching WIS-19's "two things must both fail" posture.
34. **Half-applied migration.** The four migrations are independent `create`s with no
    `Schema::table` on another story's table, so a failure between them leaves earlier tables
    present and unused; the feature flag defaults let the app run regardless. Rollback is
    `--step=4`, dropping them in reverse.

---

## Test Plan

Sixteen sections. Every file drives fakes at the seam: `Http::fake()` or `bindChannelSender()`
for sends, `bindOutboundUrlGuard()` wherever the real guard would need live DNS, and
`config(['channels.enabled' => true])` in a `beforeEach` because `api/phpunit.xml` turns the
feature off for the suite. **Signature tests are the exception: they compute a real HMAC via
`connectChannel()` and drive the real `verify()`.** Never stub `verify()`.

### A — `api/tests/Unit/Channels/SignatureVerificationTest.php` (new)

1. `whatsapp_cloud` accepts a correctly-computed `X-Hub-Signature-256` over the raw body.
2. …rejects a valid digest computed over a **re-encoded** body (key order changed), proving the
   raw-body rule is real and not decoration.
3. …rejects a missing header, an empty header, and a `sha1=` prefix.
4. `twilio_sms` accepts a correctly-computed `X-Twilio-Signature` over URL + sorted params.
5. …rejects the same signature when the URL differs by one character.
6. `email_webhook` accepts `X-Wisal-Signature` in the exact shape `OutboundHttpClient.php:91`
   sends, and rejects a one-byte-different digest.
7. Every adapter returns `false`, and does not throw, when `secret` is null.
8. A `DecryptException` while reading `secret` yields `false`, not a 500 (Edge Case 21).

### B — `api/tests/Feature/Channels/WhatsappIngestionTest.php` (new)

9. The `whatsapp-cloud-text.json` fixture, correctly signed, creates a ticket with
   `channel = whatsapp`, `status = open`, `priority = normal`, `created_by = null`, an SLA due
   date stamped, and one `AUTHOR_CUSTOMER` `public` message.
10. A `statuses[]`-only envelope returns `202 {"received": 0}` and creates nothing (Edge Case 8).
11. A `GET` handshake with the right `hub.verify_token` returns `200` with the challenge as
    `text/plain`; with a wrong token returns `403` and does **not** echo it (Edge Case 10).
12. A second message from the same number inside the window **appends** to the existing ticket and
    does not create a second one.
13. A multi-message envelope ingests all of them; one that throws does not discard its siblings
    (Edge Case 5).
14. An unknown sender creates a `Customer` with the normalised phone, and `phone_normalized` is
    derived (proving the write went through the model, not a query-builder `upsert`).

### C — `api/tests/Feature/Channels/SmsIngestionTest.php` (new)

15. A signed Twilio form post creates a ticket with `channel = sms`.
16. A reply from the same number to a `Resolved` ticket **reopens** it and writes a `reopened`
    `ticket_events` row (Edge Case 15).
17. A reply after `thread_window_hours` opens a **new** ticket (Edge Case 14).
18. `GET` on the SMS webhook is `405` (Edge Case 9).

### D — `api/tests/Feature/Channels/EmailIngestionAndIdempotencyTest.php` (new)

19. A signed inbound-email fixture creates a ticket; the subject becomes `tickets.subject`,
    truncated at 255.
20. **The idempotency test.** Post the identical payload twice: two `202`s, **one**
    `channel_inbound_messages` row, **one** ticket, **one** `ticket_messages` row, and
    `tickets.updated_at` **and** `channel_connections.last_inbound_at` byte-identical before and
    after the second call (Decision 5 / Edge Case 6). This is Done Criterion 5.
21. Quoted-reply stripping: a body containing `On … wrote:` and `>` lines stores only the new
    text.
22. A body over `max_message_chars` is truncated, not rejected.
23. An HTML-only body falls back to `strip_tags`.
24. A payload with `attachments[]` sets the placeholder in the body and stores no attachment
    (Edge Case 16).

### E — `api/tests/Feature/Channels/ThreadMatchingTest.php` (new)

**Done Criterion 6's "thread matching" section.**

25. `In-Reply-To` pointing at a `channel_outbound_messages.provider_message_id` we emitted appends
    to that ticket.
26. `References` with several ids matches the **right-most** (most recent ancestor).
27. `In-Reply-To` pointing at a `channel_inbound_messages` id also matches.
28. `[#<id>]` in the subject matches when no headers are present.
29. **The security test.** Customer B sends a message whose `In-Reply-To` references customer A's
    ticket: a **new** ticket is opened for B, A's ticket gains **nothing**, and
    `A.updated_at` is unchanged (Edge Case 11).
30. Same with a guessed `[#<A's id>]` subject token (Edge Case 12).
31. An unrecognised sender with a valid-looking `In-Reply-To` opens a new ticket and a new customer
    (Edge Case 13).
32. Phone matching finds a customer stored as `+1…` when the provider sends `1…`, via
    `phoneMatchCandidates()`.

### F — `api/tests/Feature/Channels/WebhookSecurityTest.php` (new)

**Done Criterion 6's "error path" section.**

33. An unsigned `POST` → `401`, and the response body is exactly one `message` key.
34. A wrongly-signed `POST` → `401`, and **nothing** was written (`assertDatabaseCount` on all
    four new tables).
35. A `POST` for a channel with no connection row → the **same** `401` (Edge Case 2), proving
    non-disclosure.
36. A `POST` for a connection in `error` status → the same `401`.
37. A body over `max_body_bytes` → `413` (Edge Case 3).
38. An unknown `{provider}` → `404`.
39. A verified-but-garbage JSON body → `202 {"received": 0}`, not a 4xx (Decision 4 / Edge Case 4).
40. No webhook route carries `auth:sanctum` or `portal`, and every one carries
    `throttle:channel-webhook` (this duplicates §M's structural test at the feature level on
    purpose).

### G — `api/tests/Feature/Channels/OutboundReplyEnqueueTest.php` (new)

41. An agent public reply on a connected `email` ticket writes exactly one
    `channel_outbound_messages` row with `recipient` = the customer's email and `in_reply_to` = the
    inbound `Message-ID` it answers.
42. An **internal note** writes **zero** rows and `Http::assertNothingSent()` (Edge Case 17).
43. A reply on a `chat` ticket writes zero rows; on `web_form`, zero rows.
44. A reply on a channel with **no** connection writes zero rows.
45. With `channels.enabled = false`, zero rows — and, mirroring WIS-24's closure lesson, the
    payload closure is **never invoked** (assert with a closure that increments a counter).
46. The reply's own transaction rolling back takes the outbox row with it
    (`assertDatabaseCount(0)`), because the insert is inside it.
47. Enqueuing the same `ticket_message_id` twice yields one row, not a `QueryException`
    (Decision 8's unique index).
48. Beyond `inline_max_per_request`, rows are still **created** and merely not attempted inline
    (Edge Case 22) — the count is the assertion, because a capped *enqueue* would lose replies.

### H — `api/tests/Feature/Channels/OutboundDeliveryTest.php` (new)

**Done Criterion 6's retry/dead-letter coverage, and the shape WIS-24 §E established.**

49. `Http::fake()` returning `200`: `status = Delivered`, `delivered_at` set,
    `provider_message_id` captured from the provider response, and
    `channel_connections.last_outbound_at` bumped.
50. A `500`: `status = Pending`, `attempts = 1`, `next_attempt_at ≈ now + 60s` (the first backoff
    entry).
51. A sequence of five `500`s across five `attempt()` calls: `Dead` with
    `last_error_key = channels.error.max_attempts` on the fifth (Edge Case 20).
52. A `422`: `Dead` on **attempt 1** — a permanent rejection does not consume the ladder.
53. A `401`: `Dead`, **and** the connection flips to `status = Error` with a `last_error_key`
    (Edge Case 18) — this is where Done Criterion 4's error state comes from.
54. A guard verdict of `integrations.error.unreachable`: **retryable**, `Pending`.
55. A guard verdict of `integrations.error.blocked_host`: `Dead` on attempt 1. **Tests 54 and 55
    are a pair** — one without the other lets the fix over- or under-correct, which is exactly how
    WIS-24's defect was found.
56. Attempting a message whose connection is no longer `Connected` returns `Pending`, not `Dead`
    (Edge Case 18's second half).
57. `MailChannelSender` under `Mail::fake()`: the mailable carries the generated `Message-ID` and
    the `In-Reply-To`, and that `Message-ID` is what lands in
    `channel_outbound_messages.provider_message_id` — the join §E test 25 depends on.
58. A throwing transport (`bindThrowingMailer()`, `api/tests/Pest.php:130-147`) yields
    `transportFailure()` and `Pending`, and no exception escapes.

### I — `api/tests/Feature/Channels/ChannelWebhookSsrfTest.php` (new) — **binds no guard fake**

Keeps the **real** `DnsOutboundUrlGuard`, mirroring `api/tests/Feature/Sync/SyncSsrfTest.php`.

59. A provider base URL of `http://…` is `blocked` with `integrations.error.scheme` and no request
    is sent.
60. `https://localhost/…` and `https://169.254.169.254/…` are `blocked` with
    `integrations.error.blocked_host`.
61. A happy path against `https://example.com/…` (the host WIS-24's execute run confirmed actually
    resolves) reaches `Http::fake()`.
62. `ChannelHttpClient` calls `validate()` on **every** call, not once per instance — assert with
    a spying guard over two sends.

### J — `api/tests/Feature/Channels/ChatWidgetTest.php` (new)

**Done Criterion 3's backend half.**

63. `POST /api/widget/chat/sessions` with a valid site key and an allowed `Origin` returns a token
    and creates a session with **no** ticket.
64. A disallowed `Origin` → `403` (Edge Case 24). A forged `Referer` with a bad `Origin` still
    `403`, proving the referrer is not consulted.
65. `POST /chat/messages` before identify holds the message; `GET /chat/messages` returns
    `state: 'awaiting_identity'` and no ticket exists (Edge Case 25).
66. `POST /chat/identify` creates the customer and the ticket with `channel = chat`, and the held
    messages appear in the thread **in order**.
67. `GET /chat/messages?after=<id>` returns only newer messages, and an **internal** note on the
    ticket is **never** returned — the `publicOnly()`-in-the-query rule.
68. An expired/revoked session gets the one `401` and it is byte-identical to the missing-token
    `401` (Edge Case 26).
69. The message cap returns `422` (Edge Case 27).
70. A widget token is rejected by `/api/portal/me` and by `/api/user`, and a `portal_sessions`
    token is rejected by `/api/widget/chat/messages` — **the two-identities rule extended to a
    third**.

### K — `api/tests/Feature/Channels/ChannelOverviewConnectionTest.php` (new)

**Done Criterion 4.**

71. No rows → all five `not_connected`, `connection` null on each.
72. One connected `whatsapp` row → that channel `connected` with `connection.provider` and
    `last_inbound_at`; the other four unchanged.
73. `connection.inbound_24h` counts only `channel_inbound_messages` inside 24 hours, and counts
    them **unscoped by `visibleTo`** while `ticket_count` stays scoped — assert with an Agent whose
    queue excludes the tickets (Task 35's deliberate asymmetry).
74. A connection in `error` reports `status = 'error'` with `connection.last_error_key`.
75. The `?period=` contract is unchanged for `ticket_count` (a regression guard on Task 35).

### L — `api/tests/Feature/Admin/ChannelConnectionEndpointTest.php` (new)

76. `PUT /api/admin/channels/whatsapp` creates the row, stores `secret_last_four`, and the
    response contains **no** `secret` and no `verify_token`.
77. A second `PUT` **omitting** `secret` keeps the stored one (assert by decrypting the model);
    an empty string clears it.
78. A `config` key outside the allowlist is dropped by `validated()` and never persisted
    (Edge Case 33).
79. A provider whose `channel()` mismatches the route `{channel}` → `422`.
80. `PUT /api/admin/channels/web_form` → `404` (Edge Case 29).
81. `POST …/test` failure sets `status = Error` + `last_error_key`; success clears both.
82. `DELETE` removes the row, and the overview reports `not_connected` again.
83. Every action writes one `AuditTrail::CHANNEL_CONNECTION_CHANGED` row whose context names the
    verb and does **not** contain the secret.

### M — `api/tests/Feature/ApiContractTest.php` (extend, do **not** restructure)

84. The three shape locks and the `api/webhooks/` gate test from Task 61. Run `pint` on the file
    first if it is dirty, so a reformat is not attributed to this story (WIS-24's recorded scope
    creep).

### N — `api/tests/Feature/Admin/AdminAuthorizationTest.php` (extend)

85. The `{channel}` placeholder and the four contracted endpoints from Task 62. The three
    "denies an Agent / Team Lead / unauthenticated on EVERY `/api/admin/*` route" tests then cover
    the new routes with no further edit — that is the point of the placeholder.

### O — `api/tests/Feature/Channels/ChannelOverviewAuthTest.php` (rewrite two tests)

86. Task 60's two rewrites. Leave the `401` test at `:10-12` alone.

### P — `api/tests/Feature/Seeding/SeededDataRealismTest.php` (extend) and `api/tests/Unit/Channels/`

87. `migrate:fresh --seed` leaves `channel_connections`, `channel_inbound_messages`,
    `channel_outbound_messages` and `chat_sessions` all at **zero** rows (Edge Case 23), and the
    existing whatsapp/sms/chat **ticket** counts WIS-25 asserts are unchanged.
88. `api/tests/Unit/Channels/ThreadMatcherTest.php` — the window boundary at exactly
    `thread_window_hours` and one second past it, and the closed-status exclusion, without HTTP.
89. `api/tests/Unit/Channels/InboundCustomerResolverTest.php` — email match, phone match, create,
    and the duplicate-`QueryException` path returning the existing row rather than throwing.

### Q — Frontend

90. `web/src/features/channels/components/ChannelCard.test.tsx` — the three status states each
    render their translated label **and** a distinct dot class (never colour alone); `connection`
    non-null renders the last-inbound line and the 24h count; `status = 'error'` renders
    `last_error_key` through `t()`.
91. `web/src/features/channels/pages/ChannelsPage.test.tsx` (**extend**) — replace the
    `getAllByText('Not connected')).toHaveLength(5)` assertion at `:73` with a mixed-status
    fixture; keep every other assertion, including the no-literal-zero empty state.
92. `web/src/features/channels/pages/ChannelsPage.roles.test.tsx` (**rewrite three tests**) — an
    Administrator sees `ChannelConnectPanel`; an Agent and a Team Lead see **no** configuration
    affordance at all. That was the assertion that mattered; the release-notice regex at `:22`
    goes.
93. `web/src/features/channels/components/ChannelConnectModal.test.tsx` — the secret field shows
    only `•••• 1234`, an empty submit omits `secret` from the payload, and the plaintext is never
    in the DOM.
94. `web/src/features/chat-widget/pages/WidgetChatPage.test.tsx` — all four async states, the
    identify → ticket transition, the `after` cursor advancing across polls, and polling **stopping**
    on `state === 'ended'`.
95. `web/src/features/chat-widget/api/widgetClient.test.ts` — the base URL is the **relative**
    `/api` and the `Accept-Language` header is present, so the documented exception in Decision 10
    is enforced rather than trusted.
96. `web/src/i18n/catalogueParity.test.ts` passes with the new `channels.json` keys in both
    locales; `node scripts/check-no-literals.mjs` is clean including the new
    `src/features/chat-widget` root.

---

## Migration / Rollback

Four new tables, **zero** `Schema::table()` on any existing table, and therefore no backfill and
no column added to another story's migration.

**Forward:** `php artisan migrate` in `api/`. Order is the file order:
`channel_connections` → `channel_inbound_messages` → `channel_outbound_messages` →
`chat_sessions`. The last three all FK to the first, so the order is load-bearing.

**Backward:** `php artisan migrate:rollback --step=4`. Each `down()` is a `dropIfExists`, in
reverse dependency order.

**Half-applied state.** Because nothing alters an existing table, a failure part-way leaves one to
three unused empty tables and a fully working application: `config('channels.enabled')` gates every
write path, and a missing `channel_connections` row is the `not_connected` state the UI already
renders. There is no window in which existing ticket or message behaviour changes.

**Data loss on rollback.** Dropping `channel_outbound_messages` discards undelivered replies —
the `ticket_messages` rows survive, so nothing an agent wrote is lost, but the *delivery* is.
Drain first (`php artisan channels:flush-outbound`) if that matters. Dropping
`channel_inbound_messages` discards the idempotency ledger and the email threading map, so
re-enabling later can re-ingest a payload a provider redelivers and will lose header-based
threading for older tickets (the subject-token and phone-window fallbacks still work). Tickets and
messages are untouched by any rollback.

**Not reversible by migration:** nothing. No enum value is persisted anywhere that a rollback
leaves dangling, because `channel_connections` is the only place `ChannelProvider` is stored and it
goes with the table.

---

## Owner Setup — what is still needed for live ingestion

`.squad/pipeline.md:13-17` authorises this section: *"The execute agent builds code + unit tests
against fakes and records exactly what external setup the owner must still do; end-to-end 'real
inbound' criteria stay unchecked until the owner verifies."* Each item names the Done Criterion it
unblocks, so the owner can see that doing one half alone ticks one criterion and nothing else.

**Nothing here is a blocked criterion for chat.** Done Criteria 3, 4, 5 and 6 need no account, no
credential and no tunnel.

### Unblocks Done Criterion 2 — WhatsApp

1. A Meta app with the **WhatsApp** product added, and a WhatsApp Business Account attached.
2. The **Phone number ID** (not the phone number) → `config.phone_number_id`.
3. A **permanent access token** — a System User token, **not** the 24-hour temporary token the
   dashboard shows first, which is the most common reason this stops working the next day →
   the connection `secret`.
4. The app's **App Secret** → used for `X-Hub-Signature-256`. Store it as the connection secret's
   companion if the token and app secret differ; the plan stores the token in `secret` and the app
   secret is what `verify()` reads, so **both** are required and the admin form asks for both.
5. A **verify token** chosen by the owner (any random string) → `verify_token`.
6. Register `https://<api-host>/api/webhooks/channels/whatsapp_cloud` as the callback URL in the
   Meta dashboard, complete the `GET` handshake, **and separately subscribe the `messages`
   field** — registering the URL without subscribing the field is silent and delivers nothing.
7. The callback must be publicly reachable over **https**; a local dev box needs a tunnel.
8. Discharge: send a real WhatsApp message to the number, confirm a ticket appears, then
   `php artisan channels:test-send whatsapp <ticket-id>` and confirm it arrives on the phone.
   **Note the 24-hour window**: a free-form reply is rejected more than 24 hours after the
   customer's last message, and templates are out of scope.

### Unblocks Done Criterion 1 — inbound email + a delivered reply (two dependencies, not one)

9. An **inbound-parse capable relay** and an **MX record** pointed at it for the address or
   subdomain tickets arrive on → `config.inbound_address`.
10. A shared **signing secret** → the connection `secret`, verified as
    `X-Wisal-Signature: sha256=…`. **If the chosen relay offers no HMAC** (Brevo's inbound parsing
    authenticates by a secret embedded in the webhook URL instead), the owner must front it with a
    URL-embedded secret and that is a deliberate weakening to record, not to hide.
11. Webhook URL: `https://<api-host>/api/webhooks/channels/email_webhook`.
12. **Plus** the Brevo SMTP credentials WIS-27 is still waiting on — the *reply* half of this
    criterion rides WIS-27's mailer, and WIS-27's own two delivery criteria are unticked for the
    same reason. Criterion 1 therefore has **two** external dependencies.
13. Discharge: send a real email to the address, confirm a ticket, reply from the app, confirm the
    reply arrives **and** that replying to *that* email appends to the same ticket (which is what
    proves Decision 9's `Message-ID` recording works end to end).

### Unblocks nothing on its own — SMS (a second route to Criterion 2's shape)

14. A Twilio (or equivalent) account and an **SMS-capable number** → `config.from_number`.
15. **Account SID** → `config.account_sid`; **Auth Token** → the connection `secret` (it is both
    the API credential and the signing key).
16. Point the number's inbound webhook at
    `https://<api-host>/api/webhooks/channels/twilio_sms` with **`POST`**, using the **exact**
    public URL including scheme and any trailing slash — Twilio signs the URL, so a
    host-rewriting proxy or a differing slash breaks verification (Edge Case 31).

### Required for every channel

17. **A running scheduler.** `php artisan schedule:work`, or the cron entry. The outbound drain is
    a scheduled command and **nothing is delivered reliably without one** — the inline attempt is
    best-effort and capped. WIS-24 recorded the same requirement, and it is the quiet way a
    feature appears broken.
18. **Connect each channel in the app**: Channels → Connect, choose the provider, paste the
    credentials, press **Test**, and copy the webhook URL the panel shows into the provider
    dashboard.

### Chat — nothing

19. Set `config.allowed_origins` to the sites that may embed the widget and copy the
    `data-site-key` snippet. No account, no credential, no tunnel. `/widget-demo.html` proves it
    locally.

---

## Verification Steps

1. **Backend suite:** in `api/`, `php artisan test`. Expect **0 failures** and a pass count above
   the 706 / 3224-assertion baseline at `main`'s tip (commit `5aacfa6`). Run
   `php artisan test --filter=Channel` too, so a failure in this story's own files is not lost in
   the total.
2. **Frontend suite:** in `web/`, `npx vitest run`. Expect **0 failures** above the 599-pass / 97-file
   baseline. Then `npx tsc -b --force`, `npm run lint` (clean apart from the 5 pre-existing
   warnings), `npm run build` (exit 0), `npm run i18n:check`, and
   `node scripts/check-no-literals.mjs` (clean, now across 20 roots).
3. **Formatting:** in `api/`, `./vendor/bin/pint --test` must be clean on **every path this story
   touched**. The 27 dirty files it reports are pre-existing; touching none of them is the
   standard. Verify with `git diff --name-only` against that list.
4. **Migrations round-trip:** in `api/`, `php artisan migrate` → `php artisan migrate:rollback
   --step=4` → `php artisan migrate`, all exit 0.
5. **Config cache:** in `api/`, `php artisan config:cache` then `php artisan config:clear`, both
   exit 0 — proves `config/channels.php` neither throws nor touches the database.
6. **Schedule:** `php artisan schedule:list` shows `channels:flush-outbound` every five minutes
   beside `sync:flush-outbox`, `sync:pull-customers`, `sla:evaluate` and
   `tasks:dispatch-due-reminders`.
7. **Seeder is silent — by count, not by reasoning:** `php artisan migrate:fresh --seed`, then
   `php artisan tinker --execute="echo ChannelConnection::count(), ChannelInboundMessage::count(),
   ChannelOutboundMessage::count(), ChatSession::count();"` → `0000`, and the WIS-25 ticket counts
   (64 tickets; whatsapp 8, sms 3, chat 14) unchanged.
8. **Routes:** `php artisan route:list --path=webhooks` shows the two webhook routes carrying
   `throttle:channel-webhook` and **neither** `auth:sanctum` **nor** `portal`;
   `--path=admin/channels` shows four routes each carrying `auth:sanctum` + `administrator` +
   `active`; `--path=widget` shows one public route and three behind `chat-widget`.
9. **The tripwire grep:** `grep -rn "Http::" api/app` returns **exactly four** files —
   `Services/HttpIntegrationTester.php`, `Services/Ai/OpenAiCompatibleAssistGenerator.php`,
   `Services/Integrations/OutboundHttpClient.php`, `Services/Channels/ChannelHttpClient.php`. A
   fifth is a defect.
10. **Secret sweep:** `grep -rn "getMessage()" api/app/Services/Channels api/app/Http/Controllers/Webhooks`
    returns **nothing**; `grep -rn "->secret\|->verify_token" api/app/Http/Resources` returns only
    `secret_last_four`; `grep -rniE "bearer|token|secret" api/tests/fixtures/channels` returns
    nothing.
11. **CORS and CSP untouched:** `git diff --name-only` shows **no** change to
    `api/config/cors.php`, `api/app/Http/Middleware/SecurityHeaders.php`, or
    `api/app/Models/Integration.php` / `IntegrationResource.php` (Decision 1's no-touch claim), and
    `web/vercel.json` is unchanged.
12. **No new dependency:** `git diff --stat` shows no change to `api/composer.json`,
    `api/composer.lock`, `web/package.json` or `web/package-lock.json`.
13. **Ingestion works with no account (Done Criterion 5 and half of 1/2, live):**
    ```
    php artisan channels:ingest-fixture whatsapp_cloud     # prints outcome=created, ticket id
    php artisan channels:ingest-fixture whatsapp_cloud     # prints outcome=duplicate, same ticket
    ```
    Confirm one ticket and one ledger row in the database.
14. **Widget works with no account (Done Criterion 3), end to end, by eye:** `php artisan serve`
    in `api/`, `npm run dev` in `web/`, open `http://localhost:5173/widget-demo.html`, click the
    launcher, send a message, identify, and confirm the ticket appears in the staff queue with
    `channel = chat` and the transcript in the thread. Then `npm run build && npm run preview`
    and repeat, so the production static-file path is proven too.
15. **Channels screen (Done Criterion 4), by eye:** as an Administrator, connect a channel with a
    dummy credential, press **Test** (expect a localised error, not a stack trace), confirm the
    card flips to **Error** with a readable reason; fix nothing and instead ingest a fixture, then
    confirm the card shows **Connected**, a last-message time and a 24h count. As an Agent, confirm
    there is no configuration affordance anywhere on the page.
16. **RTL and dark theme:** switch to Arabic and to the dark theme; check the three status pills,
    the connect modal and the widget against `docs/design/brief.md` — mirrored layout, no clipped
    text, contrast holds, and the status dot is never the only signal.

---

## Done Criteria

The six from WIS-22, verbatim, plus the code-verifiable sub-criteria that discharge them. **Two
are legitimately pending on owner-supplied external accounts** and are marked as such — this
mirrors WIS-26's two live-key criteria and WIS-27's two delivery criteria, both of which the
pipeline accepted as pending rather than failed.

- [ ] **A real inbound email creates a ticket and a reply is delivered back to the sender.**
      *(Pending: an inbound-parse relay + MX record + signing secret, and WIS-27's Brevo SMTP
      credentials. Discharge: Owner Setup items 9-13.)*
- [ ] **A WhatsApp message creates a ticket; an agent reply reaches the customer's phone.**
      *(Pending: a Meta WhatsApp Business account, phone number id, permanent token, app secret and
      a registered webhook with the `messages` field subscribed. Discharge: Owner Setup items 1-8.)*
- [x] **The chat widget embeds on a static page and opens a ticket.** No external account. Proven
      by `web/public/widget-demo.html` + §J + Verification Step 14.
- [x] **`/channels` shows Connected + last-sync for each wired channel and an error state when the
      credential is rejected.** Proven by §K and §H test 53.
- [x] **Ingestion is idempotent — a redelivered webhook does not double-create.** Proven by §D
      test 20 (`tickets.updated_at` and `last_inbound_at` byte-identical after the second call) and
      Verification Step 13.
- [x] **Tests cover: thread matching, idempotency, and the error path.** §E (thread matching,
      including the two cross-customer security tests), §D test 20 (idempotency), §F (the webhook
      error path) and §H tests 50-56 (the delivery error path).

Supporting criteria, each readable from the diff:

- [x] Signature verification hashes **`$request->getContent()`** and compares with `hash_equals`
      in all three adapters, and §A test 2 proves the raw-body rule with a re-encoded body.
- [x] A verified webhook **always** answers 2xx; only an unverified one (or an oversized body)
      answers 4xx. §F tests 33-39.
- [x] `ThreadMatcher` discards any candidate whose `customer_id` differs from the resolved sender,
      and returns `null` outright for an unrecognised sender. §E tests 29-31.
- [x] Outbound delivery goes through the **outbox**: the row is written inside the reply's
      transaction, the inline attempt is capped, and `channels:flush-outbound` is scheduled. §G
      tests 46-48, Verification Step 6.
- [x] Every outbound provider request passes `App\Services\Integrations\OutboundUrlGuard` **at send
      time**, and `grep -rn "Http::" api/app` returns exactly four files. §I, Verification Step 9.
- [x] An internal note never leaves the building: zero outbox rows and
      `Http::assertNothingSent()`. §G test 42.
- [x] No secret in any new surface — not in a response, a stored error, a log line, a fixture, or
      the `config` blob. §L tests 76-78, Verification Step 10.
- [x] `config/cors.php`, `SecurityHeaders.php` and `web/vercel.json` are **unchanged**, and the
      widget still works — Decision 10's whole claim. Verification Steps 11 and 14.
- [x] `integrations` is untouched: no change to `Integration.php`, `IntegrationResource.php` or any
      `integrations` migration. Decision 1, Verification Step 11.
- [x] `migrate:fresh --seed` writes zero rows to all four new tables and performs zero outbound
      requests. Verification Step 7.
- [x] The four new admin routes carry `{channel}` as their only parameter, and
      `AdminAuthorizationTest::adminRoutes()` substitutes it. §N.
- [x] `README.md`'s five stale channel claims are corrected, and the two deliberate deferrals
      (no attachments, no WhatsApp templates) are stated rather than silent. Task 77.
- [x] No new composer or npm dependency. Verification Step 12.

**STOP HERE. This is the last story in `.squad/pipeline.md`. Report to the owner, hand over the
Owner Setup section, and wait for confirmation before touching anything else.**
