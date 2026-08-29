# Story 13 — CSAT Collection (post-resolution survey) (Story: WIS-14)

> **Contract-level plan.** Stories 01–02 are implemented; this story executes after Story 12.
> Scope, contracts, and acceptance criteria below are final. Task-level file paths and line
> ranges are deliberately absent — regenerate this plan at full depth (`/squad-plan` on the same
> intake) immediately before implementing, once the code it builds on exists.

## Prerequisites

- **Story 01 completed** (`../authentication/01-story-authentication-access-control.md`) — Sanctum
  session, `UserRole` enum, `UserResource`. The survey-link generation endpoint sits inside
  `auth:sanctum`; the response surface deliberately sits **outside** it.
- **Story 02 completed** (`../app-shell/02-story-application-shell-navigation.md`) — the route tree
  in `web/src/App.tsx` and the `RequireAuth`-wrapped layout route. This story adds a **public** route
  **outside** both.
- **Story 04 completed** ([`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md))
  — owns the `tickets` table expansion, the `TicketStatus` enum, and the **`resolved_at` / `closed_at`**
  lifecycle. This story hooks the Resolved transition; it does **not** define it, and does not add
  columns to `tickets`.
- **Story 05 completed** ([`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md))
  — owns `ticket_messages` and the ticket-detail screen. The agent-facing "copy survey link"
  affordance attaches to that screen's side panel; this story does not create the thread.
- **Story 12 completed** ([`../reports-dashboards/12-story-reports-dashboards.md`](../reports-dashboards/12-story-reports-dashboards.md))
  — owns the Reports screen and its CSAT widget, which ships with a permanent Empty state because no
  data source existed. This story supplies that source and **wires the existing endpoint**; it does
  not restyle or re-lay-out the widget.
- **Story 15 not required.** This story ships its own two-locale string module for the public page and
  hands it to Story 15 (see *Shared contracts*). It must not block on i18n.

---

## Story Goal

1. When a ticket transitions to **Resolved**, the system creates exactly **one** CSAT survey for that
   resolution cycle, capturing who resolved it and when.
2. An agent viewing a resolved ticket can obtain a **shareable feedback link** for that ticket and copy
   it. (Sending it is out of scope — see below.)
3. A customer opening that link reaches a **no-login** single-purpose page, picks a rating on a fixed
   **1–5** scale, optionally writes a comment, and submits.
4. Re-opening an answered link shows the recorded response **read-only** — it never silently
   overwrites, and it offers no update action.
5. An expired or tampered link shows a clear, calm expired/invalid state — never a stack trace, never a
   half-working form.
6. Reports (Story 12) computes its CSAT aggregates from this data: average score by agent and by
   period, with a genuine Empty state for a period with zero responses.

**Explicitly out of scope:** emailing or otherwise delivering the link (client requirement category 11
— Integrations); NPS/CES/multi-question surveys; a customer-facing history of past ratings (Customer
Portal, category 8); any change to the Reports UI beyond swapping its data source; any customer
authentication.

---

## Context — Read These Files First

Only files verified to exist today are listed. Everything else is named by the story that owns it.

1. `.squad/stories/csat-collection/WIS-14/intake.md` — the acceptance criteria this plan's Done
   Criteria map to 1:1. The **Technical hints** block is binding: Laravel signed URLs, route outside
   `auth:sanctum`, independent rate limit, DB-level range check on the rating.
2. `docs/design/references/13.WisalCsatResponse/WisalCsatResponse-LightLTR.dc.html` — **the design is
   built.** Seven artboards: *Idle*, *Rating selected*, *Submitting*, *Submitted*, *Already answered*,
   *Expired link*, *Mobile (375px)*. Read the `.rating-group` / `.rating-option` / `.ro-rating` CSS
   blocks near the top of `<style>` — the rating control is a **radio group**, not buttons, and the
   already-answered variant is the same markup with `pointer-events:none`.
3. `docs/design/references/13.WisalCsatResponse/WisalCsatResponse-LightRTL.dc.html` and the two
   `Dark*` files — port with logical properties. The export hand-mirrors `border-right` on
   `.rating-option label`; use `border-inline-end`. **Grep every `class="…"` in these exports against
   their `<style>` block before porting** — the recurring export defect (`fv`/`fvd`, `sk` used but never
   defined) is recorded in `STATUS.md`.
4. `docs/design/brief.md` — `## Required states per view` and `## Accessibility` (`outline: none`
   without a replacement is **forbidden**; colour is never the only signal — the rating scale carries a
   text label *and* an emoji, keep both).
5. `api/routes/api.php` — **every** existing route is inside the `auth:sanctum` group. This story adds
   the first public API routes. Check `api/app/Http/Middleware/SecurityHeaders.php` too: the public
   survey response must carry the same headers, or the plan must say why it differs.
6. `web/src/App.tsx` — the route tree. The public route goes **outside** the `RequireAuth` layout route
   and outside the `*` catch-all's reach.
7. `web/src/lib/api.ts` — the shared Axios instance carries session credentials. The public survey
   calls must use a **separate, credential-free** request path; do not reuse the authenticated client.
8. `../ticket-management/04-story-ticket-management-queue.md` — read the `tickets` schema it pins,
   specifically `resolved_at`, `closed_at`, and `TicketStatus`. Do not re-derive them here.
9. `../reports-dashboards/12-story-reports-dashboards.md` — read the CSAT widget's endpoint shape and
   its Empty-state contract. This story fills that endpoint; the response shape must not change.

---

## Shared contracts this story establishes

Later stories and any re-plan of this one cite these; they are not renegotiable without amending this
plan.

**Table `csat_surveys`** (owned here; one row per resolution cycle):

| Column | Type | Notes |
|---|---|---|
| `id` | bigIncrements | |
| `uuid` | uuid, unique | the public identifier in the link — **never** expose `id` publicly |
| `ticket_id` | foreignId → `tickets` | cascade on delete |
| `resolution_cycle` | unsignedSmallInteger | 1 for the first resolution, incremented on each re-resolve |
| `resolved_by` | foreignId → `users`, **nullable** | nullable so deleting a user does not destroy the score history |
| `resolved_at` | timestamp | copied from the ticket at creation — Reports aggregates by period without re-deriving |
| `rating` | unsignedTinyInteger, **nullable** | `null` = outstanding. **DB-level CHECK `rating BETWEEN 1 AND 5`** |
| `comment` | text, nullable | optional; a rating with no comment is a complete response |
| `responded_at` | timestamp, nullable | set once, on first submission |
| `expires_at` | timestamp | creation + **30 days** (the design's *Expired link* copy states 30 days) |
| `created_at` / `updated_at` | timestamps | |

Unique index **`(ticket_id, resolution_cycle)`**. Index **`(resolved_by, responded_at)`** — the exact
shape Reports aggregates on.

**Rating scale — fixed at 1–5, single-select, no configuration.** Reason, recorded per the intake's
third criterion: the design export already commits to five labelled steps (`1 – Poor`, `2 – Fair`,
`3 – Okay`, `4 – Good`, `5 – Great`); a five-point mean is the aggregate Reports charts, whereas
thumbs-up/down yields only a percentage and cannot express "okay". Mixing the two makes the WIS-7
aggregate meaningless, so **no configurability ships**.

**Enum `app/Enums/CsatSurveyState.php`** — `outstanding`, `answered`, `expired`. Derived, not stored;
it is the single vocabulary the API and the frontend share for which artboard to render.

**Endpoints:**

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/tickets/{ticket}/csat` | `auth:sanctum` + `TicketPolicy@view` | returns the latest survey for the ticket plus a freshly minted `share_url`; **never** returns the comment to an agent who cannot view the ticket |
| `GET` | `/api/csat/{uuid}` | **public**, `signed`, throttled | returns `state`, ticket reference (number + subject only), and — when `answered` — the recorded `rating`, `comment`, `responded_at` |
| `POST` | `/api/csat/{uuid}` | **public**, `signed`, throttled | body `{ rating: 1..5, comment?: string }` |

Route names **`csat.show`** and **`csat.store`** — `URL::temporarySignedRoute()` is keyed on these;
renaming them invalidates every outstanding link.

**Rate limiter** `RateLimiter::for('csat')` — keyed on IP, applied only to the two public routes, so
survey traffic can never exhaust the agent-facing API's limiter.

**Frontend public surface** — `web/src/features/csat/index.ts` exports `CsatResponsePage` (the public
page) and `TicketCsatPanel` (the agent-side link/result panel consumed by Story 05's detail screen).
Nothing else is importable from outside the folder.

**Public route** `/feedback/:uuid` — outside `RequireAuth`, outside `AppLayout`.

**Locale of the public page** (the intake's last criterion): **the browser decides.** There is no
signed-in user and no customer locale field anywhere in the MVP, so the page reads
`navigator.language`; a value starting `ar` renders Arabic, everything else renders English, and the
page carries its own visible EN/AR toggle so a customer can override. The chosen locale is written to
`<html lang>` and `<html dir>` on that page only. Strings ship in
`web/src/features/csat/model/csatStrings.ts` as a two-locale record. **Story 15 migrates that module
into the shared catalogue and must keep the browser-detection rule** — it cannot substitute the
per-user server preference here, because there is no user.

---

## Implementation outline

### Backend (`api/`)

- **Migration creating `csat_surveys`** — the table above, with the CHECK constraint expressed so it
  survives on both the local SQLite fallback and the PostgreSQL target (`STATUS.md` records the app is
  running Path B). Owned here. Does **not** touch the `tickets` migration owned by Story 04.
- **`app/Models/CsatSurvey.php`** — `belongsTo` Ticket and resolver (`User`), casts for the three
  timestamps, a `state` accessor returning `CsatSurveyState`, route-model binding on `uuid`. Plus
  **`app/Enums/CsatSurveyState.php`**, owned here.
- **Resolution hook** — a listener or observer reacting to the Resolved transition **owned by Story 04**.
  It must not re-implement the transition. Behaviour: create a survey only when the ticket has no
  outstanding (unanswered, unexpired) survey for the current cycle; on a re-resolve after an answered
  or expired cycle, insert the next `resolution_cycle`. Wrapped in the same transaction as the
  transition so a rolled-back resolve leaves no orphan survey.
- **`app/Http/Controllers/CsatSurveyController.php`** — `show` and `store` for the public routes;
  `showForTicket` (or a dedicated `TicketCsatController`) for the agent route.
- **`app/Http/Requests/StoreCsatResponseRequest.php`** — `rating` required integer between 1 and 5;
  `comment` nullable string with a max length. Validation is the first gate; the DB CHECK is the second.
- **`app/Http/Resources/CsatSurveyResource.php`** (public shape) and
  **`app/Http/Resources/TicketCsatResource.php`** (agent shape, includes `share_url`). Two resources,
  because the public one must never leak internal notes, assignee, history, or the customer record.
- **`app/Policies/CsatSurveyPolicy.php`** — `view` delegates to `TicketPolicy@view`; **no `update`, no
  `delete` ability exists for anyone**, satisfying the criterion that an agent can read their average
  but cannot edit or delete a response.
- **`routes/api.php`** — the public group registered outside `auth:sanctum`, with `signed` and
  `throttle:csat`.
- **Reports data source** — replace the stubbed CSAT aggregate behind Story 12's existing endpoint with
  a real query over `csat_surveys` (`whereNotNull('rating')`, grouped by `resolved_by` and by period).
  **The response shape stays exactly as Story 12 defined it.** A period with zero responses returns the
  same empty marker Story 12 already renders — never a `0` score.

### Frontend (`web/src/`)

- **`features/csat/`** — the standard folder shape (`api/ components/ pages/ hooks/ model/ index.ts`)
  pinned by the shared contracts; `index.ts` is the only public surface.
- **`features/csat/api/`** — a credential-free request helper for the two public endpoints. It must not
  import `lib/api.ts`: sending session cookies from a customer's browser to a public endpoint is the
  exact confusion this story exists to avoid.
- **`features/csat/pages/CsatResponsePage.tsx`** — ports the seven artboards. Maps `CsatSurveyState`
  to a rendered state: `outstanding` → the form (idle / rating-selected / submitting), `answered` →
  the read-only recap, `expired` → the calm expired card. A failed fetch renders a retryable error
  card, and an unknown/invalid uuid renders the **same** expired/invalid card — the page must never
  distinguish "never existed" from "expired", or the link space becomes enumerable.
- **`features/csat/components/RatingGroup.tsx`** — the radio group from the export. Real
  `<input type="radio">` elements with a shared `name`, visually hidden, labels styled — keyboard
  arrow-key selection then works for free, and the focus ring comes from `:focus-visible` on the input.
- **`features/csat/components/TicketCsatPanel.tsx`** — the agent-side panel: copy-link button for an
  outstanding survey, read-only rating + comment for an answered one, "link expired" for an expired one.
  Consumed by Story 05's ticket-detail screen; **this story does not restructure that screen.**
- **`features/csat/model/csatStrings.ts`** — the two-locale string record described above, plus the
  browser-locale detection function. Marked in a comment as the module Story 15 absorbs.
- **`App.tsx`** — add `/feedback/:uuid` outside `RequireAuth`. The `*` catch-all must not swallow it.
- All four async states ship on both surfaces (loading skeleton / error / empty / success), per
  `docs/design/brief.md`.

---

## Edge Cases & Failure Modes

- **Ticket resolved, reopened, resolved again.** The unique `(ticket_id, resolution_cycle)` index plus
  the "no outstanding survey" guard means cycle 2 is created only after cycle 1 is answered or expired.
  A re-resolve while cycle 1 is still outstanding creates **nothing** — the old link stays valid.
- **Two agents resolve concurrently / a double-clicked Resolve button.** The unique index is the real
  guard; catch the constraint violation and treat it as success rather than surfacing a 500.
- **The same link submitted twice.** `responded_at` is set once inside a transaction with a
  `whereNull('responded_at')` conditional update. The second write affects zero rows and the API returns
  the **already-answered** state, not an error. It never overwrites.
- **Expired vs tampered vs unknown uuid.** All three render the identical expired/invalid card — the
  page must never distinguish them, or the link space becomes enumerable. `signed` rejects a tampered
  signature with 403; the controller converts 403 and 404 into the same client-visible state.
- **Two independent expiries** — the signed URL's own, and the `expires_at` column. Both are checked; the
  column is authoritative, so a survey can be closed early without invalidating every other link.
- **Resolving agent deleted.** `resolved_by` is nullable with `nullOnDelete`. Reports must group
  null-resolver responses into an "unattributed" bucket rather than dropping them from the average.
- **Rating out of range from a crafted request.** Rejected by `StoreCsatResponseRequest` (422) and
  independently impossible at the DB level via the CHECK constraint.
- **Comment containing HTML or RTL control characters.** Stored verbatim, rendered as text — never
  `dangerouslySetInnerHTML`. The agent panel renders it with `dir="auto"` so an Arabic comment reads
  correctly inside an English UI.
- **Public endpoint abuse.** `throttle:csat` is keyed on IP and separate from the app limiter, so a flood
  cannot lock out agent traffic.
- **Genuine uncertainty — the CHECK constraint on SQLite.** The project runs the local SQLite fallback
  (`STATUS.md`). SQLite honours `CHECK` in `CREATE TABLE` but Laravel's schema builder has no first-class
  `check()` helper, so this needs a raw statement, and SQLite's lack of `ALTER TABLE ADD CONSTRAINT`
  means it must be part of the create migration, not a follow-up. Confirm the exact syntax against both
  drivers during the full-depth re-plan; do not assume one statement serves both.
- **Genuine uncertainty — whether Story 04 emits a domain event on resolution or transitions inline.**
  If it emits an event, subscribe to it. If it transitions inline, the hook is a model observer on
  `Ticket` watching `resolved_at` becoming non-null. Resolve this by reading Story 04's implemented code
  during the re-plan; **do not modify Story 04's controller to add an event.**

---

## Test Plan

Backend (Pest, matching the existing pattern in `api/tests/Feature/`):

1. **`tests/Feature/Csat/CsatCreationTest.php`** — resolving a ticket creates exactly one survey with
   `resolved_by` and `resolved_at` populated; resolving twice while outstanding creates no second row;
   reopen → answer → re-resolve creates cycle 2; a rolled-back transition leaves no survey.
2. **`tests/Feature/Csat/CsatPublicResponseTest.php`** — a valid signed link returns `outstanding` with
   only the ticket number and subject; a valid submission stores rating + comment and sets
   `responded_at`; a comment-less submission is accepted; a second submission returns `answered` and
   leaves the original rating unchanged; rating `0` and `6` are both 422.
3. **`tests/Feature/Csat/CsatLinkSecurityTest.php`** — an unsigned URL, a tampered signature, an unknown
   uuid, and an expired survey all produce the same client-visible invalid state and never a 500; the
   public response body contains **none** of: internal notes, assignee, customer email, ticket history.
4. **`tests/Feature/Csat/CsatAuthorizationTest.php`** — an agent who cannot view the ticket cannot read
   its survey; no route exists that edits or deletes a submitted response for any role.
5. **`tests/Feature/ApiContractTest.php`** (existing) — extend so the public routes are asserted to be
   **outside** the `auth:sanctum` group and to carry `signed` + `throttle:csat`.
6. **Reports regression** — Story 12's existing CSAT test must still pass; add a case asserting a period
   with zero responses returns the Empty marker rather than a score of 0.

Frontend (Vitest + Testing Library):

7. **`src/features/csat/pages/CsatResponsePage.test.tsx`** — each of the five states renders its
   artboard: idle form, submitting (control disabled, no double submit), submitted thank-you, already
   answered read-only (no submit control present in the DOM at all), expired card. Plus loading skeleton
   and retryable error.
8. **`src/features/csat/components/RatingGroup.test.tsx`** — arrow keys move selection, each option has
   an accessible name combining the number and the label, and the selected option is reflected via the
   radio's checked state rather than a colour class alone.
9. **`src/features/csat/model/csatStrings.test.ts`** — `navigator.language` of `ar-EG` yields Arabic and
   `dir=rtl`; `en-GB` and an unknown tag both yield English; the explicit toggle overrides detection;
   **every key present in `en` is present in `ar`** (asserted by key-set comparison, so a later string
   addition cannot ship half-translated).
10. **Manual only** — dark mode, RTL mirroring, and the 375px artboard. jsdom does not resolve computed
    CSS; do not fake this with a snapshot that asserts nothing real.

---

## Verification Steps

1. **Backend migrates:** `php artisan migrate:fresh --seed` in `api/` — no errors; `csat_surveys` exists
   with the unique index.
2. **Backend tests pass:** `php artisan test` in `api/` — the five new/extended feature files green,
   every pre-existing test still green.
3. **Frontend typechecks and lints:** `npm run build` and `npm run lint` in `web/` — zero errors.
4. **Frontend tests pass:** `npx vitest run` in `web/` — new suites green, Story 02's 12 login tests and
   the shell suites unchanged.
5. **Route audit:** `php artisan route:list --path=csat` in `api/` — the two public routes show
   `signed` and `throttle:csat` and **no** `auth:sanctum`.
6. **End-to-end manual:** `php artisan serve` + `npm run dev`. Resolve a ticket as an agent, copy the
   link from the ticket-detail panel, open it in a **private window with no session**, submit a 4 with a
   comment, reload the same link (read-only recap), edit one character of the signature (expired/invalid
   card), then open Reports and confirm the CSAT widget shows a real average.

---

## Done Criteria

- [x] A ticket transitioning to Resolved creates exactly one CSAT request for that resolution cycle; a reopen-and-re-resolve never accumulates duplicate outstanding requests for the same cycle.
- [x] A submitted rating is stored against the ticket, the resolving agent (`resolved_by`), and the resolution timestamp (`resolved_at`), so Reports aggregates by agent and by period without re-deriving who resolved what.
- [x] The rating scale is a single fixed **1–5** scale, documented with its rationale in this plan, with no configurable or mixed alternative anywhere in the code.
- [x] A free-text comment is stored with the rating and is optional — a rating with no comment is a complete, valid response.
- [x] Re-opening an already-answered link shows the recorded response read-only and never silently overwrites; no update action is offered, and no endpoint exists that would perform one.
- [x] The response surface requires no login: access is via a signed, expiring, single-purpose link that grants access to that one survey only, authenticates the visitor into nothing, and exposes no internal notes or ticket history.
- [x] An expired or tampered link renders a clear expired/invalid state — never a stack trace, never a partially working form.
- [x] Reports' CSAT widget renders real aggregates computed from `csat_surveys` instead of its previous permanent Empty state, with Story 12's response shape unchanged.
- [x] A period with zero responses still renders the Empty state — zero responses is "no data", never a score of 0%.
- [ ] An agent can read their own CSAT average but has no route, policy ability, or UI control to edit or delete an individual response.
- [ ] The response page states its locale rule in code and in this plan: browser-detected with an explicit on-page override, because there is no signed-in user to read a preference from.
- [ ] All four async states ship on both the public page and the agent panel (loading / error / empty / success).
- [x] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 14.**
