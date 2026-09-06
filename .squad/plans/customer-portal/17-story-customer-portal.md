# Story 17 — Customer Portal — Self-Service (Story: WIS-16)

> **Mixed-depth plan, and the reason matters.** Every backend task, the access flow, and all
> contracts are **full depth** — verified against the working tree on 2026-09-02. The four
> post-access screens (submit ticket, track requests, view history, FAQs) have their **behaviour,
> API, states and tests fully specified**, but **no design exists for them** — the intake's *Extra
> notes* say so, and so does the Jira description. Their visual specification is the one genuinely
> blocked part of this story; **Decision 3** says exactly how to proceed and what a design pass
> would later change.
>
> **Sequence.** This is **17**, not 16. WIS-17 (`i18n-retrofit`) took 16 in a parallel planning
> session; `naming.globalSequence` is `true`, so the numbers are global and this story follows it.
>
> **Intake provenance.** `.squad/stories/customer-portal/WIS-16/intake.md` was filled manually on
> 2026-09-02 from the live Jira issue. The original scaffold recorded a "404"; `squad doctor`
> reports the real cause is **tracker connectivity HTTP 401** — Jira answers an unauthorised issue
> read with 404. Nothing was missing from the issue; the token was rejected. An earlier revision of
> this plan derived its scope from the requirements doc and the design brief because the intake was
> blank. **This revision supersedes it and follows the tracker.**
>
> **The acceptance criteria are derived, not authored.** The Jira issue carries no AC section and
> its own *"Suggested next step"* says to write them in the intake before planning. The intake's
> nine bullets are marked *"MUST be reviewed before they are treated as final"*. This plan's Done
> Criteria map to them 1:1 and are labelled **AC1–AC9** so the review is mechanical. **Decision 5**
> flags the one AC whose plain reading would change the work substantially.

---

## Prerequisites

- **Story 01 completed** ([`../authentication/01-story-authentication-access-control.md`](../authentication/01-story-authentication-access-control.md))
  — an **anti-dependency**, in the intake's own words. The Sanctum session model and the `users`
  table are for staff. `docs/decisions/ADR-004-authentication.md:7` already reserves this story:
  *"Customer Portal authentication is deferred as a separate external-facing story."*
- **Story 02 completed** ([`../app-shell/02-story-application-shell-navigation.md`](../app-shell/02-story-application-shell-navigation.md))
  — also an **anti-dependency**: the portal is *"external to the internal App Shell (WIS-10), not a
  tab inside it"*. What is reused is `UiPreferencesProvider`'s theme/locale machinery and the route
  tree in `web/src/App.tsx`; what is not reused is `AppLayout`, `RequireAuth`, and `navItems.tsx`.
- **Story 03 completed** ([`../customer-management/03-story-customer-management.md`](../customer-management/03-story-customer-management.md))
  — owns `customers`, `Customer::normalizePhone()`, and `Customer::phoneMatchCandidates()`. The
  portal proves identity against that table and **adds no column to it**.
- **Story 04 completed** ([`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md))
  — WIS-2 in the intake's dependency list: *"ticket creation/read API the portal calls"*. Owns
  `tickets`, `TicketStatus`, `ticket_events`, `Ticket::CATEGORIES`. This story appends **no new
  `ticket_events` value**.
- **Story 05 completed** ([`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md))
  — owns `ticket_messages`. `TicketMessage::AUTHOR_CUSTOMER` and Story 10's `scopePublicOnly()`
  exist **precisely for this surface**; the comment above `TicketMessageController::index`
  (`api/app/Http/Controllers/TicketMessageController.php` lines 29–33) states the rule as a
  requirement on a future customer-facing screen. This is that screen.
- **Story 09 completed** ([`../knowledge-base/09-story-knowledge-base.md`](../knowledge-base/09-story-knowledge-base.md))
  — WIS-5: *"public article read API"*. Owns `kb_articles`, `ArticleStatus`, and the sanitized
  `body_html` write path. Story 09's plan lists *"the public / unauthenticated Customer Portal view
  of the KB"* as out of its scope; it is in scope here, **read-only**.
- **Story 13 completed** ([`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md))
  — WIS-14: the *"existing signed-link feedback pattern to reconcile with"*. That reconciliation is
  **Decision 2**, and the intake makes recording it an acceptance criterion.
- **Story 15 completed** ([`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md))
  — WIS-11: *"portal UI must ship bilingual/RTL from day one like every other screen"*. The i18next
  instance, `useT`, and `npm run i18n:check`.
- **Story 16 / WIS-17 coordination** ([`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md))
  — **read its Task 1 before writing any portal JSX.** That story *widens* what
  `web/scripts/check-no-literals.mjs` can see (three literal shapes it is currently blind to,
  roughly 246 literals' worth). It lists the Customer Portal among the deferred categories it does
  **not** migrate, so `src/features/portal` is this story's responsibility either way:
  - **If WIS-17 lands first**, portal strings must satisfy the **widened** checker, not today's.
  - **If this story lands first**, WIS-17's widening will surface literals in `src/features/portal`
    and that story must fix them there.
  Whoever is second owns the fix. Say which order happened in the PR description.

**Coordination:** this story is the first writer of a non-`users` identity in the codebase. The
`portal_access_codes` and `portal_sessions` contracts below are owned here.

---

## Story Goal

Fill in the *"Customer Portal"* nav item the client's expected navigation has listed since
`docs/requirements/client-requirements-raw.md:110` and which *"has no route today"* — as a
separate public surface, not a tab in the staff shell. A customer proves they own an email address
or phone number already on file, and then self-serves. The five category-8 sub-bullets, verbatim
from the intake's *In scope*, become:

1. **Get in without a staff account.** Identifier entry → 6-digit one-time code → verification →
   a short-lived portal session. **No row is created in or read from `users`.** (AC1)
2. **Submit tickets** — *"a customer creates a new ticket without agent involvement"*. It lands in
   the internal queue as a normal `open` ticket on channel `web_form`, through the same SLA and
   auto-assignment path an agent-created ticket takes. (AC2)
3. **Track requests** — *"status/progress view of the customer's own open tickets"*. (AC3)
4. **View history** — *"the customer's past tickets and resolutions"*. **A separate, separately
   testable surface from (3)**, because the intake states them as two criteria: *open* versus
   *past*. See Frontend Task 6. (AC4)
5. **Never leak.** No internal notes, no agent-only fields, no other customer's data — *"the same
   constraint WIS-14 already established for the CSAT link"*. (AC5)
6. **Access FAQs** — published Knowledge Base articles in a public read view, reachable **before**
   sign-in. (AC6)
7. **Submit feedback** — reconciled with WIS-14 per **Decision 2**. (AC7)
8. **The portal's own chrome** — its minimal public header, never the App Shell. (AC8)
9. **Bilingual and RTL from day one.** (AC9)

**Explicitly out of scope**, verbatim from the intake plus what planning added:

- **AI features (Category 7)** — no chatbot, no suggested replies on the portal.
- **ERP / external integrations (Category 11)** — which is why OTP **delivery** is a seam, not a
  feature. See Decision 4.
- **Multi-branch / multi-department / custom branding (Category 12, partial).**
- **Customer self-registration** — planning addition, and the one to check. See **Decision 5**.
- **Attachments** on portal-submitted tickets. `customer_attachments` is agent-facing (Story 03) and
  its download route sits inside `auth:sanctum`.
- **Customer-side priority selection** — a customer states a category and a subject; priority is the
  support organisation's judgement. Portal submissions take the `tickets.priority` column default.
- **A second CSAT implementation** (Decision 2) and any agent-facing screen at all: this story adds
  **no** route inside `AppLayout`.

---

## Decisions the intake defers to planning

The intake names three decisions explicitly and one criterion requires that a decision be
*"recorded and implemented consistently"*. All four are settled here. Two more that planning
surfaced follow.

### Decision 1 — Identity mechanism: **OTP**, not magic link

The intake: *"needs its own customer identity/auth mechanism (e.g. magic-link or OTP, per the
Design reference above which specs an OTP flow), decided during planning."*

**OTP.** Three reasons, in order of weight:

1. **The design is already built for it.** `docs/design/references/16.WisalPortalAccess-Step2/`
   ships six artboards of a six-digit code entry, with attempt counts and a resend cooldown. A magic
   link would discard the only designed screens this story has.
2. **A magic link needs a mail channel to be usable at all**; an OTP degrades gracefully to
   *"read the code out over the phone"* while Category 11 is deferred.
3. **It works for a phone identifier**, which a link in an email cannot.

Consequence recorded: OTP means a **verification state machine** (attempts, cooldown, expiry,
single-use) that a magic link would fold into a signed URL. That machine is
`App\Services\PortalAccess` (Backend Task 4), and it is the largest single piece of new backend
logic in this story.

### Decision 2 — CSAT: the portal **coexists with** WIS-14's link; it does not supersede it

The intake: *"CSAT already covers this narrowly via WIS-14's signed, expiring, single-purpose link
with no login; decide during planning whether the Portal supersedes or coexists with that flow."*
AC7 requires the decision be recorded and implemented consistently.

**Coexist.** The portal **surfaces** the existing signed link and builds no survey UI:

- **Superseding would break the delivery path that exists.** WIS-14's link is designed to be pasted
  into a reply and answered with **no login**. Requiring a portal session to rate a ticket would
  lose every customer who does not sign in — which, with Category 11 deferred, is most of them.
- **Superseding would fork the data.** Story 13 owns `csat_surveys`, `resolution_cycle`, and the
  Reports aggregate that reads it (`api/tests/Feature/Csat/CsatReportsAggregateTest.php`,
  `api/tests/Feature/ReportCsatContractTest.php`). A second submission path against the same table
  means two writers for one unique `(ticket_id, resolution_cycle)` row.
- **Coexisting costs one nullable field.** `PortalTicketResource.feedback_url` carries Story 13's
  signed link when the newest survey is `outstanding`, and the portal renders a link to
  `/feedback/{uuid}`. The customer lands on the page Story 13 already built and tested.

Implementation consequence: the link must be minted from **one** place, so Backend Task 8 extracts
`CsatSurveyController::shareUrl()` into `App\Services\CsatShareLink`. That is the only edit this
story makes to another story's file.

### Decision 3 — The four undesigned screens ship on the design system, and say so

The intake's *Extra notes*: *"⚠️ Design coverage is partial. The two reference folders cover the
access flow only … the later portal screens — submit ticket, track requests, view history, FAQs —
have no design yet."*

Planning will **not** invent artboards, and will **not** block the story. Instead:

- The **access flow** (Frontend Tasks 4–5) is built from the eleven real artboards, artboard by
  artboard, at full fidelity.
- The **four later screens** (Frontend Task 6) are specified by **behaviour, data, states, and
  tests** — which is everything except the visual composition — and built from three things that
  already exist: the portal header the access screens establish (which the design brief requires be
  reusable), `docs/design/brief.md`'s tokens and four-state rule, and the nearest built precedent
  per screen (`docs/design/references/6.Knowledge/` for the FAQ reader,
  `docs/design/references/4.Data Table/` for the request lists,
  `docs/design/references/5.Modals/` for the submit form).
- **What a later design pass may change, and what it may not.** Layout, spacing, and composition are
  open. The API shapes, the URL scheme, the four async states, and the open/past split (AC3 vs AC4)
  are **fixed by this plan** — a design pass must fit them, because the tests assert them.

Flag it in the PR: these four screens are *"design-system-derived, pending a design pass"*.

### Decision 4 — OTP delivery is a seam, because Category 11 is out of scope

The intake puts *"ERP/external integrations (Category 11)"* out of scope, and `MAIL_MAILER` is
`log` in `api/.env.example:51`. So the code is delivered through an
`App\Services\PortalCodeNotifier` **interface** with one mail implementation: in dev the code lands
in `api/storage/logs/laravel.log`; in production a real mailer driver picks it up with no code
change.

**Known gap, carried deliberately and honestly:** a customer with a phone number but **no email**
on their row never receives a code. `customers.email` is nullable
(`api/database/migrations/2026_08_27_111743_create_customers_table.php` line 17), so this is
reachable. The notifier logs a warning and returns; the API's 202 is unchanged, because changing it
would leak which identifiers are deliverable. **Do not fabricate an SMS path.** Recorded in
ADR-005 and in *Edge Cases*.

### Decision 5 — "A customer with no account" means no **staff** account; self-registration is out

**This is the one AC whose plain reading would change the work substantially, so read it before
approving the plan.**

AC1 as written: *"Given a customer with **no account**, when they enter their identifier on the
portal access screen and verify the OTP, then they are signed in to the portal WITHOUT any row being
created in or read from the internal `users` table."*

Two readings:

- **(a) No *staff* account** — the person exists as a `customers` row (an agent created it when they
  first made contact) but has no `users` row and no password. The portal proves they control the
  identifier on that row.
- **(b) No record at all** — an unknown member of the public arrives, and the portal creates their
  customer record.

**This plan implements (a).** The evidence:

1. **The clause the criterion actually tests** is the *"WITHOUT any row being created in or read
   from the internal `users` table"* half — the constraint it inherits from the intake's
   *"Must NOT reuse the internal `users` table / Sanctum session model"*. That is about `users`, not
   about `customers`.
2. **The built design settles it.** The Step-1 error copy in the design brief is
   *"If this matches a record, we've sent a code"* — an OTP sent to an identifier **already on
   file**. Reading (b) has nothing to match against and no address to send to.
3. **Reading (b) is a different story.** Public writes to `customers` add a spam/abuse surface, a
   duplicate-merge problem against Story 03's partial unique indexes, and a moderation question —
   none of which the intake mentions, and all of which the four-line *Out of scope* list would have.

**If (b) is what the client meant**, the delta is bounded and worth quoting: a
`POST /api/portal/access/register` endpoint, public `customers` row creation with a
`source = 'portal'` marker, a CAPTCHA or equivalent, a duplicate-resolution rule against
`customers_email_unique` / `customers_phone_normalized_unique`, and an agent-facing review queue for
unverified records. That is its own story. **Confirm the reading before implementing.**

### Decision 6 — the nav entry is the portal's URL, not a sidebar row

The intake: the nav entry *"already exists in the client's expected nav list
(`client-requirements-raw.md` line 110) but has no route today — this story is what fills it in,
external to the internal App Shell (WIS-10), not a tab inside it."*

So: **no entry in `web/src/app/navigation/navItems.tsx`.** Adding one would put a customer-facing
link in the staff sidebar, contradicting *"not a tab inside it"*, and
`web/src/app/navigation/navRoutes.test.tsx` asserts the manifest matches the shell's routes. The
requirement is satisfied by `/portal` existing and being reachable without a staff session. Verified
in Verification Step 10.

---

## Context — Read These Files First

1. `.squad/stories/customer-portal/WIS-16/intake.md` — the whole file. The **Description**'s *In
   scope* list is the scope; the **Acceptance criteria** block is what Done Criteria map to; the
   **Extra notes** carry the design-coverage warning Decision 3 answers, and the note that the Jira
   text's *"(+ Dark/RTL variants once generated)"* caveat is **stale** — all four variants exist.
2. `docs/requirements/client-requirements-raw.md` — **§8** (lines 71–76), the five sub-bullets; and
   **line 110**, the client's expected nav list that names *"Customer Portal"*. The *"Conflict with
   prior work"* table (lines 108–113) records the portal as *"a third audience … a materially
   different security surface"* — that is why the identity below is its own table.
3. `docs/design/references/15.WisalPortalAccess-Step1/` — **built, all four variants**. Five
   artboards each, addressable by `data-screen-label`: `Step1 Idle`, `Step1 Submitting`,
   `Step1 Error Format`, `Step1 Error Generic`, `Step1 Mobile Idle`. Read
   `WisalPortalAccess-Step1-LightLTR.dc.html` lines 28–56 for the header, card, and form markup.
   **These exports use inline `style=` attributes, not utility classes** — the only real classes are
   `wisal-input`, `wisal-btn`, `wisal-link`, `wisal-toggle` (`.wisal-otp` in Step 2), defined in the
   `<helmet><style>` block at lines 14–20 solely to carry `:focus-visible`. Port the inline styles
   into a feature stylesheet; do not copy `style=` attributes into JSX.
4. `docs/design/references/16.WisalPortalAccess-Step2/` — six artboards: `Step2 Idle`,
   `Step2 Submitting`, `Step2 Error Wrong`, `Step2 Error Expired`, `Step2 Resend Available`,
   `Step2 Mobile Idle`. In `WisalPortalAccess-Step2-LightLTR.dc.html`: lines 44–49 — the OTP field
   is **six real `<input>` elements** with `inputmode="numeric" pattern="[0-9]*" maxlength="1"` and
   an `aria-label="Digit N"` each, not styled `<div>`s; line 132 fixes
   *"Incorrect code. 2 attempts remaining."* (attempts **are** surfaced); line 163
   *"This code has expired. Request a new one to continue."*; line 54 the cooldown
   *"Resend in 0:47"*; line 38 the masked echo *"Code sent to j•••@example.com"*.
5. `docs/requirements/required-for-System-ERP/ستوري-تيلينج/design-prompts/09-customer-portal-login.md`
   — the design brief behind those exports, and the source of the copy the tests assert. Binding
   parts: **§"The single most important structural rule"** (the portal's own reusable minimal
   header, no App Shell chrome — AC8), **§"Required states"**, and **§"Guardrails"**. Its state-3
   rule is a hard requirement: *"do not confirm/deny account existence"*, copy kept generic as
   *"If this matches a record, we've sent a code"*.
6. `docs/design/brief.md` — `## Required states per view` (lines 181–187, the four-state rule) and
   `## Accessibility` (lines 189–197): `outline: none` without a replacement is **forbidden**;
   colour is never the only signal. **Grep every `class="…"` in the eight exports against their
   `<style>` block before porting** — `STATUS.md` records the recurring export defect where
   `fv`/`fvd`/`sk` are referenced and never defined.
7. `api/routes/api.php` — lines 33–35 (`/login` with `throttle:login`, the only pre-existing route
   outside the authenticated group); lines 41–46 (the `['auth:sanctum', 'active']` group, and why
   `active` sits on the group); lines 220–234 — **the CSAT public block is the precedent for this
   story's public surface**, including the comment that route names are the signing key.
8. `api/bootstrap/app.php` — lines 22–31, the two existing named limiters (`login`, `csat`) and the
   keying style; lines 33–46, the global `SecurityHeaders` + `SetLocale` append and the `alias()`
   map this story extends; lines 48–66, the pattern of rendering a security exception as a calm JSON
   body rather than a stack trace.
9. `api/app/Models/Customer.php` — lines 42–47 (`setEmailAttribute`: stored lower-cased, `''` becomes
   `null`), lines 54–76 (`setPhoneAttribute` / `normalizePhone`), lines 78–96
   (`phoneMatchCandidates()` — *"every stored form of the same subscriber number"*). Identifier
   lookup **must** delegate to these.
10. `api/database/migrations/2026_08_27_111743_create_customers_table.php` lines 14–35 — `email` and
    `phone_normalized` are **nullable** with *partial* unique indexes
    (`WHERE … IS NOT NULL AND deleted_at IS NULL`), and the table uses `SoftDeletes`. A soft-deleted
    customer must not be able to sign in. Line 22 documents `last_contact_at` as *"written by the
    Conversation Thread story"* — a portal reply is that signal.
11. `api/app/Models/TicketMessage.php` — the `AUTHOR_CUSTOMER` / `AUTHOR_AGENT` / `AUTHOR_SYSTEM`
    constants, and `scopePublicOnly()` at the bottom. Its docblock calls itself *"THE enforcement
    point"* for the public/internal split and requires the filter **in the query, never in the view
    layer**. This is the mechanism AC5 is satisfied by.
12. `api/app/Http/Controllers/TicketMessageController.php` — lines 25–41: the agent index is
    deliberately **not** `publicOnly()`-scoped, and the comment forbids reusing it for a
    customer-facing surface. Lines 43–77: the insert transaction, the
    `'channel' => $ticket->channel,  // never client-supplied` rule (line 62), the
    `$ticket->touch()` last-activity bump (line 67), the `replied` `ticket_events` row (lines 69–77).
13. `api/app/Http/Controllers/TicketController.php` lines 63–108 — the create path AC2 must match:
    `created_by`, forced `TicketStatus::Open`, `TicketAssigner::pick()`, then
    **`SlaClock::applyTo($ticket)` after `create()` because the anchor is `created_at`**
    (lines 93–96), then the first `ticket_messages` row from `description` (lines 106–108).
14. `api/app/Http/Requests/StoreTicketRequest.php` — the agent-facing rules. The portal gets its
    **own** FormRequest: `customer_id` comes from the session, never the body, and `priority` /
    `assigned_to` / `channel` are not accepted at all.
15. `api/app/Enums/Channel.php` — `Channel::WebForm = 'web_form'` already exists and is already in
    `Channel::options()`, so Story 14's Channels Overview counts portal tickets with no change.
    `api/app/Enums/TicketStatus.php` — `allowedTransitions()`: `Resolved → Open` is legal, which is
    the reopen-on-reply rule; `isClosed()` is the AC4 open/past boundary.
16. `api/app/Http/Controllers/Kb/KbArticleController.php` lines 108–131 — the article read for AC6,
    including the base-builder `increment('view_count')` at line 128 that deliberately does not move
    `updated_at`. Reuse that reasoning verbatim.
17. `api/app/Http/Controllers/CsatSurveyController.php` lines 31–41 (`invalidBody()` — one identical
    body for every failure), lines 66–79 (the `whereNull(...)`-guarded double-submit update), lines
    106–124 (`shareUrl()`, currently `private`) — Backend Task 8 extracts that method per Decision 2.
    `api/app/Models/CsatSurvey.php` lines 64–75 — the derived `state` accessor, the precedent for the
    predicates in Backend Task 2.
18. `api/app/Http/Middleware/SetLocale.php` and `api/app/Http/Middleware/SecurityHeaders.php` — both
    appended globally, so portal responses inherit them. `SetLocale` reads `Accept-Language`; the
    portal client must send it, because there is no server-side customer locale field (AC9).
19. `web/src/App.tsx` — lines 41–47: `/login` and the public `/feedback/:uuid` route sit outside the
    `RequireAuth` layout route (lines 49–55); line 167 is the `*` catch-all that redirects to
    `/dashboard`. Every portal route must be declared **before** line 167. Lines 77–79 record the
    "declare the literal segment before the dynamic one" hazard this story hits again.
20. `web/src/lib/api.ts` lines 30–55 — the staff Axios instance: module-scoped bearer token, the
    `Accept-Language` interceptor (lines 42–54), the 401 → sign-out hook. **Do not reuse it.**
    `web/src/features/csat/api/csatPublicClient.ts` lines 11–14 is the sanctioned separate-client
    pattern and states why.
21. `web/src/features/csat/` — the full precedent for a public page: `pages/CsatResponsePage.tsx`
    (state → artboard mapping, the `<html lang>/<dir>` effect at lines 46–58, the `dir="auto"`
    free-text render at line 154), `csat.css`, `model/csatStrings.ts`. **Read that module's header
    comment (lines 1–8)**: *"there is no signed-in user and no customer locale field anywhere in the
    MVP, so the page cannot fall back to a per-user server preference. Detection + an explicit
    on-page toggle is the whole contract."* AC9 is satisfied that way, but through the shared
    catalogue — not a second string module.
22. `web/src/app/providers/UiPreferencesContext.tsx` — lines 97–107 (`setTheme`/`toggleTheme`:
    `localStorage` only, no server call → safe for the portal) versus lines 116–132 (`setLocale`
    **PATCHes `/user/preferences`** → unusable from the portal) and lines 133–145
    (`syncLocaleFromServer`: state + i18next + persist, **no** PATCH). Frontend Task 3 exposes that
    local-only path under an honest name. Lines 29–35 are the `try/catch` storage pattern to copy.
23. `web/src/i18n/instance.ts` lines 36–51 (`NAMESPACES`) and 53–86 (`resources`) — both extended by
    hand. Lines 88–92 explain why plurals get real Arabic CLDR categories, which the
    *"{{count}} attempts remaining"* string needs. `web/scripts/i18n-allowlist.json` — `roots` is
    what `npm run i18n:check` enforces.
24. [`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md) —
    **Task 1 and Decision 1**. It widens the literal checker; see *Prerequisites* for who owns the
    fallout in `src/features/portal`.

---

## Shared contracts this story establishes

Owned here. A later portal story extends these; it does not redefine them.

### Table `portal_access_codes` — one row per OTP issue

| Column | Type | Notes |
|---|---|---|
| `id` | bigIncrements | |
| `customer_id` | foreignId → `customers`, cascade on delete | **Not nullable.** A row exists only when the identifier matched a live customer; an unmatched request writes nothing (AC1 + the no-enumeration rule). |
| `identifier` | string(191) | the **normalised** value matched on — a lower-cased email or a `Customer::normalizePhone()` result. Used for rate keying and the newest-code lookup; never returned raw. |
| `code_hash` | string | `Hash::make()` of the 6 digits. **The plaintext code is never stored.** |
| `attempts` | unsignedTinyInteger, default `0` | incremented on every failed verify |
| `expires_at` | timestamp | issue + **10 minutes** |
| `consumed_at` | timestamp, nullable | set once — on the verify that succeeds, or when superseded by a newer code |
| `request_ip` | string(45), nullable | IPv6-safe width; diagnostics only |
| `created_at` / `updated_at` | timestamps | |

Index `(customer_id, created_at)` and index `(identifier, created_at)` — the two lookup paths
(newest outstanding code for a customer; resend cooldown for an identifier).

**`MAX_ATTEMPTS = 5`** and **`RESEND_COOLDOWN_SECONDS = 60`** are `public const` on
`App\Services\PortalAccess`. The cooldown is what the design's *"Resend in 0:47"* counter counts
down from, so the API returns it rather than the SPA hard-coding it.

### Table `portal_sessions` — one row per signed-in portal browser

| Column | Type | Notes |
|---|---|---|
| `id` | bigIncrements | |
| `customer_id` | foreignId → `customers`, cascade on delete | |
| `token_hash` | string, **unique** | `hash('sha256', $plaintext)`. The plaintext is returned **once**, at verify. |
| `expires_at` | timestamp | verify + **24 hours**, non-sliding |
| `last_used_at` | timestamp, nullable | bumped by the middleware; diagnostics + a future idle policy |
| `revoked_at` | timestamp, nullable | set by portal logout |
| `user_agent` | string(255), nullable | |
| `created_at` / `updated_at` | timestamps | |

**Why a table and not Sanctum — this is what AC1 is really asking for.** `personal_access_tokens`
is polymorphic and would happily hold a `Customer`, but `auth:sanctum` resolving to a non-`User`
would put a customer inside every `$request->user()` call in the app — including `ActiveUserOnly`,
`EnsureAdministrator`, and every policy, none of which is written for it. A separate table with its
own middleware makes a portal token **structurally incapable** of authenticating a staff route,
which is the property the intake's *"Must NOT reuse the internal `users` table / Sanctum session
model"* asks for. **Do not** add `HasApiTokens` to `Customer`.

### Middleware alias `portal` → `App\Http\Middleware\PortalAuth`

Registered in `api/bootstrap/app.php`'s existing `alias()` map (lines 43–46). It resolves the bearer
token to a live `portal_sessions` row and binds the customer explicitly:
`$request->attributes->set('portal_customer', $customer)`. **It never calls `Auth::login()` and
never sets a user resolver** — nothing in the `web`/`sanctum` guard learns a customer exists.

A missing, unknown, revoked, or expired token → **401** with `{"message": …}` and nothing else.

### Routes — `/api/portal/*`, names `portal.*`

```php
// Public: no session. IP-keyed limiter, separate from `login` and `csat`.
Route::prefix('portal')->middleware('throttle:portal-access')->group(function () {
    Route::post('/access/request', [PortalAccessController::class, 'request'])->name('portal.access.request');
    Route::post('/access/verify',  [PortalAccessController::class, 'verify'])->name('portal.access.verify');
    // AC6: FAQs are public content (§8) — readable BEFORE sign-in, by design.
    Route::get('/faq',        [PortalFaqController::class, 'index'])->name('portal.faq.index');
    Route::get('/faq/{slug}', [PortalFaqController::class, 'show'])->name('portal.faq.show');
});

// Portal-authenticated. `portal` is the ONLY gate; no `auth:sanctum`, no `active`.
Route::prefix('portal')->middleware(['portal', 'throttle:portal'])->group(function () {
    Route::get('/me',      [PortalSessionController::class, 'show'])->name('portal.me');
    Route::post('/logout', [PortalSessionController::class, 'destroy'])->name('portal.logout');
    Route::get('/requests',                    [PortalRequestController::class, 'index'])->name('portal.requests.index');
    Route::post('/requests',                   [PortalRequestController::class, 'store'])->name('portal.requests.store');
    Route::get('/requests/{ticket}',           [PortalRequestController::class, 'show'])->name('portal.requests.show');
    Route::post('/requests/{ticket}/messages', [PortalRequestController::class, 'reply'])->name('portal.requests.reply');
});
```

`GET /api/portal/requests` takes **`?scope=open|past`**, defaulting to `open` — the one endpoint
behind AC3 and AC4. `open` is `whereNotIn('status', [Resolved, Closed])`; `past` is
`whereIn('status', [Resolved, Closed])` ordered by `resolved_at` desc, falling back to `updated_at`.
**Two scopes, one endpoint** — a second endpoint for the same projection is how the two drift, the
same reasoning `api/routes/api.php` lines 64–68 records for `/sla-rules/meta`.

Both groups are declared **after** the `auth:sanctum` group and **before** the CSAT block, so
`api.php` reads: staff · portal · CSAT. `/faq/{slug}` is declared after the literal `/faq`, the
ordering hazard `api/routes/api.php` calls out at lines 47–48 and 177–179.

Two named limiters added to the `then:` closure in `api/bootstrap/app.php`, **after** the `csat` one
at line 30 (the file is ordered by story): **`portal-access`** — `Limit::perMinute(5)` keyed on
`sha1(normalised identifier).'|'.$request->ip()` **plus** `Limit::perMinute(20)` keyed on IP,
mirroring the two-tier `login` limiter at lines 22–25; and **`portal`** — `Limit::perMinute(60)`
keyed on the portal token hash, falling back to IP when absent.

### Response shapes

`POST /api/portal/access/request` — **always 202**, always this body, matched or not:

```json
{ "sent": true, "masked_identifier": "j•••@example.com", "resend_after_seconds": 60 }
```

`masked_identifier` is derived from **the value the caller typed**, never from a database row, so it
leaks nothing.

`POST /api/portal/access/verify` — 200 on success:

```json
{ "token": "<plaintext, shown once>", "expires_at": "…", "customer": { "id": 1, "name": "…", "masked_identifier": "…" } }
```

422 on a wrong code, with `{"message": …, "attempts_remaining": 2}`; **410** on an expired,
consumed, or attempt-exhausted code, with `{"message": …, "attempts_remaining": 0}`. The SPA maps
422 → *Step2 Error Wrong* and 410 → *Step2 Error Expired*.

**`PortalTicketResource`** — the customer-visible projection, and the structural half of AC5. Frozen
keys: `id`, `subject`, `status`, `status_label`, `category`, `category_label`, `channel`,
`channel_label`, `created_at`, `last_activity_at` (`tickets.updated_at`), `resolved_at`,
`closed_at`, `message_count`, `feedback_url` (nullable). **No `sla` block, no `assigned_to`, no
`priority`, no `created_by`, and no internal ids other than the ticket's own.** `*_label` values
come from the existing enum `label()` methods, so they localise server-side through
`api/lang/{en,ar}/enums.php` — the cross-cutting rule in `.squad/plans/00-index.md`. `resolved_at`
and `closed_at` are present because AC4's history view shows *"past tickets **and resolutions**"*.

**`PortalMessageResource`** — `id`, `author_type`, `author_name`, `body`, `created_at`.
`author_name` is the agent's `users.name` for an agent message, the customer's own name for
`customer`, `null` for `system`. **No `user_id`, no `visibility`** — a customer never sees the field
whose other value they are forbidden to read — and no `channel`.

**`feedback_url`** is present only when the ticket's newest `csat_surveys` row is `outstanding`; it
is Story 13's signed link, minted through the service extracted in Backend Task 8 (Decision 2).

### SPA routes and i18n

`/portal` (access), `/portal/requests`, `/portal/requests/new`, `/portal/requests/:ticketId`,
`/portal/history`, `/portal/faq`, `/portal/faq/:slug` — all **outside** `RequireAuth`/`AppLayout`
(AC8) and all declared before `web/src/App.tsx`'s `*` catch-all. New i18next namespace **`portal`**,
added to `NAMESPACES` and both halves of `resources` in `web/src/i18n/instance.ts`, with
`web/src/i18n/locales/{en,ar}/portal.json`. `src/features/portal` is added to
`web/scripts/i18n-allowlist.json`'s `roots` (AC9).

---

## Backend Tasks

### 1 — Migrations

**Create file:** `api/database/migrations/2026_09_02_100000_create_portal_access_codes_table.php`
**Create file:** `api/database/migrations/2026_09_02_100100_create_portal_sessions_table.php`

Exactly the two tables in *Shared contracts*. Follow
`api/database/migrations/2026_08_28_160000_create_csat_surveys_table.php` for style.

- Both foreign keys `->constrained('customers')->cascadeOnDelete()`. A customer hard-deleted takes
  their codes and sessions with them; a **soft**-deleted customer keeps rows, which is why
  `PortalAccess` relies on the `Customer` default (non-trashed) scope rather than the FK.
- `token_hash` is `->unique()`. `identifier` is **not** unique — a customer holds many historical
  code rows.
- No `CHECK` constraint; `attempts` is bounded in PHP by `PortalAccess::MAX_ATTEMPTS`.
  **All SQL must be valid on PostgreSQL and SQLite** — plain `Schema::create` with no raw
  expressions satisfies that, so do not add any.
- Use `->string('request_ip', 45)` and `->string('user_agent', 255)`; an untruncated `User-Agent`
  header overflows a default `string` on some drivers.

### 2 — Models

**Create file:** `api/app/Models/PortalAccessCode.php`

`$fillable` = `['customer_id', 'identifier', 'code_hash', 'attempts', 'expires_at', 'consumed_at', 'request_ip']`.
Casts: `expires_at`, `consumed_at` → `datetime`; `attempts` → `integer`. `customer()` `BelongsTo`.

Derived predicates, following the `CsatSurvey::getStateAttribute()` precedent
(`api/app/Models/CsatSurvey.php` lines 64–75) — **derived, never stored**:

```php
public function isConsumed(): bool;   // consumed_at !== null
public function isExpired(): bool;    // expires_at->isPast()
public function isExhausted(): bool;  // attempts >= PortalAccess::MAX_ATTEMPTS
public function isUsable(): bool;     // ! consumed && ! expired && ! exhausted
```

**Create file:** `api/app/Models/PortalSession.php`

`$fillable` = `['customer_id', 'token_hash', 'expires_at', 'last_used_at', 'revoked_at', 'user_agent']`.
Casts: the three timestamps → `datetime`. `customer()` `BelongsTo`.
`public function isLive(): bool` — `revoked_at === null && expires_at->isFuture()`.
`$hidden = ['token_hash']` so no accidental serialisation ships it.
`public static function hashToken(string $plaintext): string` → `hash('sha256', $plaintext)`.
**One** hashing site, called by both the issue and the lookup path.

**Do not** add relations for these to `App\Models\Customer` — the portal never needs
`$customer->portalSessions`, and adding it invites an agent-facing screen to grow one.

### 3 — Factories

**Create file:** `api/database/factories/PortalAccessCodeFactory.php`
**Create file:** `api/database/factories/PortalSessionFactory.php`

Match `api/database/factories/CsatSurveyFactory.php`'s shape. Give each state helpers the tests read
as prose: `expired()`, `consumed()`, `exhausted()` on the code factory; `expired()`, `revoked()` on
the session factory. The code factory must accept a plaintext so a test can hash a known value:
`withCode(string $code)` setting `code_hash => Hash::make($code)`.

### 4 — `App\Services\PortalAccess` (Decision 1's state machine)

**Create file:** `api/app/Services/PortalAccess.php`

```php
final class PortalAccess
{
    public const MAX_ATTEMPTS = 5;
    public const RESEND_COOLDOWN_SECONDS = 60;
    public const CODE_TTL_MINUTES = 10;
    public const SESSION_TTL_HOURS = 24;

    public function __construct(private PortalCodeNotifier $notifier) {}

    /** Normalises, resolves a live customer, issues + delivers a code. Silent when nothing matches. */
    public function requestCode(string $identifier, ?string $ip): void;

    /** @return PortalSession|null  null = wrong code (caller reports attempts_remaining) */
    public function verify(string $identifier, string $code, ?string $userAgent): ?PortalSession;

    public static function normalize(string $identifier): ?string;
    public static function isEmail(string $identifier): bool;
    public static function mask(string $identifier): string;
    public function attemptsRemaining(string $identifier): int;
    public function cooldownRemaining(string $identifier): int;
}
```

`normalize()` — when the raw value contains `@`, `Str::lower(trim($v))`; otherwise
`Customer::normalizePhone($v)`. Returns `null` when neither yields a value. **Both branches
delegate; neither re-implements** — `api/app/Models/Customer.php` lines 42–76 owns that logic.

Customer resolution — one query, both stored phone forms:

```php
$customer = Customer::query()
    ->when(self::isEmail($normalized),
        fn ($q) => $q->where('email', $normalized),
        fn ($q) => $q->whereIn('phone_normalized', Customer::phoneMatchCandidates($normalized)))
    ->first();
```

`Customer` uses `SoftDeletes`, so the default scope already excludes trashed rows — **do not add
`withTrashed()`**. `phoneMatchCandidates()` exists because `phone_normalized` keeps a leading `+`
(`api/app/Models/Customer.php` lines 78–96); matching the bare column would miss half the rows.
**Per Decision 5, no branch of this method creates a `customers` row.**

`requestCode()`:

1. `normalize()`; on `null`, **return** (the controller has already 422'd on format — belt and
   braces).
2. Resolve the customer; on `null`, **return without writing a row**. The controller's 202 is
   identical either way.
3. Cooldown: if a `portal_access_codes` row for this `identifier` was created inside
   `RESEND_COOLDOWN_SECONDS`, **return** without issuing. Never an error — a second tap on a
   just-tapped button must not look like a failure.
4. Supersede every prior usable row for the customer: `update(['consumed_at' => now()])` over
   `whereNull('consumed_at')`. **Exactly one code is live per customer at a time.**
5. `$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);` — `random_int`, **not**
   `rand`/`mt_rand`.
6. Insert the row with `Hash::make($code)`.
7. `$this->notifier->send($customer, $code, $normalized);`

Steps 4–6 run inside `DB::transaction()`; step 7 runs **after** it commits, so a delivery failure
cannot roll back an issued code and leave the customer holding one the database has never seen.

`verify()`:

1. `normalize()`; `null` → `null`.
2. Newest row for the identifier, `orderByDesc('id')->first()`. Missing → `null`.
3. `! $row->isUsable()` → throw `App\Exceptions\PortalCodeUnusableException` (renders **410**).
4. Compare with `Hash::check($code, $row->code_hash)`. **`Hash::check`, never `===`** — it is
   constant-time and the stored value is a hash.
5. Wrong: `$row->increment('attempts')`, return `null`.
6. Right, inside `DB::transaction()`: a conditional `update` guarded by `whereNull('consumed_at')`
   — the same double-submit guard `CsatSurveyController::store` uses
   (`api/app/Http/Controllers/CsatSurveyController.php` lines 66–79). Zero rows affected means a
   concurrent verify won; throw `PortalCodeUnusableException`. Then create the `portal_sessions` row
   from a `Str::random(64)` plaintext, `PortalSession::hashToken()`ed, and stash the plaintext on
   the returned model with `setAttribute('plaintext_token', $plain)` — the only place it exists.

### 5 — `App\Services\PortalCodeNotifier` (Decision 4's seam)

**Create file:** `api/app/Services/PortalCodeNotifier.php` — an interface:
`send(Customer $customer, string $code, string $identifier): void`.
**Create file:** `api/app/Services/MailPortalCodeNotifier.php` — the shipped implementation.
**Create file:** `api/app/Mail/PortalAccessCodeMail.php` + `api/resources/views/mail/portal-access-code.blade.php`.

Bind the interface to the implementation in `api/app/Providers/AppServiceProvider.php`'s
`register()`, beside the existing `ArticleSearch` bind (lines 35–39) — a plain `bind`, not a
conditional, so no connection opens while the container boots.

`MailPortalCodeNotifier::send()` sends to `$customer->email`. When `email` is `null`, it **logs a
warning and returns** — the known gap Decision 4 records. **Do not fabricate an SMS path.**
`MAIL_MAILER` is `log` in `api/.env.example:51`; `api/phpunit.xml` sets it to `array`, so
`Mail::fake()` works.

The mail body renders in the customer's locale (AC9): `SetLocale` has already run from the request's
`Accept-Language`, so the Blade view uses `__()` keys added to `api/lang/{en,ar}/portal.php`
(**create both**). Wrap the code itself in `<span dir="ltr">` — six Latin digits inside an Arabic
RTL paragraph reorder visually otherwise.

### 6 — `App\Http\Middleware\PortalAuth` + registration

**Create file:** `api/app/Http/Middleware/PortalAuth.php`

1. `$plain = $request->bearerToken();` — null → 401.
2. `PortalSession::with('customer')->where('token_hash', PortalSession::hashToken($plain))->first()`
   — null → 401. **Look up by hash; never scan and compare.**
3. `! $session->isLive()` or `$session->customer === null` → 401.
4. `$session->forceFill(['last_used_at' => now()])->saveQuietly();` — `saveQuietly` so the bump
   never fires model events.
5. `$request->attributes->set('portal_session', $session);` and
   `$request->attributes->set('portal_customer', $session->customer);`

Every 401 returns the **same** body — `{"message": __('portal.session_invalid')}` — so an expired
session is indistinguishable from a forged token.

**File:** `api/bootstrap/app.php` — add `'portal' => PortalAuth::class` to the `alias()` map at
lines 43–46, and the two limiters from *Shared contracts* to the `then:` closure at lines 22–31.

**Create file:** `api/app/Http/PortalRequest.php` — a small final helper with
`public static function customer(Request $r): Customer` and `session(Request $r): PortalSession`,
each `abort(401)`-ing if the attribute is absent. Controllers call it instead of reaching into
`$request->attributes` directly; that keeps the "portal identity" concept in one file.

### 7 — Controllers, requests, resources

**Create file:** `api/app/Http/Controllers/Portal/PortalAccessController.php`

- `request(PortalAccessRequest $request)` → `$this->access->requestCode(...)`, then **always**
  `response()->json([...], 202)` with the fixed body. `masked_identifier` comes from
  `PortalAccess::mask($request->validated('identifier'))` — **the typed value**.
- `verify(PortalVerifyRequest $request)` → on a `PortalSession`, 200 with the plaintext token; on
  `null`, 422 with `attempts_remaining`; on `PortalCodeUnusableException`, 410 with
  `attempts_remaining: 0`.

**Create file:** `api/app/Exceptions/PortalCodeUnusableException.php` — extends `\RuntimeException`
with a `render()` returning the 410 body, following the JSON-first convention
`api/bootstrap/app.php` lines 49–51 establishes.

**Create file:** `api/app/Http/Requests/PortalAccessRequest.php`
`authorize(): true` (the route is public). Rules: `identifier` → `['required', 'string', 'max:191']`
plus a closure rejecting a value whose `PortalAccess::normalize()` is `null`. The design's
*Step1 Error Format* artboard renders this as an **inline field error**; *Step1 Error Generic* is the
202 path and is **not** an error response at all.

**Create file:** `api/app/Http/Requests/PortalVerifyRequest.php`
`identifier` as above; `code` → `['required', 'string', 'size:6', 'regex:/^\d{6}$/']`.

**Create file:** `api/app/Http/Controllers/Portal/PortalSessionController.php`
`show()` → the customer projection (`id`, `name`, masked identifier, `expires_at`).
`destroy()` → `revoked_at = now()` on the current session, **204**.

**Create file:** `api/app/Http/Controllers/Portal/PortalRequestController.php`

`index(Request $request)` — the AC3/AC4 endpoint:

```php
$scope = $request->string('scope')->value() === 'past' ? 'past' : 'open';
$closed = [TicketStatus::Resolved->value, TicketStatus::Closed->value];

Ticket::query()
    ->where('customer_id', PortalRequest::customer($request)->id)
    ->when($scope === 'open',
        fn ($q) => $q->whereNotIn('status', $closed)->orderByDesc('updated_at'),
        fn ($q) => $q->whereIn('status', $closed)->orderByDesc('resolved_at')->orderByDesc('updated_at'))
    ->withCount(['messages' => fn ($q) => $q->publicOnly()])
    ->paginate(20);
```

**Never** `Ticket::visibleTo()` — that scope takes a `User` and is the staff boundary; the customer
boundary is the `customer_id` equality and nothing else. Note the double `orderByDesc` rather than
`NULLS LAST`, which is invalid on SQLite — the cross-cutting rule in `.squad/plans/00-index.md`.

`show(Request $request, Ticket $ticket)` — **first line** is the ownership check:

```php
abort_unless($ticket->customer_id === PortalRequest::customer($request)->id, 404);
```

**404, not 403** — a 403 confirms the ticket exists. Then load messages through
`$ticket->messages()->publicOnly()->with('author:id,name')->orderBy('id')->get()`. The
`publicOnly()` filter is **in the query**, per `TicketMessage::scopePublicOnly()`'s docblock. This
plus `PortalMessageResource`'s key set is AC5.

`store(StorePortalRequestRequest $request)` — AC2. Reproduce `TicketController::store`'s ordering
(`api/app/Http/Controllers/TicketController.php` lines 63–108) exactly:

1. `customer_id` from the session, `created_by => null` (*"without agent involvement"* — no staff
   user created it), `status => TicketStatus::Open->value`,
   `channel => Channel::WebForm->value`. `priority` **omitted** so the column default applies.
2. `TicketAssigner::pick()`; on a non-null pick, set `assigned_to` and call
   `$ticket->recordAutoAssigned($ticket->assigned_to)` **after** the save.
3. `Ticket::create(...)`, then `SlaClock::applyTo($ticket)`, then `$ticket->save()` — in that order,
   because the SLA anchor is `created_at` and does not exist until the insert.
4. The description becomes the first `ticket_messages` row with
   `author_type => TicketMessage::AUTHOR_CUSTOMER`, `customer_id => $customer->id`,
   `user_id => null`, `channel => $ticket->channel`, `visibility => MessageVisibility::Public`.
5. A `ticket_events` row `event => 'created'`, `user_id => null`. **No new event value is
   introduced** — `ticket_events` is Story 04's append-only table and `created` already exists.

Wrap 1–5 in one `DB::transaction()`. Return **201** with `PortalTicketResource`.

`reply(StorePortalReplyRequest $request, Ticket $ticket)` — ownership check first, as in `show()`.
Then, in one transaction:

1. `abort_if($ticket->status === TicketStatus::Closed, 422, …)` — a **closed** ticket takes no
   customer reply; `allowedTransitions()` lets an agent reopen it, a customer may not. The SPA
   disables the composer, so the 422 is a backstop.
2. Insert the message: `AUTHOR_CUSTOMER`, `customer_id`, `user_id => null`,
   `channel => $ticket->channel` (**never client-supplied** — the rule at
   `api/app/Http/Controllers/TicketMessageController.php` line 62),
   `visibility => MessageVisibility::Public`.
3. `$ticket->touch()` — the last-activity bump, matching line 67 there.
4. A `ticket_events` row `event => 'replied'`, `user_id => null`,
   `new_value => (string) $message->id` — the same shape as lines 69–77.
5. When `$ticket->status === TicketStatus::Resolved`: set `status = Open`, clear `resolved_at`, and
   append a `ticket_events` row `event => 'status_changed'`, `field => 'status'`,
   `old_value => 'resolved'`, `new_value => 'open'`. `Resolved → Open` is legal per
   `TicketStatus::allowedTransitions()`. **Do not clear `closed_at`** — step 1 already excluded a
   closed ticket. Note the AC3/AC4 consequence: a reply moves a ticket **out of** history and back
   into *Track requests*.
6. `$customer->forceFill(['last_contact_at' => now()])->save()` — `customers.last_contact_at` is
   documented in its migration (line 22) as *"written by the Conversation Thread story"*; a customer
   reply is exactly that signal.

Also notify the assignee through the existing dispatcher rather than a new path: call
`App\Services\NotificationDispatcher` with the `NotificationType` case the agent-facing reply
already uses. **Read `api/app/Enums/NotificationType.php` and reuse the existing case** — if none
fits a customer reply, add one there *and* its label to `api/lang/{en,ar}/enums.php`, since
`api/tests/Feature/NotificationTypeContractTest.php` asserts that map is complete.

**Create file:** `api/app/Http/Requests/StorePortalRequestRequest.php`
`subject` → `['required', 'string', 'max:255']`; `description` → `['required', 'string', 'max:5000']`
(**required** here, unlike the agent form — a request with no body is useless to an agent);
`category` → `['required', Rule::in(Ticket::CATEGORIES)]`. **No `priority`, no `assigned_to`, no
`customer_id`, no `channel`.** `authorize()` returns `true`; `PortalAuth` is the gate.

**Create file:** `api/app/Http/Requests/StorePortalReplyRequest.php` — `body` →
`['required', 'string', 'max:5000']`.

**Create file:** `api/app/Http/Resources/PortalTicketResource.php`
**Create file:** `api/app/Http/Resources/PortalMessageResource.php`
Exactly the frozen keys in *Shared contracts*. Build them as **new** resources; do **not**
conditionally strip fields from `TicketResource` — a `when()` chain there is how an internal field
eventually leaks, and AC5 is the criterion that would fail.

**Create file:** `api/app/Http/Controllers/Portal/PortalFaqController.php` — AC6.
`index()` — published only:
`KbArticle::where('status', ArticleStatus::Published->value)->whereNotNull('published_at')`, with
`kb_category_id` filtering and a `q` term. Reuse the injected `App\Services\Kb\ArticleSearch`
contract for `q` so PostgreSQL and SQLite behave as they already do elsewhere.
`show(string $slug)` — the same status filter, `firstOrFail()`, then the identical atomic view-count
bump from `KbArticleController::show`
(`api/app/Http/Controllers/Kb/KbArticleController.php` line 128), **including `->getQuery()`**, so
`updated_at` does not move.

**Create file:** `api/app/Http/Resources/PortalArticleResource.php` — `title`, `slug`, `excerpt`,
`body_html`, `published_at`, `category` (name only). **No `author`, no `body` (raw Markdown), no
`view_count`, no `versions_count`, no `status`.** The client renders only `body_html`, which
`App\Services\MarkdownRenderer` has already sanitized.

### 8 — Extract Story 13's share-link minting (Decision 2)

**Create file:** `api/app/Services/CsatShareLink.php` — one method,
`public function for(CsatSurvey $survey): string`, holding the body of
`CsatSurveyController::shareUrl()` verbatim (`api/app/Http/Controllers/CsatSurveyController.php`
lines 112–124), route names `csat.show`/`csat.store` untouched.

**File:** `api/app/Http/Controllers/CsatSurveyController.php` — delete the `private shareUrl()`
method (lines 106–124) and call the injected service at line 101 instead. **Behaviour-preserving:
the signed output must be byte-identical**, because the route name is the signing key and every
outstanding link depends on it. `PortalTicketResource` uses the same service for `feedback_url`.

This is the only edit this story makes to another story's file.

### 9 — Server-side strings

**Create file:** `api/lang/en/portal.php` and `api/lang/ar/portal.php`.

Keys: `session_invalid`, `code_invalid`, `code_expired`, `closed_no_reply`, and the mail-body keys
(`mail.subject`, `mail.greeting`, `mail.code_intro`, `mail.expiry`, `mail.ignore`). Every
customer-facing message the API emits resolves through `__()`, per the cross-cutting rule in
`.squad/plans/00-index.md`. `api/tests/Feature/I18n/` already asserts catalogue parity — read what
it walks before adding the files, so the new namespace is covered rather than skipped.

---

## Frontend Tasks

### 1 — Feature scaffold

**Create** `web/src/features/portal/`, mirroring `web/src/features/csat/`'s layout:

```
api/portalClient.ts          api/portalApi.ts
components/PortalHeader.tsx  components/OtpInput.tsx  components/PortalCard.tsx
components/RequestStatusBadge.tsx  components/MessageBubble.tsx
components/RequestList.tsx   components/RequirePortalSession.tsx
hooks/usePortalSession.ts    hooks/usePortalRequests.ts  hooks/usePortalFaq.ts
model/portal.ts  model/portalSession.ts  model/portalKeys.ts
pages/PortalAccessPage.tsx   pages/PortalRequestsPage.tsx  pages/PortalHistoryPage.tsx
pages/PortalRequestDetailPage.tsx  pages/PortalNewRequestPage.tsx
pages/PortalFaqPage.tsx      pages/PortalArticlePage.tsx
PortalLayout.tsx  portal.css  index.ts
```

`api/portalClient.ts` — a **separate** Axios instance, following
`web/src/features/csat/api/csatPublicClient.ts` lines 11–14 and its stated reason. It must **not**
import `web/src/lib/api.ts`. It carries:

- `Accept: application/json`;
- an `Accept-Language` request interceptor reading `localStorage['wisal-lang']`, copied from
  `web/src/lib/api.ts` lines 42–54 — the portal's server messages and the OTP mail depend on it (AC9);
- an `Authorization: Bearer` interceptor sourcing the **portal** token;
- a response interceptor that, on **401**, clears the stored portal token and redirects to
  `/portal`. It must never call `setUnauthorizedHandler` — that hook belongs to the staff session.

**Token storage:** `sessionStorage` under `wisal-portal-token`, plus a module-scoped mirror so a
blocked-storage browser still works for the tab's lifetime. This deliberately **differs** from
`docs/decisions/ADR-004-authentication.md`'s staff rule (module variable only, reload logs you out):
a customer who loses their session by refreshing would have to re-run an OTP round trip, which is a
worse outcome than a 24-hour token that dies with the tab. `localStorage` is **not** used — the
token must not survive the browser session.

**Create file:** `docs/decisions/ADR-005-customer-portal-access.md` — the second ADR in
`docs/decisions/`. Record Decisions 1, 2, 4 and 5 above, the separate-table identity choice, and the
`sessionStorage` departure from ADR-004. Cross-link it from ADR-004's Customer Portal sentence
(line 7). **AC7's "recorded" is satisfied by this file plus Decision 2 in this plan.**

`model/portalKeys.ts` — a keying scheme in the shape of the project's existing `ticketKeys`:
`portalKeys.all`, `.session()`, `.requests(scope)`, `.request(id)`, `.faq(params)`. Every portal
mutation invalidates `portalKeys.all`. **Do not** touch `ticketKeys` — a portal mutation must not
invalidate an agent's cache, and the two never coexist in one browser tab anyway.

### 2 — i18n (AC9)

**File:** `web/src/i18n/instance.ts` — add `'portal'` to `NAMESPACES` (lines 36–51) and
`portal: enPortal` / `portal: arPortal` to both halves of `resources` (lines 53–86), with the two
imports beside their neighbours.
**Create file:** `web/src/i18n/locales/en/portal.json` and `web/src/i18n/locales/ar/portal.json`.
Every string from the eight design exports goes here, including the OTP `aria-label`s
("Digit 1"…"Digit 6"), the *"Incorrect code. {{count}} attempts remaining."* plural (i18next JSON v4
plurals — Arabic gets its six CLDR forms, `web/src/i18n/instance.ts` lines 88–92), and the cooldown
label.

**File:** `web/scripts/i18n-allowlist.json` — add `"src/features/portal"` to `roots`. New code is
born clean; it does not join the pending-retrofit list in `_rootsNote`. **Re-read the WIS-17
coordination note in *Prerequisites* first** — which checker this must satisfy depends on merge
order.

The portal has no signed-in user, so locale comes from **`localStorage['wisal-lang']` → browser
`navigator.language` → `en`**, plus the header toggle. This is the rule
`web/src/features/csat/model/csatStrings.ts` lines 1–8 pinned; it is honoured here through the
shared catalogue instead of a second string module.

### 3 — A local-only locale setter

**File:** `web/src/app/providers/UiPreferencesContext.tsx` — add
`setLocaleLocalOnly: (l: Locale) => void` to `UiPreferencesContextType` (lines 8–23) and to the
provider value (lines 148–160), implemented as the existing `syncLocaleFromServer` body
(lines 133–145): state + `applyI18nLanguage` + persist, **no `api.patch`**. Keep
`syncLocaleFromServer` exported and delegate it to the new function, so `LocaleSync` and the existing
`UiPreferencesContext.test.tsx` are untouched.

**Why:** `setLocale` (lines 116–132) PATCHes `/user/preferences`, which for a portal visitor is an
unauthenticated request that fails twice and then sets `localeError`. `theme`/`toggleTheme`
(lines 97–107) are already `localStorage`-only and are used as-is.

### 4 — `PortalLayout` and the public header (AC8)

**Create file:** `web/src/features/portal/PortalLayout.tsx`

The chrome the design brief requires be reusable across every portal screen: the "Wisal" wordmark
(start-aligned, mirrored in RTL), a language pill, and a theme toggle (end-aligned). **Nothing
else** — no search, no bell, no avatar, no internal navigation, no "staff login" link. Port the
header markup from
`docs/design/references/15.WisalPortalAccess-Step1/WisalPortalAccess-Step1-LightLTR.dc.html`
lines 28–36. Language pill → `setLocaleLocalOnly`; theme toggle → `toggleTheme`. Renders an
`<Outlet />`.

`portal.css` uses **CSS logical properties only** (`padding-inline`, `border-block-end`,
`margin-inline-start`) — the exports already do; do not reintroduce `left`/`right`. Every
interactive element gets a visible `:focus-visible` outline; the exports' `.wisal-*` rules
(lines 14–20) exist for exactly that, and `outline: none` without a replacement is forbidden
(`docs/design/brief.md` lines 193–194). Mobile-first: the `Mobile Idle` artboards are 375px wide and
the page must never scroll horizontally.

**Grep every `class="…"` in all eight export files against their `<style>` blocks before porting** —
`STATUS.md` records `fv`/`fvd`/`sk` being referenced and never defined.

### 5 — `PortalAccessPage` (the two designed steps, AC1)

**Create file:** `web/src/features/portal/pages/PortalAccessPage.tsx`

One route, `/portal`, with a `step` state of `'identifier' | 'code'`. The artboards map to states,
not routes:

| Artboard | Rendered when |
|---|---|
| `Step1 Idle` | `step === 'identifier'`, no error |
| `Step1 Submitting` | request mutation pending — button disabled + spinner |
| `Step1 Error Format` | client-side or 422 format failure — **inline field error** |
| `Step1 Error Generic` | never an error response; the reassuring banner shown alongside the 202 |
| `Step2 Idle` | `step === 'code'`, cooldown running |
| `Step2 Submitting` | verify mutation pending — the six inputs disabled |
| `Step2 Error Wrong` | 422 — inline error with `attempts_remaining` |
| `Step2 Error Expired` | 410 — distinct copy, inputs disabled, resend offered |
| `Step2 Resend Available` | cooldown elapsed — "Resend code" is an active link |

Use `react-hook-form` + `zod` (both already dependencies in `web/package.json`) as the rest of the
app does. The footer carries the one internal-feeling link the design permits: *"Need help without
an account? Browse our FAQs"* → `/portal/faq`, which works unauthenticated (AC6).

**Create file:** `web/src/features/portal/components/OtpInput.tsx` — six controlled `<input>`s with
`inputMode="numeric"`, `pattern="[0-9]*"`, `maxLength={1}`, `autoComplete="one-time-code"` on the
first, and a translated `aria-label` each, per the export at lines 44–49. Behaviour: typing advances
focus, `Backspace` on an empty box retreats, a **six-digit paste into any box fills all six**, and
non-digits are dropped. In RTL the boxes stay **left-to-right** — a numeric code is not mirrored —
so the container sets `dir="ltr"` explicitly. The error state sets `aria-invalid` and
`aria-describedby` pointing at the message, matching lines 123–132.

The cooldown counter is driven by `resend_after_seconds` from the 202 body, **not** a hard-coded 60,
is announced with `aria-live="polite"`, and is cleared on unmount.

On a successful verify: store the token, then `navigate('/portal/requests', { replace: true })` —
`replace`, so Back does not return to a spent code screen.

### 6 — The five undesigned screens (Decision 3)

Built from the design system and the nearest built precedent, not from an artboard. **All four
async states are mandatory on every one** (`docs/design/brief.md` lines 181–187): skeleton, an
**Empty** state that explains and offers the next action, a retryable **Error**, and Success.

**`PortalRequestsPage`** (`/portal/requests`) — **AC3, open tickets only.** Calls
`GET /api/portal/requests?scope=open`. Each row: subject, a status badge (colour **plus** a text
label — colour is never the only signal, lines 196–197), last activity via the shared
`formatRelative` formatter from `web/src/i18n`, and the public message count. Pagination state
lives **in the URL**, per the cross-cutting rule in `.squad/plans/00-index.md`. Precedent:
`docs/design/references/4.Data Table/`.

**`PortalHistoryPage`** (`/portal/history`) — **AC4, past tickets and resolutions.** Calls
`?scope=past`. Same `RequestList` component, different scope and one extra column: the resolution
date (`resolved_at`, falling back to `closed_at`). **A separate route, because AC3 and AC4 are
separate criteria and a reviewer must be able to test them separately** — a single screen with a
client-side toggle cannot be asserted as two behaviours. A later design pass may merge them into
tabs; if it does, keep both URLs working, because the tests address them.

**`PortalNewRequestPage`** (`/portal/requests/new`) — **AC2.** Subject, category select (options
from `Ticket::CATEGORIES` labels in the `portal` namespace), and a required description. **No
priority field.** 201 → navigate to the new request's detail page. Precedent:
`docs/design/references/5.Modals/` for form composition.

**`PortalRequestDetailPage`** (`/portal/requests/:ticketId`) — header (subject, status badge,
opened / last-activity / resolved dates), the public message thread, and a reply composer. Agent and
customer messages are visually distinct; a `system` message renders as a centred meta line. Bodies
render as **plain text with `dir="auto"`** and preserved newlines — an Arabic reply inside an English
thread must read correctly, the treatment
`web/src/features/csat/pages/CsatResponsePage.tsx` line 154 gives a free-text comment. **Never
`dangerouslySetInnerHTML`** here; `ticket_messages.body` is unsanitized user input. The composer is
**disabled with an explanatory line when the ticket is `closed`**, mirroring the API's 422.

When the response carries a `feedback_url`, show a *"Rate your support experience"* link to it —
**AC7's implementation half**, per Decision 2. No survey UI is built here.

**`PortalFaqPage`** / **`PortalArticlePage`** (`/portal/faq`, `/portal/faq/:slug`) — **AC6**,
reachable **without** a session. The article view renders `body_html` via
`dangerouslySetInnerHTML`, safe **only** because `App\Services\MarkdownRenderer` is the single
sanitizing write path (Story 09) — add that reason as a comment at the call site. Precedent:
`docs/design/references/6.Knowledge/`.

**Create file:** `web/src/features/portal/components/RequirePortalSession.tsx` — the portal's
`RequireAuth` analogue: no token → `<Navigate to="/portal" replace />`, otherwise `<Outlet />`. It
wraps `/portal/requests*` and `/portal/history` and **not** the FAQ routes.

### 7 — Route wiring

**File:** `web/src/App.tsx` — add the portal routes immediately after the `/feedback/:uuid` route
(line 47), i.e. **outside** the `RequireAuth`/`AppLayout` route (lines 49–55) and **before** the `*`
catch-all (line 167). A comment in the style of lines 43–46 must say why they sit outside both.

```tsx
{/* Story 17 (WIS-16). The Customer Portal — a THIRD audience, outside RequireAuth
    and AppLayout per the intake ("external to the internal App Shell, not a tab
    inside it"). Its identity is a portal_sessions bearer token, not a Sanctum
    session; /portal/faq is public because FAQs are public content (§8). */}
<Route path="/portal" element={<PortalLayout />}>
  <Route index element={<PortalAccessPage />} />
  <Route path="faq" element={<PortalFaqPage />} />
  <Route path="faq/:slug" element={<PortalArticlePage />} />
  <Route element={<RequirePortalSession />}>
    <Route path="requests" element={<PortalRequestsPage />} />
    <Route path="requests/new" element={<PortalNewRequestPage />} />
    <Route path="requests/:ticketId" element={<PortalRequestDetailPage />} />
    <Route path="history" element={<PortalHistoryPage />} />
  </Route>
</Route>
```

`requests/new` is declared **before** `requests/:ticketId`, or the dynamic segment swallows "new" —
the hazard `web/src/App.tsx` lines 77–79 records for the KB routes.

`web/vercel.json`'s `{ "source": "/(.*)", "destination": "/index.html" }` rewrite already serves
these deep links; **no deployment-config change is needed**. Verify it, do not edit it.

### 8 — What is deliberately not touched

- `web/src/app/navigation/navItems.tsx` — **no** sidebar entry, per Decision 6.
  `web/src/app/navigation/navRoutes.test.tsx` asserts the manifest matches the shell's routes.
- `web/src/lib/api.ts` — unchanged.
- `web/src/features/csat/` — unchanged; the portal links to `/feedback/{uuid}`, it does not import
  the page (Decision 2).

---

## Edge Cases & Failure Modes

- **Identifier that matches no customer.** `PortalAccess::requestCode()` returns after resolution
  with no row written; the controller still answers **202** with the fixed body. The design brief's
  state 3 requires exactly this (*"do not confirm/deny account existence"*). Asserted by
  `PortalEnumerationTest`.
- **Identifier belonging to a soft-deleted customer.** `Customer` uses `SoftDeletes`, so the default
  scope excludes it and the path is identical to "no match". `withTrashed()` appears nowhere in
  `PortalAccess`.
- **Customer with a phone but no email.** Decision 4's known gap: the notifier logs a warning and
  returns, and the 202 is unchanged. Recorded in ADR-005; **must not** be papered over with a fake
  SMS success.
- **An unknown member of the public tries to sign in.** Per Decision 5 they cannot, and they see the
  same 202 as everyone else. **If reading (b) of AC1 is correct, this is a functional gap, not a
  security feature** — confirm before implementing.
- **The same phone number written two ways** (`+14155550148` vs `14155550148`).
  `Customer::phoneMatchCandidates()` returns both forms and the lookup uses `whereIn`; matching the
  bare column would miss half the rows (`api/app/Models/Customer.php` lines 78–96).
- **Two customers, one identifier.** The partial unique indexes on `customers` (migration lines
  34–35) exclude `NULL` and soft-deleted rows, so two *trashed* rows can share an email while one
  live row cannot. `->first()` on the live scope is therefore unambiguous; if a data import breaks
  that, the oldest live row wins and nothing crashes.
- **Resend tapped twice inside the cooldown.** Step 3 of `requestCode()` returns silently; the
  response is still 202 and the SPA's counter keeps running. **No error state.**
- **Resend issued while an earlier code is outstanding.** Step 4 supersedes every prior usable row.
  Only the newest code ever verifies; an older message is dead on arrival.
- **Wrong code entered `MAX_ATTEMPTS` times.** `attempts` reaches 5, `isExhausted()` turns true, and
  the next verify throws `PortalCodeUnusableException` → **410**, rendered as *Step2 Error Expired*.
  Brute-forcing 10⁶ codes is additionally bounded by the `portal-access` limiter's 5/minute.
- **Expired code (over 10 minutes).** `isExpired()` → 410, with the distinct copy at export line 163.
- **Two browsers verifying the same code simultaneously.** The `whereNull('consumed_at')`-guarded
  update means one wins; the loser sees zero affected rows and gets a 410. Never two sessions from
  one code. Mirrors `CsatSurveyController::store` (lines 66–79).
- **Forged, revoked, or expired portal token.** `PortalAuth` returns the same 401 body for all
  three. The SPA's response interceptor clears storage and returns to `/portal`.
- **A portal token sent to a staff route.** `auth:sanctum` cannot resolve it — it is not a
  `personal_access_tokens` row — so the staff route 401s. Asserted by `PortalTokenIsolationTest`,
  which also asserts the converse: a staff Sanctum token on `/api/portal/requests` is 401, because
  `PortalAuth` looks up `portal_sessions` by hash and finds nothing. **This pair is what AC1's
  `users`-isolation clause reduces to in tests.**
- **Requesting another customer's ticket by id.** `abort_unless($ticket->customer_id === $customer->id, 404)`
  — **404, not 403**, so the id space is not enumerable. AC3/AC4/AC5.
- **A ticket carrying internal notes.** `publicOnly()` is applied in the query in `show()` and in
  `index()`'s `withCount`, and nowhere in the view layer. `PortalMessageResource` has no
  `visibility` key at all, so even a scoping regression cannot render the field. Guarded by
  `PortalInternalNoteLeakTest`, alongside the existing
  `api/tests/Feature/InternalNoteVisibilityTest.php`. **AC5.**
- **`?scope=` with a junk value.** Anything that is not `past` falls back to `open` — no 422, no
  unbounded query. Asserted in `PortalRequestListTest`.
- **A ticket that moves between AC3 and AC4.** Resolving moves it from *Track requests* to
  *History*; a customer reply reopens it and moves it back. Both directions are asserted in
  `PortalReplyTest`, because the two screens read one endpoint and a stale filter would strand a
  ticket in neither.
- **Reply to a resolved ticket.** Reopens it (`Resolved → Open` is legal), clears `resolved_at`, and
  appends a `status_changed` event. The outstanding CSAT survey for the prior cycle is **left
  alone** — Story 13 owns `resolution_cycle`, and a re-resolve creates the next row.
- **Reply to a closed ticket.** 422, and the composer is disabled before the user can try.
  `closed_at` is never cleared by portal code.
- **Portal ticket submitted when no agent is assignable.** `TicketAssigner::pick()` returning `null`
  is valid and documented (`api/app/Http/Controllers/TicketController.php` lines 81–89); the ticket
  is created Unassigned and no `auto_assigned` event is written. AC2 still holds — it asks that the
  ticket appear in the queue, not that it be assigned.
- **FAQ slug that is a draft or archived article.** The status filter runs before `firstOrFail()`, so
  it is a **404** — a customer cannot discover an unpublished article by guessing its slug, even
  though slugs are frozen and public forever (`kb_articles` migration, the `slug` comment).
- **Unicode and RTL in customer input.** Subject, description, and reply bodies are stored verbatim
  and rendered as text with `dir="auto"`. The `max:5000` rule counts **characters**, not bytes, so a
  5000-character Arabic body is accepted.
- **A locale the portal does not support** (`Accept-Language: fr`). `SetLocale` falls back to `en`;
  the SPA's detection chain falls back to `en`. Neither throws.
- **`sessionStorage` unavailable** (private mode, blocked site data). Every read and write is inside
  `try/catch`, matching `web/src/app/providers/UiPreferencesContext.tsx` lines 29–35; the
  module-scoped mirror keeps the tab working and the session does not survive a reload.
- **Clock skew between issue and verify.** All comparisons use the DB-written `expires_at` against
  `now()` on the same server. No client timestamp is trusted anywhere.

---

## Test Plan

Backend (Pest, `api/tests/Feature/Portal/` — a new directory beside `api/tests/Feature/Csat/`).
Follow `api/tests/Feature/Csat/CsatPublicResponseTest.php` for style.

1. **`PortalAccessRequestTest.php`** — a matching email issues exactly one row and sends exactly one
   mail (`Mail::fake()`; `api/phpunit.xml` sets `MAIL_MAILER=array`); a matching phone in either
   stored form does the same; an unparseable identifier is **422**; a valid-format unmatched
   identifier is **202 with zero rows written**; a second request inside the cooldown writes no new
   row and still returns 202; a request outside the cooldown supersedes the prior row.
2. **`PortalEnumerationTest.php`** — the status and body for a matched and an unmatched identifier
   are **identical apart from `masked_identifier`**, which is derived from the typed value. Also: a
   soft-deleted customer's email behaves exactly like an unknown one.
3. **`PortalVerifyTest.php`** — the right code returns 200 with a token and creates one
   `portal_sessions` row; the wrong code is 422 with a decreasing `attempts_remaining`; the fifth
   failure and every attempt after it is **410**; an expired code is 410; a consumed code is 410;
   two concurrent verifies of one code yield exactly one session (run the guarded update twice and
   assert the `portal_sessions` count).
4. **`PortalSessionTest.php`** — no bearer → 401; unknown, revoked, and expired tokens each → 401
   **with the same body**; a live token reaches `/api/portal/me`; logout is 204 and the token then
   401s; `last_used_at` advances without touching the customer row.
5. **`PortalTokenIsolationTest.php`** — **the AC1 test.** A portal token on `/api/tickets` is 401; a
   staff Sanctum token on `/api/portal/requests` is 401; `personal_access_tokens` gains **no** row
   from a portal verify; the whole access flow touches `users` **zero** times (assert with a query
   log filter or `DB::listen`, so the *"without any row being created in or read from `users`"*
   clause is proven, not assumed).
6. **`PortalRequestListTest.php`** — **AC3 and AC4.** `?scope=open` returns only non-resolved,
   non-closed tickets; `?scope=past` returns only resolved/closed ones ordered by resolution date;
   a junk `scope` falls back to `open`; another customer's ticket is absent from both;
   `PortalTicketResource`'s keys match the frozen set **exactly** (compare key sets, so an added
   `sla` or `assigned_to` key fails); pagination works.
7. **`PortalRequestAuthorizationTest.php`** — `GET` and `POST reply` on another customer's ticket are
   **404, not 403**; a non-existent id is also 404, and the two are indistinguishable.
8. **`PortalInternalNoteLeakTest.php`** — **the AC5 test, and the highest-consequence one here.** A
   ticket with one public and one internal message returns **one** message; `message_count` is 1;
   the raw JSON contains neither the internal body nor the string `"visibility"`; the resource
   contains no `assigned_to`, `priority`, `created_by`, or `sla` key.
9. **`PortalTicketSubmissionTest.php`** — **AC2.** 201; `channel === 'web_form'`;
   `status === 'open'`; `created_by === null` (*"without agent involvement"*); the ticket is visible
   to a staff caller on `GET /api/tickets` (*"appears in the internal Ticket Queue"* — assert this
   explicitly, it is the half of AC2 a portal-only test would miss); the description became one
   `AUTHOR_CUSTOMER` public message; a `created` `ticket_events` row exists; SLA columns are stamped;
   `priority` is the column default; **a body carrying `priority`, `assigned_to`, `customer_id`, or
   `channel` has them ignored, not honoured**.
10. **`PortalReplyTest.php`** — a reply on an open ticket bumps `tickets.updated_at`, writes a
    `replied` event, and sets `customers.last_contact_at`; a reply on a **resolved** ticket reopens
    it, clears `resolved_at`, writes a `status_changed` event, and **moves it from `scope=past` to
    `scope=open`**; a reply on a **closed** ticket is 422 and writes nothing; the assignee gains
    exactly one notification row.
11. **`PortalFaqTest.php`** — **AC6.** Published articles are listed for an **unauthenticated**
    caller; draft and archived slugs are 404; `view_count` increments while `updated_at` does not;
    the resource carries no `body`, `author`, `status`, or `view_count` key.
12. **`PortalRateLimitTest.php`** — the sixth `/access/request` for one identifier inside a minute is
    **429**; the `login` limiter is unaffected by portal traffic and vice versa (exhaust one, assert
    the other still passes).
13. **`PortalCsatCoexistenceTest.php`** — **AC7.** A resolved ticket with an `outstanding` survey
    exposes a `feedback_url`; one with an `answered` or `expired` survey exposes `null`; the URL is
    **byte-identical** to what `GET /api/tickets/{ticket}/csat` mints for the same survey (the
    single-source proof for Decision 2); the portal creates **no** `csat_surveys` row.
14. **`api/tests/Feature/I18n/`** — extend the existing catalogue-parity test so
    `lang/en/portal.php` and `lang/ar/portal.php` have identical key sets. Read the existing test
    first: if it globs the `lang` directory it already covers them, in which case add only the
    assertion that a portal error message differs between `Accept-Language: en` and `ar`.
15. **`api/tests/Feature/ApiContractTest.php`** — this test walks the real route list. Extend it so
    every `/api/portal/*` route is asserted to carry either `throttle:portal-access` (public) or
    `portal` (authenticated), and that **no** portal route carries `auth:sanctum`. The structural
    guard equivalent to the route walk in `api/tests/Feature/Admin/AdminAuthorizationTest.php`.
16. **`api/tests/Unit/`** — a unit test for `PortalAccess::normalize()` and `::mask()` across:
    upper-case email, email with surrounding whitespace, phone with and without `+`, phone with
    separators, an empty string, a bare `@`, and a 191-character value. `mask()` must never emit more
    than the first character of an email local part or the last two digits of a phone.
17. **CSAT regression** — `api/tests/Feature/Csat/CsatLinkSecurityTest.php` must still pass
    unchanged after Backend Task 8's extraction. That is the proof the refactor is
    behaviour-preserving.

Frontend (Vitest + Testing Library, colocated `*.test.tsx`, matching
`web/src/features/csat/pages/CsatResponsePage.test.tsx`).

18. **`PortalAccessPage.test.tsx`** — each of the nine artboard states renders from the
    corresponding API response; a 202 advances to step 2 and shows the masked identifier; the
    cooldown counts down from `resend_after_seconds` and then enables Resend; a 422 shows
    `attempts_remaining`; a 410 disables the inputs and offers Resend; the footer FAQ link works
    with no session.
19. **`OtpInput.test.tsx`** — typing advances focus; `Backspace` on an empty box retreats; pasting
    six digits into box 3 fills all six; letters are rejected; the container is `dir="ltr"` even
    under `dir="rtl"`; each box has a translated `aria-label`.
20. **`PortalRequestsPage.test.tsx`** and **`PortalHistoryPage.test.tsx`** — **AC3 and AC4
    separately.** Each requests its own `scope`, renders all four async states, and the Empty state
    offers the right next action (*Submit a request* for open; *nothing resolved yet* for history).
    History shows the resolution date column; the open list does not.
21. **`PortalRequestDetailPage.test.tsx`** — the thread renders agent, customer, and system messages
    distinctly; the composer is disabled with an explanation for a closed ticket; `feedback_url`
    renders a link to `/feedback/…` and its absence renders nothing (AC7); a body containing
    `<script>alert(1)</script>` renders as **text**, proving no `dangerouslySetInnerHTML`.
22. **`RequirePortalSession.test.tsx`** — no token redirects to `/portal`; a token renders the child;
    a 401 from any portal call clears storage and redirects.
23. **`PortalLayout.test.tsx`** — **AC8.** The header has a wordmark, a language pill, and a theme
    toggle and **no** search box, bell, avatar, or internal nav link; the language pill calls
    `setLocaleLocalOnly` and issues **no** `/user/preferences` PATCH (assert against a mocked `api`);
    `dir` flips to `rtl` for `ar` (AC9).
24. **`portalClient.test.ts`** — the instance attaches the portal token and **never** the staff
    token; it sends `Accept-Language`; a 401 does not invoke the staff `onUnauthorized` handler.
25. **`web/src/app/navigation/navRoutes.test.tsx`** — confirm it still passes with the portal routes
    added, i.e. the portal is **not** expected in the nav manifest (Decision 6). If the test asserts
    every route has a nav entry, add the portal prefix to its exclusion list with a comment naming
    this decision.
26. **`web/src/app/providers/UiPreferencesContext.test.tsx`** — extend with one case:
    `setLocaleLocalOnly` changes locale and persists it while issuing no PATCH, and
    `syncLocaleFromServer` still behaves as before.
27. **`web/src/i18n/catalogueParity.test.ts`** — already walks the catalogues; confirm the new
    `portal` namespace is picked up automatically. If it enumerates namespaces by hand, add `portal`.
28. **`npm run i18n:check`** must pass with `src/features/portal` in `roots` — the gate is also
    asserted from `web/src/i18n/noHardcodedStrings.test.ts`, so `vitest` fails too if a literal slips
    in. See the WIS-17 coordination note for which checker version applies.

---

## Migration / Rollback

Two additive `Schema::create` migrations and **no change to any existing table**. Nothing here alters
`customers`, `tickets`, `ticket_messages`, `kb_articles`, or `csat_surveys`.

- **Forward:** `php artisan migrate`. Both tables are new — no populated-table hazard, no backfill.
- **Rollback:** `php artisan migrate:rollback --step=2` drops both tables. Every outstanding portal
  session and OTP dies with them; no other data is affected. A customer mid-sign-in starts over.
- **Half-applied state** (`portal_access_codes` created, `portal_sessions` not): `/access/request`
  succeeds and `/access/verify` throws on the missing table. There is no partial-write risk, because
  the session insert is the last step of `verify()`'s transaction. Do not deploy the routes ahead of
  the migrations.
- **Backend Task 8 is the only reversible-with-care item.** `CsatShareLink` must produce a
  byte-identical signed URL; if `csat.show` / `csat.store` were renamed in the process, **every
  outstanding customer feedback link would break**. Confirm with
  `api/tests/Feature/Csat/CsatLinkSecurityTest.php` and test 13 before merging; revert by restoring
  the private method if either fails.
- **New env keys:** none required. `FRONTEND_URL` is already read by the CSAT share link
  (`api/app/Http/Controllers/CsatSurveyController.php` line 121) and is what makes `feedback_url`
  resolve; confirm it is set on the deployed API before claiming AC7. For real OTP delivery,
  production needs `MAIL_MAILER` set to something other than `log` — state that in the PR
  description rather than changing a default here.

---

## Verification Steps

1. **Baseline first.** In `api/`: `php artisan test`. Record the result **before** touching anything.
   `STATUS.md` claims 364 green, while the recorded baseline is ~10 failing `Customer*` Pest tests
   on `main` (the same baseline WIS-17's plan records). Establish which is true **now**, so a
   pre-existing failure is not attributed to this story.
2. **Backend builds:** in `api/`, `php artisan migrate`, then
   `php artisan route:list --path=portal` — expect the ten routes from *Shared contracts*, and
   confirm none lists `auth:sanctum` in its middleware column.
3. **Backend tests:** in `api/`, `php artisan test --filter=Portal`, then the full
   `php artisan test`. The suite runs on SQLite `:memory:` (`api/phpunit.xml`), so a migration or
   raw expression valid only on PostgreSQL fails here — that is the point.
4. **CSAT regression:** in `api/`, `php artisan test --filter=Csat`. Must be green and unchanged,
   proving Backend Task 8 preserved the signing behaviour (Decision 2).
5. **Frontend runs:** in `web/`, `npm run dev`, then walk the flow at `http://localhost:5173/portal`
   — request a code, read it from `api/storage/logs/laravel.log`, verify it, submit a request, reply,
   check `/portal/history` after an agent resolves the ticket, and open the FAQ **signed out**.
6. **AC2 end to end:** with the portal ticket submitted, sign in as staff and confirm it appears at
   `/tickets` under channel *Web form*. That is the half of AC2 that lives outside the portal.
7. **Frontend tests:** in `web/`, `npm run test`.
8. **Lint and i18n gate:** in `web/`, `npm run lint` — runs `oxlint` **and** `npm run i18n:check`,
   which now enforces `src/features/portal`.
9. **Frontend builds:** in `web/`, `npm run build` (`tsc -b && vite build`) — clean, no new
   TypeScript errors.
10. **AC8/AC9 by eye:** switch the portal to Arabic and to dark, and compare the two access screens
    against their `LightRTL` / `DarkLTR` / `DarkRTL` exports. Confirm the OTP boxes stay
    left-to-right, the header mirrors, nothing scrolls horizontally at 375px, and every focus ring
    is visible. Then confirm the staff sidebar has **no** Portal entry (Decision 6) and that
    `/portal` is reachable **without** a staff session and is not redirected to `/dashboard`.
11. **Isolation by hand (AC1):** with DevTools, send a portal token as `Authorization` against
    `GET /api/tickets` — expect 401. Then a staff token against `GET /api/portal/requests` —
    expect 401.

---

## Done Criteria

Mapped 1:1 to the intake's nine acceptance criteria, which are **derived and marked for review** —
confirm them, and **Decision 5** in particular, before treating this list as final.

**AC1 — portal identity, no `users` involvement**

- [x] A customer whose email or phone is on a live `customers` row can request a code, receive it
      (in the log under `MAIL_MAILER=log`), verify it, and reach `/portal/requests`.
      *(SPA `PortalAccessPage` + `OtpInput` built and wired in `web/src/App.tsx`; on verify the
      token is stored and the page `navigate('/portal/requests', { replace: true })`s.
      `PortalAccessPage.test.tsx` / `OtpInput.test.tsx` green.)*
- [x] A phone identifier resolves in **both** stored forms (`+1…` and `1…`).
- [x] The whole access flow creates and reads **zero** `users` rows and **zero**
      `personal_access_tokens` rows, proven by `PortalTokenIsolationTest`, and a portal token cannot
      authenticate any staff route (nor a staff token any portal route).
- [x] A matched and an unmatched identifier produce an **identical 202** apart from
      `masked_identifier`; an unmatched identifier writes **no** row. A soft-deleted customer is
      indistinguishable from an unknown one.
- [x] The wrong code is 422 with a decreasing `attempts_remaining`; the sixth attempt and every
      expired or consumed code are 410; resend is blocked for the cooldown **without an error
      state**, driven by the API's `resend_after_seconds`; a new code supersedes prior outstanding
      ones; two concurrent verifies of one code create exactly **one** session.

**AC2 — submit tickets without agent involvement**

- [x] A portal-submitted ticket is created `open` on channel `web_form` with `created_by = null`,
      carries SLA target columns, goes through `TicketAssigner::pick()`, writes a `created`
      `ticket_events` row, and turns its description into one `AUTHOR_CUSTOMER` public message.
- [x] It **appears in the internal Ticket Queue** for a staff caller.
- [x] `priority`, `assigned_to`, `customer_id`, and `channel` sent in the body are ignored.

**AC3 — track requests (own open tickets)**

- [x] `/portal/requests` and `?scope=open` list only the caller's non-resolved, non-closed tickets
      with status/progress; a junk `scope` falls back to `open`; another customer's ticket is never
      present; another customer's ticket id is **404, not 403**.
      *(API + `PortalRequestListTest`/`PortalRequestAuthorizationTest` green; SPA `PortalRequestsPage`
      built with all four async states, URL-driven pagination — `PortalRequestsPage.test.tsx` green.)*

**AC4 — view history (own past tickets and resolutions)**

- [x] `/portal/history` and `?scope=past` list only the caller's resolved/closed tickets, ordered by
      resolution date, with the resolution date shown.
      *(SPA `PortalHistoryPage` built — separate route, `scope=past`, resolution-date column,
      empty state points back at open requests. `PortalHistoryPage.test.tsx` green.)*
- [x] Resolving moves a ticket from *Track requests* to *History*; a customer reply moves it back.

**AC5 — nothing leaked**

- [x] A ticket's portal thread contains **only** public messages; the JSON contains neither an
      internal note's body nor the key `"visibility"`; `message_count` counts public messages only.
- [x] `PortalTicketResource`'s keys match the frozen set exactly — **no** `sla`, `priority`,
      `assigned_to`, or `created_by`.

**AC6 — FAQs as a public read view**

- [x] `/portal/faq` and `/portal/faq/:slug` work with **no** session, list published articles only,
       return 404 for a draft or archived slug, and increment `view_count` without moving
      `updated_at`. Nothing here writes to `kb_articles` beyond that counter.
      *(API + `PortalFaqTest` green; SPA `PortalFaqPage` / `PortalArticlePage` built and wired
      outside `RequirePortalSession` so they are reachable signed-out.)*

**AC7 — feedback decision recorded and implemented consistently**

- [x] **Decision 2 (coexist, not supersede)** is recorded in this plan *and* in
      `docs/decisions/ADR-005-customer-portal-access.md` (Decision 6 there).
- [x] A resolved request with an `outstanding` survey links to Story 13's `/feedback/{uuid}`; an
      `answered` or `expired` one links to nothing; the URL is byte-identical to what the agent
      panel mints; the portal creates **no** `csat_surveys` row and **no** second survey UI exists.

**AC8 — the portal's own chrome, not the App Shell**

- [x] Every portal screen renders inside `PortalLayout`'s minimal public header (wordmark + language
      and theme toggles) with **no** sidebar, search, bell, avatar, internal nav link, or staff-login
      link; no portal route sits inside `RequireAuth`/`AppLayout`; and there is **no** entry in
      `navItems.tsx` (Decision 6).
      *(`PortalLayout.test.tsx` asserts wordmark + exactly two controls and no searchbox/nav/link;
      `web/src/App.tsx` declares `/portal` outside `RequireAuth`; `navRoutes.test.tsx` still green.)*

**AC9 — bilingual and RTL from day one**

- [x] The portal renders fully in Arabic, RTL-mirrored, with no signed-in user — driven by
      `localStorage['wisal-lang']` → browser language → `en` plus the header toggle — and the toggle
      issues **no** `/user/preferences` PATCH.
      *(`PortalLayout.test.tsx`: the toggle flips `.portal-root` to `dir="rtl"`, persists
      `wisal-lang=ar`, and the mocked `api.patch` is never called.)*
- [x] `web/scripts/i18n-allowlist.json` includes `src/features/portal` and `npm run lint`
      (`oxlint` + `i18n:check`) passes; `api/lang/en/portal.php` and `api/lang/ar/portal.php` have
      identical key sets; every portal API message resolves through `__()`.
      *(`i18n:check` green across `src/features/portal`; `lint` and `build` exit 0; `api I18n` suite
      green. A CSS-`var()` false positive in `RequestList.tsx` was exempted in the allowlist.)*
- [x] The OTP field is six real `<input>` elements with `inputmode="numeric"`, per-digit
      `aria-label`s, paste-to-fill, and `dir="ltr"` even in an RTL page.
      *(`OtpInput.test.tsx` green: focus advance/retreat, six-digit paste-to-fill, non-digits
      dropped, container `dir="ltr"` under `dir="rtl"`, translated `aria-label` per box.)*

**Cross-cutting**

- [x] All eleven access-flow artboards across `docs/design/references/15.WisalPortalAccess-Step1/`
      and `16.WisalPortalAccess-Step2/` are represented as states, in Light and Dark, LTR and RTL,
      with a visible focus ring on every interactive element and no horizontal scroll at 375px.
      *(`PortalAccessPage` maps the nine artboard states; `portal.css` uses logical properties and
      `:focus-visible`. Manual Light/Dark × LTR/RTL eyeball pass still recommended — Verification 10.)*
- [x] Every data screen ships all four async states — loading, error, empty, success.
      *(`PortalStates` component + per-page tests assert skeleton / retryable error / explanatory
      empty / success on requests, history, detail, and FAQ screens.)*
- [x] `/api/portal/access/*` has its own rate limiter; exhausting it does not affect the `login` or
      `csat` limiters, and vice versa.
- [x] The staff app is unchanged: no `navItems.tsx` entry, no edit to `web/src/lib/api.ts`, and
      `api/tests/Feature/Csat/` passes unmodified after the `CsatShareLink` extraction.
- [ ] The PR description states **which of this story and WIS-17 landed first**, and that the
      five post-access screens are *design-system-derived, pending a design pass* (Decision 3).
- [ ] `php artisan test` shows no failure that was not present in the Verification Step 1 baseline;
      `npm run test`, `npm run lint`, and `npm run build` are clean.
      *(Portal backend suite 55/55 green; portal frontend suite 60/60 green; `i18n:check` clean.
      **`npm run build` currently fails** — but only in `web/src/features/tickets/model/*`, from the
      in-flight WIS-17 (i18n-retrofit) working-tree changes whose consumers are half-migrated;
      nothing under `src/features/portal` is implicated. Re-run once WIS-17's tickets edits settle.)*

---

**STOP HERE. Report to the user and wait for confirmation — specifically on Decision 5 — before
implementing.**
