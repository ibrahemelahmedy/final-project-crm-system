> **Fetched from jira:** [WIS-22](https://ibrahemelahmedy.atlassian.net/browse/WIS-22)  
> *Fetched 2026-09-09T06:15:23.663Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Live channel ingestion — email, WhatsApp, chat, SMS (Category 3 completion)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

Category 3 (Communication Channels) shipped as read-only (
    
                
            
            WIS-15
        
                                                    To Do
            
). Every ticket_messages row already carries a channel, and /channels shows per-channel volume — but nothing arrives automatically. The page states "Not connected" honestly.

Goal

An inbound message on a connected channel becomes a ticket (or appends to an existing thread) with no agent copy-paste.

Scope

	Email: inbound webhook or IMAP poll → new ticket, or append to thread by matching Message-ID / In-Reply-To. Outbound replies go back out over the same channel.

	WhatsApp: Meta WhatsApp Business Cloud API — inbound webhook + send. Number verification handled in integrations.

	Live chat: an embeddable widget script + a websocket (or polling) transport; a chat session opens a ticket.

	SMS: provider adapter (Twilio or similar) — inbound webhook + send.

	Channels page: each channel flips to "Connected" with a last-sync timestamp and a 24h inbound count; a failing connection surfaces an error state.

Out of scope

	Instagram / Messenger / voice.

	Rich media beyond a single attachment per message.

Dependencies

	External accounts: an email host or relay, a Meta WhatsApp Business account, an SMS provider, push/websocket infrastructure.

	Builds on the existing channel enum and integrations table.

Done criteria

	[ ] A real inbound email creates a ticket and a reply is delivered back to the sender.

	[ ] A WhatsApp message creates a ticket; an agent reply reaches the customer's phone.

	[ ] The chat widget embeds on a static page and opens a ticket.

	[ ] /channels shows Connected + last-sync for each wired channel and an error state when the credential is rejected.

	[ ] Ingestion is idempotent — a redelivered webhook does not double-create.

	[ ] Tests cover: thread matching, idempotency, and the error path.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/live-channel-ingestion/WIS-22/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Live Channel Ingestion — Inbound Webhooks, Thread Matching & Outbound Channel Replies (Category 3 completion)
- **Feature slug (folder under `plans/`):** `live-channel-ingestion`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-22` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Live channel ingestion — email, WhatsApp, chat, SMS (Category 3 completion)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Context

Category 3 (Communication Channels) shipped as read-only (WIS-15). Every ticket_messages row
already carries a channel, and /channels shows per-channel volume — but nothing arrives
automatically. The page states "Not connected" honestly.

Goal

An inbound message on a connected channel becomes a ticket (or appends to an existing thread)
with no agent copy-paste.

Scope

    Email: inbound webhook or IMAP poll → new ticket, or append to thread by matching
    Message-ID / In-Reply-To. Outbound replies go back out over the same channel.

    WhatsApp: Meta WhatsApp Business Cloud API — inbound webhook + send. Number verification
    handled in integrations.

    Live chat: an embeddable widget script + a websocket (or polling) transport; a chat session
    opens a ticket.

    SMS: provider adapter (Twilio or similar) — inbound webhook + send.

    Channels page: each channel flips to "Connected" with a last-sync timestamp and a 24h
    inbound count; a failing connection surfaces an error state.

Out of scope

    Instagram / Messenger / voice.

    Rich media beyond a single attachment per message.

Dependencies

    External accounts: an email host or relay, a Meta WhatsApp Business account, an SMS
    provider, push/websocket infrastructure.

    Builds on the existing channel enum and integrations table.

Done criteria

    A real inbound email creates a ticket and a reply is delivered back to the sender.

    A WhatsApp message creates a ticket; an agent reply reaches the customer's phone.

    The chat widget embeds on a static page and opens a ticket.

    /channels shows Connected + last-sync for each wired channel and an error state when the
    credential is rejected.

    Ingestion is idempotent — a redelivered webhook does not double-create.

    Tests cover: thread matching, idempotency, and the error path.
```

---

## Acceptance criteria

*(The six Done criteria from WIS-22, verbatim, as a checklist.)*

```
[ ] A real inbound email creates a ticket and a reply is delivered back to the sender.
[ ] A WhatsApp message creates a ticket; an agent reply reaches the customer's phone.
[ ] The chat widget embeds on a static page and opens a ticket.
[ ] /channels shows Connected + last-sync for each wired channel and an error state when the
    credential is rejected.
[ ] Ingestion is idempotent — a redelivered webhook does not double-create.
[ ] Tests cover: thread matching, idempotency, and the error path.
```

### Which of these can be ticked without an external account — read this before planning

This is **not** WIS-24. WIS-24's six criteria all described *our* behaviour toward an HTTP
endpoint, so `Http::fake()` discharged every one of them. WIS-22 has a genuine split, and the
plan must be honest about it rather than pretending a fake proves a live delivery:

| Criterion | Discharge |
|---|---|
| 1 — real inbound email → ticket, reply delivered back | **Owner setup required** for the "real" and "delivered" halves. The *ingestion* half (a signed inbound-parse payload becomes a ticket) and the *enqueue* half (the agent reply is queued for outbound delivery over the same channel) are both fully testable. The last mile — an SMTP send that actually arrives — inherits WIS-27's two still-unticked delivery criteria and the same Brevo credential. |
| 2 — WhatsApp message → ticket; agent reply reaches the phone | **Owner setup required** for the send half. Inbound (signature verification + the Cloud API webhook envelope → a ticket) is fully testable against a captured fixture; the send is `Http::fake()`-testable as *our* request shape, but "reaches the customer's phone" needs a Meta WhatsApp Business account, a phone number id and a permanent access token. |
| 3 — chat widget embeds on a static page and opens a ticket | **Code-verifiable, no external account.** This is the one channel with no third party in it. A shipped static demo page plus a loader script plus feature tests can discharge it end to end. Design it so this is true — that is what makes this story shippable at all. |
| 4 — /channels Connected + last-sync + 24h count + error state | **Code-verifiable.** Purely our own schema and our own screen. |
| 5 — idempotent ingestion, no double-create on redelivery | **Code-verifiable.** A unique index plus a test that posts the identical payload twice. |
| 6 — tests: thread matching, idempotency, error path | **Code-verifiable.** |

So: **criteria 3, 4, 5 and 6 must be green before this story is handed back**, and criteria 1
and 2 stay unticked with a written discharge recipe, exactly as WIS-26's two live-key criteria
and WIS-27's two delivery criteria did. Do not invent a criterion the owner did not write, and
do not tick 1 or 2 on the strength of a fake.

**The pattern to copy is WIS-26/27's key seam.** Every provider-specific fact — the signature
scheme, the envelope shape, the send request — lives behind an injectable adapter with a fake
bound in `api/tests/Pest.php`, so the whole engine is exercised with zero credentials, and
pasting real credentials changes configuration only, never code.

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

- **Blocked by:** nothing. WIS-25, WIS-26, WIS-27, WIS-23 and WIS-24 have all cleared. This is
  the last story in the `.squad/pipeline.md` order and the largest.
- **Depends on code areas / other stories:**
  - **Story 14 — channels-overview (WIS-15)**,
    `.squad/plans/channels-overview/14-story-channels-overview.md`. Owns
    `ChannelOverviewController`, `ChannelOverviewRequest`, `ChannelOverviewResource`,
    `web/src/features/channels/**`, `web/src/i18n/locales/{en,ar}/channels.json`, and the three
    test files under `api/tests/Feature/Channels/`. **Every one of its central design claims is
    the thing this story reverses**, and it wrote those claims into code as assertions, not just
    comments — see Extra note 1.
  - **Story 04 — ticket-management (WIS-2)**. Owns `tickets`, `Ticket`, `Ticket::CATEGORIES`
    (`api/app/Models/Ticket.php:19`), `App\Enums\Channel`, `StoreTicketRequest`, the `ticket_events`
    append-only history and `TicketController@store`. Inbound ingestion creates tickets and must
    not bypass what that story guarantees — `ticket_events` stays the single ticket-history table.
  - **Story 05 — conversation-thread (WIS-3)**. Owns `ticket_messages`, `TicketMessage`,
    `TicketMessageController`. `TicketMessageController.php:59` is the **only** place in `api/app`
    that writes an agent-authored message, and `TicketMessage::scopePublicOnly()` is the
    customer-facing enforcement point. Outbound channel replies hook the former; nothing about
    this story may weaken the latter.
  - **Story 03 — customer-management (WIS-4)**. Owns `customers` and `Customer`, including
    `Customer::normalizePhone()` and **`Customer::phoneMatchCandidates()`
    (`api/app/Models/Customer.php:104`)** — the existing, tested answer to "which customer is
    `+201234567890`?", which WhatsApp and SMS ingestion resolve senders with rather than writing a
    second normaliser. Also the two partial unique indexes and the `email`/`phone` mutators: an
    ingestion path that creates a customer must go through the model.
  - **Story 25 — integration-data-sync (WIS-24)**,
    `.squad/plans/integration-data-sync/25-story-integration-data-sync.md`. The single most
    important dependency. Its `00-overview.md` names this story explicitly in two places: (a)
    *"Any future outbound call — a WIS-22 channel provider included — binds this interface and
    calls `validate()` at send time. A second copy of the four checks is a defect."* and (b) the
    deferral *"An inbound webhook receiver … with signature verification is its own story, and its
    own threat model."* **This story is that story.** It inherits `OutboundUrlGuard`,
    `OutboundUrlVerdict`, `DnsOutboundUrlGuard`, the `OutboundHttpClient` posture
    (`allow_redirects => false`, configured timeouts, a body-size cap, never a raw exception
    message in a stored field) and the whole outbox shape.
  - **Story 18 — integrations-erp (WIS-19)**. Owns `integrations`, `Integration` (the `encrypted`
    secret cast and the `DecryptException` rule), `IntegrationType`, `IntegrationStatus`,
    `IntegrationResource`, the `administrator`-gated `/api/admin/integrations*` routes, the
    `AuditTrail::INTEGRATION_*` constants and `web/src/features/integrations/**`. Two of its rules
    bind here absolutely: **a stored secret never leaves the server except as
    `secret_last_four`**, and **a stored error is an i18n key, never a raw exception message**.
  - **Story 23 — transactional-email (WIS-27)**. The only real mail transport in the app
    (Brevo over the stock `smtp` mailer, `MAIL_MAILER=log` as the committed default), the shared
    `resources/views/mail/layout.blade.php`, and `php artisan mail:test` as the owner's discharge
    recipe. Outbound *email* replies ride this, not a new transport. Its two delivery criteria are
    still unticked for want of Brevo credentials — Done Criterion 1 here has the same tail.
  - **Story 24 — ai-customer-intelligence (WIS-23)**. Owns `portal_chat_conversations` /
    `portal_chat_messages` and the `/api/portal/chat*` routes. **These are a different feature
    from this story's chat widget** and must not be reused — see Extra note 6. Also the source of
    the `DB::afterCommit` + `app()->terminating()` + per-process-cap pattern, and of the
    `AI_CLASSIFY_ENABLED=false`-in-`phpunit.xml` precedent this story copies for its own flag.
  - **Story 17 — customer-portal (WIS-16)**. `PortalAuth` (`api/app/Http/Middleware/PortalAuth.php`)
    is the exact template for the chat-widget session middleware — a bearer token resolved to a
    row, bound onto the request attributes, never `Auth::login()`, with one identical 401 body for
    every failure mode. `portal_sessions` is the template for the widget session table.
  - **Story 06 — sla-rules-automation (WIS-6)**. `api/routes/console.php` and the no-queue-worker
    constraint stated there as a design fact. Any scheduled drain this story adds goes in that
    file beside the four already there.
  - **Story 08 — users-roles-admin (WIS-8)**. `AuditTrail`, the `administrator` middleware, and
    `AdminAuthorizationTest`, which walks the live route list — see Extra note 3.

## Extra notes (optional)

Findings verified against the code at intake time. Each is a trap the executor would otherwise
hit, and several are the reason a design decision has to go one way rather than the other.

**1. Story 14 wrote "not connected" into the test suite as an assertion, not a comment. Two
existing tests must be rewritten, and one of them fails the moment a route is added.**

`api/tests/Feature/Channels/ChannelOverviewAuthTest.php` contains both landmines:

- `:14-25` — *"grants every role 200 with the same not_connected status for all channels"* loops
  all five channels and asserts `$channel['status'] === 'not_connected'`. Done Criterion 4 makes
  that false by design.
- `:27-37` — *"exposes no route that writes channel configuration"* filters the live route list
  on `str_contains($r->uri(), 'channels')`, asserts **`toHaveCount(1)`**, and asserts no
  `POST/PUT/PATCH/DELETE`. **Any** new route whose URI contains the substring `channels` — an
  admin config route, a webhook route, anything — fails this the day it lands.

The two sibling files are safe: `ChannelOverviewTest.php` and `ChannelOverviewEmptyTest.php`
assert only `ticket_count` and `meta.*`, so adding keys to the resource does not touch them.
On the frontend the same claim is duplicated three times and each has to be undone deliberately:
`web/src/features/channels/model/channel.ts:11` (`export type ChannelStatus = 'not_connected'`),
`:55-62` (`STATUS_LABEL_KEYS` with the comment *"There is deliberately NO `connected` entry …
so a future bug cannot render a fabricated healthy state"*), and
`ChannelsPage.test.tsx:73` (`expect(screen.getAllByText('Not connected')).toHaveLength(5)`).
`ChannelsPage.roles.test.tsx:22` pins the admin release notice
(`/Channel integrations are not available in this release/i`) in three separate tests.

**2. `SecurityHeaders` is global and hostile to an embedded widget — but the SPA's own origin is
not, and that is the whole answer.**

`api/bootstrap/app.php:82` appends `App\Http\Middleware\SecurityHeaders` to the **global** stack,
and `SecurityHeaders.php:15-18` sets `X-Frame-Options: DENY` and
`Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` on every response the
Laravel app produces — `routes/web.php` included. `api/tests/Feature/ApiContractTest.php:43-50`
asserts that exact CSP string, so it is contracted, not incidental.

Meanwhile `api/config/cors.php:11-30` restricts `paths` to `api/*`, derives `allowed_origins`
from `FRONTEND_URL` (default `http://localhost:5173`) and sets `supports_credentials => false`.
A widget script running on a **customer's** website is a third origin: it is neither
`FRONTEND_URL` nor same-origin with the API, so a direct XHR from the host page is refused, and
an iframe pointed at any Laravel route is refused by `frame-ancestors 'none'`.

**The escape hatch is already in the repo.** `web/vercel.json` sets **no headers at all** and
rewrites `"/api/(.*)"` to the API host. So a document served from the **web** deployable (a) is
framable, because nothing sets `X-Frame-Options` on it, and (b) can call `/api/...`
**same-origin**, because Vercel proxies it — meaning zero CORS involvement and zero change to
`config/cors.php`. A widget built as *a tiny loader script that injects an iframe pointing at a
new unauthenticated SPA route* therefore needs neither a CORS change nor a CSP exception nor a
per-route header override. Any design that instead serves widget JS from Laravel and XHRs
cross-origin has to loosen `config/cors.php` for the whole `api/*` surface — reject it.

Note the mirror-image constraint: `web/src/lib/api.ts:30-35` builds the shared axios instance
from `VITE_API_URL` (absolute, `http://localhost:8000/api` in `web/.env`), so an iframe page that
wants the same-origin proxy must not blindly reuse that instance.

**3. `AdminAuthorizationTest::adminRoutes()` substitutes exactly FOUR placeholders. A fifth
breaks the suite for the wrong reason.**

Confirmed at `api/tests/Feature/Admin/AdminAuthorizationTest.php:49-53`: `{user}`, `{type}`,
`{branch}`, `{department}`. WIS-24 dodged this by forcing every one of its five new routes to use
`{type}` as its only parameter (`api/routes/api.php:222-233` documents exactly that). This story
almost certainly wants `{channel}` instead, since `App\Enums\Channel` — not `IntegrationType` —
is the right key. That is fine, but it is **an explicit task**: add `{channel}` to the
substitution array *and* to the contracted-endpoint assertions at `:61-96`. A `{channel}` route
added without touching that array yields a literal `"{channel}"` in the URL → 404 before the
`administrator` gate can 403 → three of that file's tests fail with a misleading message.
`AdminAuthorizationTest.php:126-138` additionally asserts every `api/admin/*` route carries
`auth:sanctum`, `administrator` **and** `active`, which the group already provides.

**4. `integrations` is the wrong home for a channel connection, and the Jira line saying
otherwise is worth arguing with in writing.**

The description says *"Builds on the existing channel enum and integrations table."* The channel
enum, yes. The table, look before you leap:

- `integrations.type` is `string(32)->unique()`
  (`api/database/migrations/2026_09_03_100000_create_integrations_table.php:22`), so there is
  exactly **one** row per type — fine for one ERP, wrong the day a tenant wires two inboxes.
- `endpoint_url` is `string(2048)` **NOT NULL** (`:25`). An inbound-only email channel has no
  outbound endpoint URL to put there.
- `App\Enums\IntegrationType`'s own docblock says it *"deliberately NOT `App\Enums\Channel`"*, and
  it **drops `chat`** — the one channel this story can fully deliver.
- WIS-24 hung nine sync columns off the same table
  (`2026_09_09_120000_add_sync_columns_to_integrations_table.php`) whose semantics
  (`inbound_field_map`, `conflict_rules`, `outbound_events`) are ERP-record-shaped and meaningless
  for a message channel.
- `IntegrationResource` is the contracted shape of the Integrations screen and
  `ApiContractTest.php:226-235` asserts `data.0.sync` structure and
  `assertJsonMissingPath('data.0.secret')` against it.

Whatever the plan chooses, it must **state the choice and the reason**, and if it introduces a
new table keyed on `App\Enums\Channel` it must say plainly that this diverges from the Jira
sentence and why. `web_form` is the case that proves the point: it is a `Channel` value with no
provider and must never acquire a connection row.

**5. There is still no queue worker, and this story has more outbound work than any before it.**

`api/routes/console.php:16-27` states the constraint as a design fact; `api/phpunit.xml:79` forces
`QUEUE_CONNECTION=sync`; nothing in `api/app` implements `ShouldQueue`; nothing runs `queue:work`.
"Async" cannot mean queued. The established shape is WIS-24's: a durable row written **inside**
the business transaction, a best-effort inline attempt via `DB::afterCommit` +
`app()->terminating()` bounded by a per-process counter, and a scheduled drain that is the actual
guarantee. Read `IntegrationEvents.php:48-146` and `OutboxDispatcher.php:16-95` before designing
outbound channel delivery; the retry ladder, the retryable/permanent split and the dead-letter
transition are all already written and worth mirroring rather than reinventing.

Note the closure lesson recorded in `IntegrationEvents.php:35-47`: the enqueue payload is built
**lazily**, because building it eagerly ran a `loadMissing()` on every `Ticket::created` even with
the feature flag off, and that poisoned an unrelated test's cached relation. Same trap applies to
any payload builder this story adds.

**6. The portal chatbot is NOT the chat widget. Do not reuse its tables.**

WIS-23 shipped `portal_chat_conversations` + `portal_chat_messages` and
`/api/portal/chat`, `/api/portal/chat/messages`, `/api/portal/chat/escalate`
(`api/routes/api.php:337-344`). That is an **AI** conversation for an **already-identified**
customer holding a `portal_sessions` token, keyed on `portal_session_id`, and it creates a ticket
only on explicit escalation. This story's widget is an **anonymous visitor on a third-party
page**, has no `Customer` until they volunteer one, and *opens a ticket as its whole purpose*.
Two different audiences and two different lifecycles. Reusing the tables would either break
WIS-23's `portal_session_id` key or force a nullable-everything schema; reusing the routes would
break `ApiContractTest.php:344-366`, which walks every `api/portal/*` route and fails anything
carrying `auth:sanctum` or lacking a portal gate — an anonymous widget route under that prefix
cannot satisfy it. **Keep the widget's routes out of the `api/portal/` prefix entirely.**

**7. HMAC verification must run on the RAW body, and comparison must be constant-time.**

Every provider signs bytes, not a decoded array. `$request->all()` / `$request->json()` gives a
re-encoded structure whose key order, unicode escaping and slash escaping differ from what was
signed — the HMAC will never match. Read `$request->getContent()` once and verify against that.
Compare with `hash_equals()`, never `===` or `==`. The three schemes this story needs are all
pure functions of `(raw body, headers, secret)` and are therefore **fully unit-testable with a
hand-computed digest and no credentials**:

- **WhatsApp Cloud API** — `X-Hub-Signature-256: sha256=<hmac_sha256(raw_body, app_secret)>`,
  plus a `GET` subscription handshake (`hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`)
  that must echo the challenge as **plain text** when the token matches and 403 when it does not.
  That handshake is a separate verb on the same URI and is easy to forget.
- **Twilio** — `X-Twilio-Signature` = base64(hmac_sha1(full request URL + the POST params sorted
  by key and concatenated as key+value, auth token)). Note it signs the **URL**, so it breaks
  behind a proxy that rewrites the host — worth a note in the owner-setup section.
- **Inbound email** — providers differ and several offer no HMAC at all. The repo already has its
  own convention to reuse: `OutboundHttpClient.php:91` sends
  `X-Wisal-Signature: sha256=<hmac_sha256(body, secret)>`. Accepting the same header shape
  inbound keeps one scheme in the codebase, and the owner-setup note records that Brevo's inbound
  parsing authenticates by a secret embedded in the webhook URL instead.

A webhook that fails verification must return a **4xx with no body detail** and must not reveal
whether the secret, the payload or the channel was the problem. A webhook that *passes*
verification but cannot be processed must still return **2xx** — otherwise the provider retries
forever and the retry itself becomes the outage (see Extra note 8).

**8. Idempotency and the 2xx contract are the same problem.**

Providers redeliver aggressively. The idempotency key is the **provider's own message id**, which
every one of the three supplies, so the guarantee is a unique index and not a heuristic. Copy
WIS-24's Decision 4 shape: a plain `unique()` is correct on a table with no soft deletes
(`2026_09_09_120200_create_integration_outbox_table.php:8-9,39`), and the second arrival must be
a **zero-write no-op** that still answers 2xx. Note the PostgreSQL detail WIS-24 was bitten by and
recorded at `IntegrationEvents.php:92-104` and in the pipeline run log: on Postgres a unique
violation **aborts the whole transaction**, so a per-record insert that may collide needs its own
nested `DB::transaction()` (a SAVEPOINT) or the very next statement fails too. Tests run on
Postgres (`api/phpunit.xml:71-76`), so this surfaces in the suite, not only in production.

**9. Thread matching has three genuinely different mechanisms — do not build one.**

- **Email** has real threading headers. `In-Reply-To` / `References` point at a `Message-ID` we
  emitted, so matching requires that we *record* the `Message-ID` of every outbound reply. That
  is a new persisted mapping, and it is also the idempotency ledger from note 8 — one table, two
  jobs. Subject-token matching (`[#412]`) is the standard fallback and must be bounded, because
  a forged subject line is otherwise a way to inject a message into someone else's ticket: the
  sender's identity has to match the ticket's customer before the token is honoured.
- **WhatsApp / SMS** have no threading headers at all. The only signal is the sender's phone
  number, so matching is: `Customer::phoneMatchCandidates()` → customer → their most recent
  non-closed ticket **on that channel** inside a configurable window → else a new ticket. The
  window is a real product decision (a reply three weeks later is a new issue) and belongs in
  `config`, not in a magic number.
- **Chat** carries its own session id, so the session row holds the ticket id and there is no
  matching to do.

The failure mode to design against is cross-customer leakage: a match must **never** attach a
message to a ticket belonging to a different customer, whatever the headers claim. Also note
`TicketMessage::scopePublicOnly()` — an ingested customer message is `public`; nothing ingested
is ever `internal`.

**10. Ticket creation from ingestion cannot go through `StoreTicketRequest`.**

`api/app/Http/Requests/StoreTicketRequest.php:21-27` makes `category`, `priority` **and**
`channel` all `required`, and `authorize()` calls `$this->user()->can(...)` — there is no
authenticated user on a webhook. The two existing programmatic creation paths are the model:
`TicketController@store` (`api/app/Http/Controllers/TicketController.php:63-118`) and
`PortalRequestController@store` (`:101-153`). Both do the same four things and both are worth
copying exactly, because the ordering is load-bearing and commented as such:

1. set `status`, `channel`, `priority`, `created_by = null` explicitly (the portal path pins
   `Priority::Normal` at `:116` and explains why: `create()` does not re-read the DB default and
   `SlaClock::applyTo()` needs a real enum instance);
2. `Ticket::create()`, **then** `SlaClock::applyTo($ticket)` then `save()` — `applyTo()` anchors
   on `created_at`, which does not exist until the row is inserted;
3. `TicketAssigner::pick()` and `recordAutoAssigned()` if it returns someone;
4. write the first `ticket_messages` row from the description with
   `author_type = AUTHOR_CUSTOMER`, `user_id = null`, `channel = $ticket->channel`.

Also inherited for free, and worth *asserting* rather than rebuilding: `Ticket::created` already
fires `TicketResolutionObserver`, `TicketClassificationObserver` (WIS-23 AI classification) and
`IntegrationEventObserver` (WIS-24 outbound enqueue), registered in that order at
`api/app/Providers/AppServiceProvider.php:123-133`. An ingested ticket therefore gets AI
classification and an outbound ERP event with no new code — and, symmetrically, an ingestion test
that binds an assist fake will find its queued response **consumed by the classification
observer**, which is precisely the mistake WIS-23's Edge Case 21 recorded.

**11. `TicketMessageController.php:59` is the ONE place an agent reply is written.**

`grep -rn "AUTHOR_AGENT" api/app api/database` returns eleven hits; only that one is a write from
a request. `TicketMessageFactory.php:35` and `TicketScenarioSeeder.php:281,452` are the other
writes, and both are test/seed paths. This makes an **explicit enqueue at that single call site**
strictly better than a `TicketMessage` model observer: the seeder writes several hundred messages
through the model on `migrate:fresh --seed` (`TicketScenarioSeeder.php:444-460`), so an observer
would need a `runningInConsole` guard, a visibility guard and an author guard just to stay quiet,
whereas the controller already knows it is handling a human agent's public reply. This is the
same reasoning that forced WIS-24's explicit `CsatSurveyController` enqueue.

Guards the enqueue needs regardless: only `visibility === public` (an internal note must never
leave the building — `MessageVisibility` at `api/app/Enums/MessageVisibility.php`), only a
channel that has a live connection, and never `web_form` or `chat` (chat is read by polling, and
`web_form` has no return path).

**12. `migrate:fresh --seed` must still perform zero outbound requests and write zero ingestion
rows, and the suite must stay quiet by default.**

The precedent is now three stories deep and is a hard rule: `api/phpunit.xml:32`
(`AI_CLASSIFY_ENABLED=false`, WIS-23) and `:40` (`INTEGRATION_SYNC_ENABLED=false`, WIS-24), each
with a comment saying which busy path it protects. This story adds a third master flag in the
same block. Verify by row count after `migrate:fresh --seed`, not by reasoning — WIS-24's execute
run did exactly that and it is why its counter-reset bug surfaced. The counter reset goes in
`api/tests/TestCase.php:13-28`, beside the three already there.

**13. `secret` handling is already solved; do not invent a second scheme.**

`Integration`'s `secret` uses Laravel's `encrypted` cast, sits in `$hidden`, and is absent from
every Resource — *"two independent things must both fail before it can reach a response"*
(`api/app/Models/Integration.php:11-26`). Reading it can throw `DecryptException` after an
`APP_KEY` rotation, which `OutboundHttpClient.php:44-55` catches alongside transport failures and
turns into an ordinary error, **never** logging `$e->getMessage()` because a transport exception
can embed the `Authorization` header. Whatever holds a channel credential must do all four of
those things. `secret_last_four` remains the only derived value that leaves the server.

**14. Server-derived display copy: this feature's convention is the exception, and it is the one
to follow.**

`.squad/plans/00-index.md:141-146` states the repo-wide rule that `*_label` fields are localised
server-side. The integrations/sync feature deliberately does not: its error strings are **i18n
keys resolved in the SPA** (WIS-24 Decision 11), because there is no `api/lang/*/integrations.php`
— and `ChannelOverviewResource.php:32-37` already ships `label_key` rather than `label`, with the
comment that per-channel help copy is *"UI copy owned by the frontend catalogue"*. So channel
connection errors are keys. `web/src/i18n/catalogueParity.test.ts` demands identical `en`/`ar` key
sets, and `web/scripts/check-no-literals.mjs` (run by `npm run lint` **and** asserted from
`src/i18n/noHardcodedStrings.test.ts`) enforces no bare JSX strings under the 19 roots listed in
`web/scripts/i18n-allowlist.json:3-22` — `src/features/channels` and `src/features/integrations`
are both on it. A new feature folder is **not** automatically enforced; if the widget lives in a
new root, adding it to that list is a task.

**15. Four README claims and one plans-index row go stale the moment this ships.**

Verified line numbers: `README.md:220` (the Category 3 table row, *"read-only overview that states
plainly that live ingestion is not in this release"*), `:231` (the Category 11 row's tail,
*"inbound email, WhatsApp and SMS send-and-receive are still not wired"*), `:246` (the assumptions
table, *"Whether 'multi-channel' means live inboxes — No."*), `:455` (the endpoint table, where
`/channels/overview` sits under **Reports**), and `:817-818` (Known gaps, *"Channels are
read-only"*). WIS-24's plan-review found the analogous `integrations.json:4` string still promising
the opposite of the shipped feature; do not repeat it. Whatever stays true — criteria 1 and 2
pending on owner credentials — should be stated as *pending credentials*, not as *not built*.

**16. What the owner must still do, and where to record it.**

`.squad/pipeline.md:13-17` already promises this: *"The execute agent builds code + unit tests
against fakes and records exactly what external setup the owner must still do; end-to-end 'real
inbound' criteria stay unchecked until the owner verifies."* The plan must therefore carry a
named, ordered setup section — modelled on WIS-24's mock-ERP posture note and WIS-26/27's
discharge recipes — covering at minimum:

- **WhatsApp:** a Meta app with the WhatsApp product added, a WhatsApp Business Account, a
  **phone number id**, a **permanent access token** (a system-user token, not the 24-hour
  temporary one), the app's **App Secret** for `X-Hub-Signature-256`, a **verify token** chosen by
  the owner, and the webhook callback URL registered in the Meta dashboard with the `messages`
  field subscribed. The callback URL must be publicly reachable over **https** — a local dev box
  needs a tunnel, and the `messages` subscription is separate from registering the URL.
- **SMS:** a Twilio (or equivalent) account, an SMS-capable number, the Account SID and **Auth
  Token** (which is also the signing key), and the number's inbound webhook pointed at our route
  with `POST`.
- **Inbound email:** an inbound-parse capable relay and an MX record pointed at it for the address
  or subdomain tickets should arrive on, plus the shared signing secret. Outbound replies need the
  Brevo SMTP credentials WIS-27 is still waiting on, so criterion 1 has **two** external
  dependencies, not one.
- **Chat:** nothing. That is the point.
- **A running scheduler** if anything is drained on a schedule — `php artisan schedule:work` or
  the cron entry. WIS-24 recorded the same requirement and it is the quiet way a feature appears
  broken.

Each item should say **which Done Criterion it unblocks**, so the owner can see that doing the
WhatsApp half alone ticks criterion 2 and nothing else.

**17. Baseline numbers to beat, so a regression is visible.**

At the tip of `main` (WIS-24 plan-review, commit `5aacfa6`): api `php artisan test` **706 pass /
3224 assertions**; web `npx vitest run` **599 pass / 97 files**; `npm run build` exit 0;
`npm run lint` clean apart from 5 pre-existing warnings; `node scripts/check-no-literals.mjs`
clean across 350 files / 19 roots; `pint --test` dirty on 27 **pre-existing** files (touching none
of them is the standard). `grep -rn "Http::" api/app` returns **exactly three** files today
(`HttpIntegrationTester.php`, `Services/Ai/OpenAiCompatibleAssistGenerator.php`,
`Services/Integrations/OutboundHttpClient.php`) — WIS-24's plan made that grep a tripwire, and any
new socket this story opens must be a named, guarded fourth, not an anonymous one.

## Technical hints (optional)

Repos/roots: `.` (`api/` Laravel 12 + `web/` React 19 + Vite). Files this story reads or touches:

**Channels (WIS-15) — the surface being completed**
- `api/app/Enums/Channel.php` — the five cases and `label()` via `__('enums.channel.*')`;
  `api/lang/en/enums.php:31-37` and the `ar` sibling hold the labels.
- `api/app/Http/Controllers/ChannelOverviewController.php` — the whole read path; note the
  `visibleTo($request->user())`-first ordering and the single grouped aggregate.
- `api/app/Http/Resources/ChannelOverviewResource.php:8-15,29-45` — the `data[]` + `meta` shape
  and the docblock claiming `status` is always `not_connected`.
- `api/app/Http/Requests/ChannelOverviewRequest.php:70-105` — the `7d/30d/90d` token contract.
- `api/tests/Feature/Channels/ChannelOverviewAuthTest.php:14-37` — **the two tests to rewrite**.
- `web/src/features/channels/model/channel.ts:11,55-66` — `ChannelStatus` and `STATUS_LABEL_KEYS`.
- `web/src/features/channels/pages/ChannelsPage.tsx:186-275` — the four async states and the
  admin-only release notice.
- `web/src/features/channels/components/ChannelCard.tsx` — the card, its status badge and the
  three-state count slot.
- `web/src/i18n/locales/{en,ar}/channels.json` — `status.notConnected` and the five
  `presentation.*.helpLine` strings that currently say "once an inbox is configured".

**Integrations + sync (WIS-19 / WIS-24) — the outbound machinery to reuse**
- `api/app/Services/Integrations/OutboundUrlGuard.php` (interface) and
  `DnsOutboundUrlGuard.php:13-45` — the four checks, in order, with their four
  `integrations.error.*` keys. **Bind and call, never copy.**
- `api/app/Services/Integrations/OutboundHttpClient.php:20-135` — the posture to imitate:
  guard-at-send-time, `allow_redirects => false`, configured timeouts, `withToken`, the
  `X-Wisal-Signature` HMAC at `:91`, the body-size cap at `:57-61`, and the
  never-log-the-message catch at `:44-55`.
- `api/app/Services/Integrations/OutboundResponse.php:142-185` — the retryable/permanent
  classification, including `blocked()`'s "always permanent" and the one documented exception.
- `api/app/Services/Integrations/OutboxDispatcher.php:16-95` — the full retry/backoff/dead-letter
  state machine, including Edge Case 2's `integrations.error.unreachable` carve-out at `:59-66`.
- `api/app/Services/Integrations/IntegrationEvents.php:27-33,48-146` — the enqueue seam, the
  lazy-closure payload, the unique-violation swallow, the inline cap and the
  `DB::afterCommit` + `app()->terminating()` deferral.
- `api/database/migrations/2026_09_09_120200_create_integration_outbox_table.php` — the outbox
  table shape to mirror.
- `api/app/Models/Integration.php:11-59` — the secret rules and the sync casts.
- `api/config/integrations.php` — how a feature's knobs are laid out (nothing throws, nothing
  opens a connection, `config:cache` stays green).
- `api/routes/console.php:29-47` — how WIS-24 registered its two scheduled commands.
- `api/app/Console/Commands/{PullCustomersCommand,FlushOutboxCommand}.php` — the command shape,
  and `AiSmokeCommand.php` / `MailTestCommand.php` for the owner-facing "prove it works" recipe
  shape this story needs three of.

**Tickets, messages and customers — the write targets**
- `api/app/Http/Controllers/TicketController.php:63-118` and
  `api/app/Http/Controllers/Portal/PortalRequestController.php:101-153` — the two programmatic
  ticket-creation paths, including the `SlaClock::applyTo()`-after-`create()` ordering.
- `api/app/Http/Controllers/TicketMessageController.php:42-124` — the agent reply path and the
  only `AUTHOR_AGENT` write; note the transaction boundary, the `ticket_events` `replied` row,
  and the `last_contact_at` advance-only rule at `:100-107`.
- `api/app/Models/TicketMessage.php:16-22,26-28,63-78` — the author-type constants, `$fillable`
  (`channel` is included but "never client-supplied" per `TicketMessageController.php:60`), and
  `scopePublicOnly()`.
- `api/app/Models/Customer.php:31-34,61-79,104-112` — `$fillable`, the `email`/`phone` mutators
  that derive `phone_normalized`, and `phoneMatchCandidates()`.
- `api/database/migrations/2026_08_27_111743_create_customers_table.php:32-35` — the two raw
  partial unique indexes and the cross-engine reason they are raw SQL.
- `api/app/Models/Ticket.php:19` — `Ticket::CATEGORIES`; an ingested ticket needs one of the five.

**Identity, routing and headers**
- `api/routes/api.php:53,192-252,306-345,347-363` — the four existing route groups: staff
  (`auth:sanctum` + `active`), admin (`administrator` on the group, with the `{type}` comment at
  `:222-233`), portal (public + session, with the never-`auth:sanctum` docblock at `:306-314`),
  and the signed public CSAT surface.
- `api/app/Http/Middleware/PortalAuth.php:20-51` — the template for a token-to-row middleware.
- `api/database/migrations/2026_09_02_100100_create_portal_sessions_table.php` — the template for
  a session table (`token_hash` unique, `expires_at`, `revoked_at`, `last_used_at`).
- `api/bootstrap/app.php:22-79` — where named rate limiters are registered (seven today);
  `:81-97` — the global middleware appends and the three aliases.
- `api/app/Http/Middleware/SecurityHeaders.php:15-18` — `X-Frame-Options: DENY` and
  `frame-ancestors 'none'`, global.
- `api/config/cors.php:11-30` — `paths: api/*`, origins from `FRONTEND_URL`,
  `supports_credentials: false`.
- `web/vercel.json` — **no headers, and `/api/(.*)` proxied to the API host.**
- `web/src/App.tsx:56-83` — the unauthenticated top-level routes (`/login`, `/feedback/:uuid`,
  `/portal/*`) a widget route would sit beside; `:143` — `/channels`.
- `web/src/lib/api.ts:30-50` — the one shared axios instance, its absolute `VITE_API_URL` base and
  the `Accept-Language` interceptor.

**Tests and enforcement**
- `api/tests/Pest.php:27-38` (`bindIntegrationTester`), `:46-59` (`bindOutboundUrlGuard`, and the
  DNS reason it exists), `:76-123` (`bindAssistGenerator` and the route-caches-the-controller
  warning), `:130-147` (`bindThrowingMailer`) — where a new fake binder goes and how they are
  written.
- `api/tests/TestCase.php:13-28` — the three process-static counter resets.
- `api/phpunit.xml:23-40` — the two feature-flag `<env>` blocks and their comments; `:71-76` the
  Postgres connection; `:79` `QUEUE_CONNECTION=sync`.
- `api/tests/Feature/ApiContractTest.php:43-50` (the contracted CSP), `:226-235`
  (`IntegrationResource` structure + the secret-missing assertion), `:337-366` (the portal-route
  gate), `:382-405` (the two WIS-23 chat shape locks).
- `api/tests/Feature/Admin/AdminAuthorizationTest.php:35-59` (the four placeholders), `:61-96`
  (the contracted endpoint list), `:126-138` (every admin route carries all three gates).
- `api/tests/Feature/Sync/` (7 files) — the closest existing model for this story's own test
  layout: fake the boundary, opt the feature flag back on, assert state transitions.
- `web/src/i18n/catalogueParity.test.ts`, `web/scripts/check-no-literals.mjs`,
  `web/scripts/i18n-allowlist.json:3-22`.

**Docs to update**
- `README.md:220,231,246,455,817-818` — the five stale claims from Extra note 15.
- `.squad/plans/00-index.md` — row 26 plus a dependency-spine entry; note the file's own warning
  that the Depth column is rewritten by the `index-sync` Stop hook once every Done-Criteria box is
  ticked, so a row reading `full` after this story ships is expected while criteria 1 and 2 remain
  legitimately open.
- `api/.env.example` — the four existing per-story blocks (`# --- Integration data sync (WIS-24)`
  at the tail is the newest) show the comment-block convention to follow.

## Out of scope

- **No Instagram, Messenger, Facebook page messaging, or voice.** Verbatim from the Jira scope.
- **No message attachments, in either direction.** The Jira scope permits *"a single attachment
  per message"*, but there is **no ticket-message attachment table in this repo** — `grep` finds
  only `customer_attachments` (`2026_08_27_111753_create_customer_attachments_table.php`), which
  hangs off a customer and not a message. Media also arrives from WhatsApp as a media id needing a
  second authenticated fetch against Meta's servers. A `ticket_message_attachments` table plus a
  provider media-download path plus a virus/size/type policy is its own story; ingestion records
  that an attachment was present and drops the payload. **Say so on the screen** rather than
  silently losing it.
- **No WebSocket, no push infrastructure, no Reverb, no Pusher, no long-polling loop faster than
  the client's own interval.** The Jira scope offers *"a websocket (or polling) transport"* and
  the repo has already made this choice twice: `api/routes/api.php:285-289` says notification
  delivery *"is POLLING, not WebSocket push — a deliberate decision"*, and there is no queue
  worker to run a broadcaster next to. Polling.
- **No IMAP poll.** The Jira scope offers *"inbound webhook or IMAP poll"*. An IMAP client is a
  new composer dependency, a long-lived connection, credentials with far broader scope than a
  webhook secret, and a second ingestion path with different idempotency semantics. Webhook only.
- **No outbound send of anything but an agent's public reply.** No proactive/marketing sends, no
  template messages, no WhatsApp message-template approval flow, no bulk send. (Note: WhatsApp's
  24-hour customer-service window means a reply outside it *requires* an approved template — that
  is a real product limitation to **document**, not to build around.)
- **No new composer or npm dependency.** Laravel's `Http` client, `hash_hmac`, Eloquent and the
  existing mail stack are sufficient. This has held for WIS-23, WIS-24, WIS-26 and WIS-27.
- **No queue, no worker, no `ShouldQueue`, no change to `QUEUE_CONNECTION`.** Extra note 5.
- **No second SSRF-guarded HTTP path.** Every outbound provider call binds
  `App\Services\Integrations\OutboundUrlGuard` and calls `validate()` at send time. WIS-24's
  `00-overview.md` names this story specifically; a fourth `Http::` site in `api/app` that is not
  guard-fronted is a defect.
- **No secret in any new surface.** Not in a stored error, not in a log line, not in a response,
  not in a webhook echo. `secret_last_four` stays the only derived value that leaves.
- **No changes to `ticket_events` or `audit_logs` semantics.** Ingestion appends existing event
  values; channel *configuration* changes get at most one new `AuditTrail::CHANNEL_*` sibling.
- **No second identity for staff, and no widening of the portal identity.** The widget visitor is
  its own anonymous session and never becomes `$request->user()`, never holds a `portal_sessions`
  token, and never lands under the `api/portal/` prefix. Extra note 6.
- **No seeded channel connection and no seeded ingestion data.** `migrate:fresh --seed` must still
  make zero outbound requests, and `TicketScenarioSeeder`'s existing whatsapp/sms/chat *ticket*
  rows stay exactly as WIS-25 authored them — they are historical data, not evidence of a
  connection.
- **No AI in this story.** Ingested tickets get WIS-23's classification for free because the
  observer is already registered; nothing here changes, extends or configures it.
- **Not WIS-24.** No ERP sync, no field map, no customer pull. The two features share the guard
  and the outbox *shape* and nothing else.
