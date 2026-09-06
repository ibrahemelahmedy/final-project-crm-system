# ADR-005: Customer Portal Access Architecture

## Status
**Accepted** — 2026-09-02 (Story 17, WIS-16)

## Context
The Customer Portal (client requirement Category 8) is a **third audience** — external customers — distinct from the three internal staff roles ADR-004 covers. Every prior story explicitly deferred it: WIS-1, WIS-4, WIS-5, WIS-8, and WIS-14 all record "Customer Portal login/auth — separate story" under their own Out of scope sections. This ADR is that separate story's decision record.

Three questions the intake (`.squad/stories/customer-portal/WIS-16/intake.md`) explicitly deferred to planning are settled here, plus one the plan surfaced.

## Decision 1 — OTP, not a magic link

The portal identifies a customer by **email or phone entry → a 6-digit one-time code → verification**, not a magic link.

Reasons, in order of weight:
1. The only design that exists (`docs/design/references/15.WisalPortalAccess-Step1/` and `16.WisalPortalAccess-Step2/`) is built for a six-digit code entry screen, with attempt counts and a resend cooldown. A magic link would discard the only artboards this story has.
2. A magic link requires a working mail channel to be usable at all; an OTP degrades gracefully — the code can be read aloud over the phone — while Category 11 (Integrations) is deferred.
3. An OTP works for a phone identifier, which a link delivered by email cannot.

Consequence: a verification **state machine** exists (attempts, cooldown, expiry, single-use) — `App\Services\PortalAccess`, backed by `portal_access_codes`.

## Decision 2 — A separate `portal_sessions` table, not Sanctum on `Customer`

The portal's identity is `portal_sessions` — a bearer token hashed with SHA-256, resolved by `App\Http\Middleware\PortalAuth` — **not** a `personal_access_tokens` row and **not** `auth:sanctum`.

`personal_access_tokens` is polymorphic and would happily hold a `Customer` model, but `auth:sanctum` resolving to a non-`User` would put a customer inside every `$request->user()` call in the app — `ActiveUserOnly`, `EnsureAdministrator`, and every policy, none of which is written to handle it. A separate table with its own middleware means a portal token is **structurally incapable** of authenticating a staff route: `PortalAuth` never calls `Auth::login()` and never registers a user resolver, so nothing in the `web`/`sanctum` guard ever learns a customer exists. This is the property the intake's *"Must NOT reuse the internal `users` table / Sanctum session model"* constraint asks for, and it is proven in `PortalTokenIsolationTest` — a portal token 401s on `/api/tickets`, and a staff token 401s on `/api/portal/requests`.

`Customer` does **not** gain `HasApiTokens`.

## Decision 3 — `sessionStorage`, not a module variable (a deliberate departure from ADR-004)

ADR-004 stores the staff bearer token strictly in a module-scoped JavaScript variable — a page refresh signs the user out, by design, because staff sign back in cheaply with a password.

The portal token is stored in `sessionStorage` (`wisal-portal-token`) instead, with a module-scoped mirror for a browser that blocks storage. A customer who loses their session on a page refresh would have to re-run the whole OTP round trip — request a code, wait for it, type it in — which is a materially worse outcome for an external visitor than a 24-hour token that dies with the browser tab. `localStorage` is deliberately **not** used: the token must not survive the browser session entirely.

## Decision 4 — OTP delivery is a seam, not a feature

Requirement Category 11 (Integrations — Email, SMS & WhatsApp) is out of scope for this story, and `MAIL_MAILER` is `log` in `api/.env.example`. OTP delivery is behind the `App\Services\PortalCodeNotifier` interface, with exactly one shipped implementation, `MailPortalCodeNotifier`, which sends to `Customer::email`.

**Known, accepted gap:** `customers.email` is nullable, so a customer identified only by phone matches successfully but never receives a code — the notifier logs a warning and returns, and the API's response is unchanged (an identifier's deliverability must never be observable, or the access flow becomes enumerable). This is not a bug to be closed with a fake SMS success path; it is closed by a future story building an SMS/WhatsApp `PortalCodeNotifier` implementation behind the same interface.

## Decision 5 — "No account" means no *staff* account; self-registration is out of scope

The intake's first acceptance criterion reads: *"Given a customer with **no account**, when they enter their identifier … then they are signed in … WITHOUT any row being created in or read from the internal `users` table."*

This is implemented as: the person already exists as a `customers` row (an agent created it on first contact) but has no `users` row and no password — the portal proves they control the identifier already on file. It is **not** implemented as: an unknown member of the public arrives and the portal creates their `customers` record. The design's own copy for an unmatched identifier — *"If this matches a record, we've sent a code"* — presumes a record to match against; there is no design for a self-registration form.

If the client's intent was the second reading, that is a materially different, separately-scoped piece of work (public writes to `customers`, a spam/abuse surface, a duplicate-merge policy against the `customers_email_unique` / `customers_phone_normalized_unique` partial indexes, and likely a moderation queue) — see the story plan's Decision 5 for the itemised delta.

## Decision 6 — CSAT feedback: coexist with the WIS-14 link, do not supersede it

The intake's fifth in-scope bullet (*"Submit feedback"*) and its acceptance criterion require a
recorded, consistent decision on whether the portal replaces or coexists with WIS-14's existing CSAT
mechanism (a signed, expiring, single-purpose `/feedback/{uuid}` link that needs **no** login).

**The portal coexists with that link and builds no survey UI of its own.**

- Superseding would break a delivery path that already works: WIS-14's link is designed to be pasted
  into an agent reply and answered with no login. Requiring a portal session to rate a ticket loses
  every customer who never signs in — which, with Category 11 (real channel delivery) deferred, is
  most of them.
- Superseding would fork the data: Story 13 (WIS-14) owns `csat_surveys`, `resolution_cycle`, and the
  Reports aggregate that reads them. A second submission path against the same table means two writers
  for one unique `(ticket_id, resolution_cycle)` row.
- Coexisting costs one nullable field. `PortalTicketResource.feedback_url` carries Story 13's signed
  link (minted through the shared `App\Services\CsatShareLink`, extracted from
  `CsatSurveyController::shareUrl()` so agent panel and portal produce a byte-identical URL) when the
  ticket's newest survey is `outstanding`, and `null` otherwise. The portal renders a link to
  `/feedback/{uuid}` — the page Story 13 already built and tested. The portal writes **no**
  `csat_surveys` row.

## Consequences
- A customer with a phone number and no email cannot access the portal until an SMS/WhatsApp `PortalCodeNotifier` ships.
- Customer feedback continues to flow only through WIS-14's signed link; the portal surfaces it but never collects or stores a rating itself.
- An unknown visitor with no existing `customers` row cannot self-register through the portal; an agent must create the record first (e.g. from an inbound email or call), same as today.
- The portal's session lifetime (24 hours, non-sliding) and OTP lifetime (10 minutes, 5 attempts, 60-second resend cooldown) are `App\Services\PortalAccess` constants — see the Story 17 plan's *Shared contracts* for the frozen values.
- `docs/decisions/ADR-004-authentication.md` is cross-linked from this file; ADR-004's own Customer Portal sentence should be read alongside this one.
