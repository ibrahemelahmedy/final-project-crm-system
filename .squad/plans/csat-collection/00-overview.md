# csat-collection — plan overview

Entry point for the **csat-collection** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 13 | [13-story-csat-collection.md](13-story-csat-collection.md) | CSAT Collection (post-resolution survey) | WIS-14 | Stories 01, 02, 04, 05, 12 |

## Dependency notes

**This story closes client-requirement category 9 (Customer satisfaction).** It exists because
Reports (WIS-7) ships a CSAT widget with no data source — its own intake states that "no CSAT survey
mechanism exists anywhere else in this story slate". Story 13 is that mechanism.

Story 13 is **contract-level (skeleton)**. It executes after code that does not exist today, so its
scope, contracts, and acceptance criteria are final while its task-level file paths and line ranges
are deliberately absent. **Regenerate it at full depth (`/squad-plan` on the same intake) immediately
before implementing.**

- **Depends on** [`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md):
  the Resolved transition and the `resolved_at` / `closed_at` lifecycle. Story 13 hooks that
  transition; it does not define it and adds no column to `tickets`.
- **Depends on** [`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md):
  the ticket-detail screen whose side panel hosts the agent-facing "copy feedback link" affordance.
  Story 13 attaches to that screen; it does not restructure it.
- **Depends on** [`../reports-dashboards/12-story-reports-dashboards.md`](../reports-dashboards/12-story-reports-dashboards.md):
  Story 13 fills the CSAT endpoint Story 12 already defined, **without changing its response shape**
  and without touching the widget's layout.
- **Shared contracts this story establishes**, which later stories consume rather than redefine:
  - Table **`csat_surveys`** — one row per resolution cycle, unique on `(ticket_id, resolution_cycle)`,
    indexed on `(resolved_by, responded_at)`, with a **DB-level CHECK `rating BETWEEN 1 AND 5`**.
  - The **1–5 rating scale is fixed and non-configurable**, with the rationale recorded in the plan.
    A mixed or configurable scale would make the WIS-7 aggregate meaningless.
  - `app/Enums/CsatSurveyState.php` — `outstanding` | `answered` | `expired`, the shared vocabulary
    between API and UI.
  - Routes **`csat.show`** / **`csat.store`** at `GET|POST /api/csat/{uuid}` — the **first public API
    routes in this project**: outside `auth:sanctum`, `signed`, and behind their own
    `throttle:csat` limiter. Renaming them invalidates every outstanding link.
  - `GET /api/tickets/{ticket}/csat` — the agent-side survey state plus a freshly minted `share_url`.
  - `web/src/features/csat/index.ts` exports `CsatResponsePage` and `TicketCsatPanel` and nothing else.
  - Public route **`/feedback/:uuid`** — outside `RequireAuth` and outside `AppLayout`.
- **Locale of the public page is browser-detected with an on-page override**, because there is no
  signed-in user to read a preference from. [`../internationalization/15-story-internationalization.md`](../internationalization/15-story-internationalization.md)
  absorbs this story's string module into the shared catalogue and **must keep that rule** — it cannot
  substitute the per-user server preference here.
- **Out of scope and owned elsewhere:** delivering the link by email or any channel (category 11 —
  Integrations); NPS/CES/multi-question surveys; a customer-facing rating history (Customer Portal,
  category 8); the Reports UI itself.
