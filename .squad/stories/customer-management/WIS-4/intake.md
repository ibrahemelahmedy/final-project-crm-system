> **Fetched from jira:** [WIS-4](https://ibrahemelahmedy.atlassian.net/browse/WIS-4)  
> *Fetched 2026-08-24T15:01:39.036Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Customer Management  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirements category 1. Customer profiles, contact details, interaction history (derived from their tickets), notes and attachments. Data table pattern: server-side pagination, faceted filters, filter state in URL, bulk-action bar, column visibility/reorder. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/customer-management/WIS-4/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Management
- **Feature slug (folder under `plans/`):** `customer-management`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-4` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Customer Management
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirements category 1. Customer profiles, contact details, interaction history (derived from their tickets), notes and attachments. Data table pattern: server-side pagination, faceted filters, filter state in URL, bulk-action bar, column visibility/reorder. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given an authenticated Agent or above, when they create a customer, then name and at least one contact method (email or phone) are required before saving.
- Given the Customers list, when it loads, then it uses server-side pagination and faceted filters (not client-side slicing of a fully-loaded list), and filter state is reflected in the URL.
- Given a customer profile, when opened, then it shows their interaction history — every ticket they've raised, most recent first — derived live from the Ticket entity (WIS-2), not duplicated/denormalized data that can drift out of sync.
- Given a customer profile, when an agent adds a note, then it is timestamped and attributed to that agent, and visible to any other agent who later opens the same customer.
- Given a customer profile, when an agent attaches a file, then it is size-capped and type-restricted per system configuration, and rejected attachments show a specific, actionable error (not raw stack trace / raw provider error).
- Given the Customers table, when a user toggles column visibility or reorders columns, then that preference persists for that user on next visit.
- Given a bulk selection on the Customers table, when a bulk action is taken, then a confirmation state names the number of records and the action before it executes.
- Given the same customer email/phone already exists, when a second customer is created with it, then the system either blocks the duplicate or flags it for merge review — silent duplicate customer records are not acceptable (ticket history would fragment across them).
- Given RTL (Arabic) rendering, when the Customers table displays, then column order fully mirrors and the actions column moves to the visual left.
- Given zero customers match the current filters, when the table renders, then it shows an Empty state explaining why and offering to clear filters or create a customer.
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

- **Blocked by / related ids:** WIS-1 (roles/permissions)
- **Depends on code areas or other stories:** Read-relationship to `Ticket` (WIS-2) for interaction history — Customer Management can technically ship before Ticket Management schema-wise, but the interaction-history panel needs Tickets to exist to show real data. Recommended build order: Customer entity first (WIS-2 has an FK to it), interaction-history panel wired once WIS-2 lands.

## Extra notes (optional)

- Design reference: `docs/design/references/4.Data Table/` (Customers + empty/loading states) and `5.Modals` (create/edit/confirm).
- This is the reference implementation of the "2026 data-table consensus" pattern (`docs/design/brief.md`) — Knowledge Base's article list (WIS-5) is expected to reuse the same table component.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: Laravel API, PostgreSQL — consider a partial unique index on (email) or (phone) where not null, per the project's existing PostgreSQL rationale, to support the duplicate-detection AC.
- Frontend: React/TypeScript SPA, shared DataTable component (pagination, filters-in-URL, column visibility) reused by WIS-5.

## Out of scope

- What this story explicitly does **not** cover:
- ERP or external CRM sync (client requirement category 11 — Integrations) — customer data is created/edited only inside Wisal for this story.
- The Customer Portal (customer-facing self-service login) — that is a distinct, separate, later story per `docs/requirements/client-requirements-raw.md` category 8.
- Merge/dedupe tooling beyond flagging a likely duplicate at creation time — an actual merge workflow is a later enhancement.
