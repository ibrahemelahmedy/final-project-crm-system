> **Fetched from jira:** [WIS-5](https://ibrahemelahmedy.atlassian.net/browse/WIS-5)  
> *Fetched 2026-08-24T15:01:42.236Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Knowledge Base  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirements category 6. FAQs, help articles, solutions/guides, search. Article list uses the same data-table pattern as Customers (pagination, filters, bulk actions) plus a public-style reader view. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
 (author/editor roles).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/knowledge-base/WIS-5/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Knowledge Base
- **Feature slug (folder under `plans/`):** `knowledge-base`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-5` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Knowledge Base
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirements category 6. FAQs, help articles, solutions/guides, search. Article list uses the same data-table pattern as Customers (pagination, filters, bulk actions) plus a public-style reader view. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
 (author/editor roles).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given an Administrator or authorized editor, when they create an article, then it requires a title, body, and category before it can be published.
- Given an article, when saved as Draft, then it is not visible in agent-facing search or the (future) customer-facing reader until explicitly Published.
- Given the article list, when it loads, then it uses the same server-side pagination / faceted filter / bulk-action pattern as Customers (WIS-4) — filter state reflected in the URL.
- Given an agent searching the Knowledge Base, when they enter a query, then results are ranked by relevance against title and body, and an empty result set shows an Empty state with a suggestion to broaden the search — not a blank list.
- Given an agent inside a ticket's Conversation Thread, when they search Knowledge Base articles, then they can insert a link/reference to an article into their reply without leaving the ticket (supports the "suggested solutions" workflow even without AI).
- Given an article reader view, when opened, then it renders Markdown/rich text safely (no raw HTML injection from article body — sanitize on render).
- Given RTL (Arabic) content, when an article is authored in Arabic, then the reader view respects RTL layout and the Arabic typography line-height rule from `docs/design/brief.md`.
- Given a published article is later edited, when saved, then a version/last-updated timestamp is recorded so agents can tell if guidance is stale.
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

- **Blocked by / related ids:** WIS-1 (roles/permissions — who can author vs. only read)
- **Depends on code areas or other stories:** Reuses the DataTable component built for WIS-4 (Customer Management); optional soft-link into WIS-3 (Conversation Thread) for the "insert article reference into reply" AC — can ship without it if WIS-3 isn't ready, as a standalone searchable KB.

## Extra notes (optional)

- Design reference: `docs/design/references/6.Knowledge` (index + article reader).
- This is the non-AI substitute for "suggested solutions" (client requirement category 7) — search + manual insertion now, AI-suggested articles is a later enhancement once an AI story exists.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: Laravel API, PostgreSQL — consider PostgreSQL full-text search (tsvector) for the search AC rather than a naive LIKE query, given PostgreSQL was already chosen partly for this kind of feature.
- Sanitize article body server-side before storage or on render (not just client-side) to prevent stored XSS.

## Out of scope

- What this story explicitly does **not** cover:
- The public/unauthenticated Customer Portal view of the Knowledge Base (client requirement category 8) — this story builds the internal, authenticated agent-facing KB only.
- AI-suggested articles or AI-generated summaries (client requirement category 7).
- Article commenting, ratings/feedback ("was this helpful?") — not in the client's stated 4 sub-requirements (FAQs, articles, solutions/guides, search); can be added later without a schema rework.
