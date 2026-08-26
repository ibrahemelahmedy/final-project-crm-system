> **Fetched from jira:** [WIS-2](https://ibrahemelahmedy.atlassian.net/browse/WIS-2)  
> *Fetched 2026-08-24T15:01:32.923Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Ticket Management (Queue)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Core ticket entity and the Ticket Queue list view (client requirements category 2). Create/track tickets, categories and priorities, assignment to agents, status and escalation, ticket history. Structured, sortable/filterable list (Zendesk pattern) — not a Kanban board, not a loose inbox. Each row shows priority, status, SLA risk, assigned agent, channel origin icon, last-updated. Server-side pagination, faceted filters (priority x status x channel x agent), filter state in URL, bulk-action bar on selection. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
 (roles must exist first).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ticket-management/WIS-2/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Ticket Management (Queue)
- **Feature slug (folder under `plans/`):** `ticket-management`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-2` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Ticket Management (Queue)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Core ticket entity and the Ticket Queue list view (client requirements category 2). Create/track tickets, categories and priorities, assignment to agents, status and escalation, ticket history. Structured, sortable/filterable list (Zendesk pattern) — not a Kanban board, not a loose inbox. Each row shows priority, status, SLA risk, assigned agent, channel origin icon, last-updated. Server-side pagination, faceted filters (priority x status x channel x agent), filter state in URL, bulk-action bar on selection. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
 (roles must exist first).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given an authenticated Agent, when they create a ticket, then it requires a customer, a category, and a priority (Low/Normal/High/Urgent) before it can be saved.
- Given a new ticket, when it is created without an explicit assignee, then it follows the auto-assignment rule from WIS-6 (or is left Unassigned if that story is not yet built) — it is never silently assigned to the creator.
- Given the Ticket Queue, when an Agent loads it, then only tickets assigned to them are returned server-side (not filtered client-side), regardless of what the UI shows for other roles.
- Given the Ticket Queue, when a Team Lead/Supervisor loads it, then they see their whole team's tickets and can reassign any ticket to any agent on their team.
- Given the Ticket Queue, when any user applies a filter (priority, status, channel, agent), then the filter state is reflected in the URL so the view is shareable/bookmarkable and survives a page refresh.
- Given a queue with more rows than one page, when the user scrolls/pages, then pagination is server-side (not client-side slicing of a fully-loaded list).
- Given a ticket's status, when it changes (Open → Pending → Resolved, or any escalation), then the change is recorded in ticket history with who changed it and when.
- Given a ticket is Resolved, when 5 more days pass with no further customer reply (or per configured rule), then it is eligible for auto-close — this rule itself belongs to WIS-6, but the Ticket entity must expose the fields (resolved_at, closed_at) this depends on.
- Given the Ticket Queue on a small/mobile viewport, when displayed, then priority, status, and SLA-risk remain visible per row (per client requirement 12: web and mobile friendly) — not hidden behind a drill-in with no indicator.
- Given the queue in RTL (Arabic), when rendered, then column order fully mirrors and the SLA-risk/priority indicators keep their color meaning (color is not a directional property).
- Given zero tickets match the current filters, when the queue renders, then it shows an Empty state explaining why and offering to clear filters — never a blank table.
- Given a bulk selection of rows, when the user chooses a bulk action (assign, close), then a confirmation state names the number of records and the action, and the action is server-validated per-row (a row the user lacks permission for is skipped, not silently applied).
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| *(e.g. `attachments/flow.png`)* | *(e.g. UX flow)* |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** WIS-1 (Authentication & Access Control — roles must exist before ticket assignment/queue scoping can be enforced)
- **Depends on code areas or other stories:** Customer entity (WIS-4) for the ticket→customer relation; SLA Rules (WIS-6) for the auto-assignment and SLA-risk calculation logic (the queue can render an SLA-risk column with a stubbed/manual value until WIS-6 lands, but the column and its token must exist now)

## Extra notes (optional)

- Design reference: `docs/design/references/2.ticket-queue/`. Priority and status are separate token sets (`docs/design/brief.md`) — never conflate them into one badge.
- This story owns the core `Ticket` entity/migration; every later story (Conversation Thread, SLA Rules, Reports) reads or writes through it.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: Laravel API, PostgreSQL. Frontend: React/TypeScript SPA.
- Ticket Queue screen must implement all 4 required states (Loading skeleton, Empty, Error, Success) per `docs/design/brief.md` "Required states per view".
- Role-based query scoping (Agent sees only their own tickets) must be enforced in the backend query layer, not filtered in the frontend.

## Out of scope

- What this story explicitly does **not** cover:
- The Conversation Thread / message timeline inside a ticket (WIS-3).
- Real inbound-channel integrations (actual email/WhatsApp/SMS/webform ingestion) — the channel field is a static enum for now, populated manually or by a stub; wiring a real provider is a later Integrations story (client requirement category 11).
- SLA rule configuration UI and the automatic escalation engine itself (WIS-6) — this story only exposes the fields/column that WIS-6 will drive.
- AI-based auto-categorization or suggested replies (client requirement category 7) — explicitly deferred, no AI story exists yet in this MVP slice.
