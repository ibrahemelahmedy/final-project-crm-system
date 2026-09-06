# customer-portal — plan overview

Entry point for the **customer-portal** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 17 | [17-story-customer-portal.md](17-story-customer-portal.md) | Customer Portal — Self-Service (Category 8) | WIS-16 | 03 customers · 04 tickets · 05 thread · 09 knowledge-base · 13 CSAT · 15 i18n · **coordinate with** 16 i18n-retrofit (WIS-17) |

**Numbering note.** This story was first drafted as `16`; WIS-17 (`i18n-retrofit`) took that number
in a parallel planning session. `naming.globalSequence` is `true`, so it moved to `17`. The
`16-story-customer-portal.md` draft has been deleted — it derived its scope from the requirements
doc because the intake was blank at the time, and Story 17 supersedes it from the real tracker text.

## Dependency notes

This is the **third audience** in the product. Stories 01–16 serve three internal staff roles
(Agent, Team Lead, Administrator) behind `auth:sanctum`; this feature serves external customers.
`docs/requirements/client-requirements-raw.md` (the "Conflict with prior work" table) records it as
*"a materially different security surface"*, and the intake names **WIS-1 and WIS-10 as explicit
anti-dependencies** — the portal must not reuse the internal auth model or the internal App Shell.

**Sequencing.** It depends on almost everything before it: it is a customer-facing projection of
ticketing (04, 05), the Knowledge Base (09), and CSAT (13). It cannot be pulled earlier without
stubbing all three.

**Coordinate with WIS-17** ([`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md)):
that story *widens* `web/scripts/check-no-literals.mjs` and explicitly excludes the Customer Portal
from its migration, so `src/features/portal` is this story's responsibility. Whichever lands second
owns satisfying the other's checker. The PR must say which order happened.

## Planning decisions recorded in the story

The intake defers three decisions to planning and makes recording one of them an acceptance
criterion. All are settled in the story file; these two are the ones other stories will cite:

- **Decision 1 — OTP, not magic link.** The design is already built for it, it degrades gracefully
  while Category 11 is deferred, and it works for a phone identifier.
- **Decision 2 — the portal coexists with WIS-14's CSAT link; it does not supersede it.** Superseding
  would break the no-login answer path and fork the `csat_surveys` writer. The portal surfaces
  Story 13's signed link via a nullable `feedback_url` and builds no survey UI.

**⚠️ Decision 5 is the one to confirm before implementing.** AC1's *"a customer with no account"* is
read as *no **staff** account* — the person already exists as a `customers` row. **Customer
self-registration is out of scope.** The design's own copy (*"If this matches a record, we've sent a
code"*) supports that reading, but if the client meant an unknown member of the public can arrive and
create their own record, that is a separate story; the story file quotes the delta.

**Decision 3 — partial design coverage, handled explicitly.** Only the access flow is designed
(eleven artboards across `docs/design/references/15.` and `16.`, all four Light/Dark × LTR/RTL
variants — the Jira text's "once generated" caveat is stale). The five post-access screens are
specified by behaviour, data, states and tests, and built from the design system; a later design pass
may change layout but not the API shapes, URLs, four async states, or the open/past split.

## Contracts owned here

See the story's *Shared contracts* section for full definitions.

- Tables **`portal_access_codes`** and **`portal_sessions`** — a customer identity that is
  deliberately *not* a `users` row and *not* a `personal_access_tokens` row, so a portal token is
  structurally incapable of authenticating a staff route. That property is what AC1 reduces to.
- Middleware alias **`portal`** (`App\Http\Middleware\PortalAuth`), the route prefix
  **`/api/portal/*`** with names `portal.*`, and the two named limiters `portal-access` and `portal`.
- `GET /api/portal/requests?scope=open|past` — **one endpoint, two scopes**, serving the intake's two
  separate criteria (track requests vs view history).
- Resources **`PortalTicketResource`**, **`PortalMessageResource`**, **`PortalArticleResource`** —
  narrow projections with frozen key sets. New classes on purpose: no `when()`-stripped variant of
  `TicketResource` is used, because that is how an internal field eventually leaks.
- SPA routes **`/portal/*`** and the i18next namespace **`portal`**.

## What it reads but does not own

`customers` (Story 03, including `normalizePhone()` and `phoneMatchCandidates()`); `tickets` /
`ticket_events` / `TicketStatus` (Story 04); `ticket_messages` and
`TicketMessage::scopePublicOnly()` (Stories 05 and 10 — the enforcement point for the
public/internal split, which exists for exactly this surface and is how AC5 is met); `kb_articles`
and the sanitized `body_html` write path (Story 09); `csat_surveys` and the signed
`/feedback/{uuid}` page (Story 13). `Channel::WebForm` already exists, so Story 14's Channels
Overview counts portal tickets with no change.

## Cross-story edit

One: Story 13's `CsatSurveyController::shareUrl()` is extracted into `App\Services\CsatShareLink`
so the agent panel and the portal mint the same signed link (Decision 2). It must stay
byte-identical — the `csat.show` / `csat.store` route names are the signing key, and renaming either
invalidates every outstanding customer feedback link.

## Known gap carried deliberately

OTP delivery is mail-only behind a `PortalCodeNotifier` seam, because Category 11 (Integrations —
Email, SMS & WhatsApp) is out of scope per the intake. A customer with a phone number but no email
never receives a code. Recorded in `docs/decisions/ADR-005-customer-portal-access.md`, which this
story creates.
