> **Source: Jira WIS-16**, filled manually on 2026-09-02.
> The original `squad new-story` auto-fetch failed — `squad doctor` reports **tracker connectivity HTTP 401**,
> and Jira answers an unauthorised issue read with 404, which is the "not found" the scaffold recorded.
> The fields below were copied verbatim from the live issue via the Atlassian API.
> Issue: <https://ibrahemelahmedy.atlassian.net/browse/WIS-16> · last updated on Jira 2026-08-31.

---

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-portal/WIS-16/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Portal — Self-Service
- **Feature slug (folder under `plans/`):** `customer-portal`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-16`
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** *(none)*
- **Priority:** `Medium`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Customer Portal — Self-Service (Category 8)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

````
## Context

Client requirement Category 8 (`docs/requirements/client-requirements-raw.md`), deferred out of the original 9-story MVP and every dependent story since (WIS-1, WIS-4, WIS-5, WIS-8, WIS-14 all record it explicitly under "Out of scope"). Reason recorded consistently across those stories: the Customer Portal serves a **third, unauthenticated/lightly-authenticated external audience** — distinct from the three internal staff roles (Agent, Team Lead, Administrator) built in WIS-1 — and is a materially different security surface (constitution P1/P5).

This story reconciles that deferral: it is the "later story" every prior Out-of-scope note pointed to.

## Design reference

`docs/design/references/15.WisalPortalAccess-Step1/` and `16.WisalPortalAccess-Step2/` — `WisalPortalAccess-Step1-LightLTR.dc.html` / `WisalPortalAccess-Step2-LightLTR.dc.html` (+ Dark/RTL variants once generated). Covers the portal's entry/access flow only (identifier entry → OTP verification) and establishes the portal's own minimal public header (wordmark + language/theme toggles, no internal App Shell chrome) that every later portal screen (submit ticket, track requests, FAQs) must reuse. Those later screens still need their own design passes before this story's UI can be planned in full — this is the first screen only, not the whole portal.

## In scope (category 8 sub-bullets, verbatim from the client list)

* Submit tickets — a customer creates a new ticket without agent involvement
* Track requests — status/progress view of the customer's own open tickets
* View history — the customer's past tickets and resolutions
* Access FAQs — public read view of the Knowledge Base (the KB itself already exists internally via WIS-5; this exposes a customer-facing read surface)
* Submit feedback — CSAT already covers this narrowly via WIS-14's signed, expiring, single-purpose link with no login; decide during planning whether the Portal supersedes or coexists with that flow

## Explicit constraints inherited from prior stories

* Must NOT reuse the internal `users` table / Sanctum session model from WIS-1 — needs its own customer identity/auth mechanism (e.g. magic-link or OTP, per the Design reference above which specs an OTP flow), decided during planning, not assumed here.
* Must NOT expose ticket internal notes, agent-only fields, or any other customer's data — apply the same "must not expose internal notes/history" constraint WIS-14 already established for the CSAT link.
* Nav entry for "Customer Portal" already exists in the client's expected nav list (`client-requirements-raw.md` line 110) but has no route today — this story is what fills it in, external to the internal App Shell (WIS-10), not a tab inside it.

## Out of scope for this story

* AI features (Category 7) — chatbot/suggested replies on the portal
* ERP/external integrations (Category 11)
* Multi-branch/multi-department/custom branding (Category 12, partial)

## Dependencies

* WIS-2 (Ticket Management) — ticket creation/read API the portal calls
* WIS-5 (Knowledge Base) — public article read API
* WIS-14 (CSAT Collection) — existing signed-link feedback pattern to reconcile with
* WIS-11 (i18n) — portal UI must ship bilingual/RTL from day one like every other screen

## Suggested next step

Run `/squad-new-story customer-portal` (or `squad new-story customer-portal`) to scaffold `.squad/stories/customer-portal/WIS-16/intake.md`, paste this description in as the tracker source, then flesh out full Acceptance Criteria before `/squad-plan`. Design prompts for the remaining portal screens (submit ticket, track requests, FAQs) still need to be written and run before this story's UI scope is fully planned.
````

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
The Jira issue carries no Acceptance Criteria section — its own "Suggested next step" says to flesh
them out here before planning. The following are derived from its In-scope bullets and Explicit
constraints and MUST be reviewed before they are treated as final:

* Given a customer with no account, when they enter their identifier on the portal access screen and
  verify the OTP, then they are signed in to the portal WITHOUT any row being created in or read from
  the internal `users` table — the portal has its own customer identity mechanism.
* Given a signed-in portal customer, when they submit a new ticket, then it is created and appears in
  the internal Ticket Queue (WIS-2) with no agent involvement required.
* Given a signed-in portal customer, when they open "Track requests", then only their own open tickets
  are listed with status/progress — never another customer's.
* Given a signed-in portal customer, when they open their history, then only their own past tickets and
  resolutions are shown.
* Given any portal ticket view, then internal notes, agent-only fields, and any other customer's data
  are never exposed — the same constraint WIS-14 established for the CSAT link.
* Given any visitor, when they open the portal FAQs, then published Knowledge Base articles render in a
  public read view (WIS-5 owns the articles; this is a read surface only).
* Given feedback submission, then the planning decision on whether the Portal supersedes or coexists
  with WIS-14's signed expiring CSAT link is recorded and implemented consistently.
* Given any portal screen, then it renders inside the portal's own minimal public header (wordmark +
  language/theme toggles) and NOT the internal App Shell chrome (WIS-10).
* Given any portal screen in Arabic, then it renders fully translated and RTL-mirrored from day one
  (WIS-11 pattern).
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | None in `attachments/`. The design reference lives in the repo — see Technical hints below. |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** `WIS-2` (ticket create/read API the portal calls) · `WIS-5` (public article read API) · `WIS-14` (existing signed-link feedback pattern to reconcile with) · `WIS-11` (bilingual/RTL from day one) · `WIS-1` / `WIS-10` as **anti**-dependencies — the portal must NOT reuse the internal auth model or the internal App Shell.
- **Depends on code areas or other stories:** a new customer identity/auth mechanism (OTP or magic-link) that does not touch the internal `users` table or Sanctum session model; a new public route tree outside the internal shell.

## Extra notes (optional)

- ⚠️ **Design coverage is partial.** The two reference folders cover the **access flow only** (identifier entry → OTP verification). The later portal screens — submit ticket, track requests, view history, FAQs — have **no design yet**; their design prompts still need to be written and run before this story's UI scope can be planned in full.
- The four variants (Light/Dark × LTR/RTL) DO exist on disk for both access-flow steps, so the Jira text's "(+ Dark/RTL variants once generated)" caveat is stale for those two screens.
- The access screens establish the portal's own minimal public header that every later portal screen must reuse.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- **Design reference:** `docs/design/references/15.WisalPortalAccess-Step1/` and `docs/design/references/16.WisalPortalAccess-Step2/` — `WisalPortalAccess-Step{1,2}-{Light,Dark}{LTR,RTL}.dc.html`.
- Auth mechanism (magic-link vs OTP) is a planning decision; the design specs an OTP flow.

## Out of scope

- What this story explicitly does **not** cover:
  - AI features (Category 7) — chatbot/suggested replies on the portal.
  - ERP/external integrations (Category 11).
  - Multi-branch/multi-department/custom branding (Category 12, partial).
