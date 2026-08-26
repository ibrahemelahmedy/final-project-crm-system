> **Fetched from jira:** [WIS-3](https://ibrahemelahmedy.atlassian.net/browse/WIS-3)  
> *Fetched 2026-08-24T15:01:35.900Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Conversation Thread (Ticket Detail)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

The ticket detail view (client requirements category 3, in-app subset only — full omnichannel provider integration e.g. real WhatsApp/SMS APIs is explicitly out of scope for this story). One continuous chronological thread of every message on a ticket regardless of logged origin channel, so an agent never has to guess what came in where. Persistent side panel with ticket metadata (priority, status, SLA countdown, assigned agent, customer info) that never scrolls out of view. Reply composer. Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 (ticket must exist).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/conversation-thread/WIS-3/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Conversation Thread (Ticket Detail)
- **Feature slug (folder under `plans/`):** `conversation-thread`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-3` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Conversation Thread (Ticket Detail)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
The ticket detail view (client requirements category 3, in-app subset only — full omnichannel provider integration e.g. real WhatsApp/SMS APIs is explicitly out of scope for this story). One continuous chronological thread of every message on a ticket regardless of logged origin channel, so an agent never has to guess what came in where. Persistent side panel with ticket metadata (priority, status, SLA countdown, assigned agent, customer info) that never scrolls out of view. Reply composer. Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 (ticket must exist).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given a ticket with messages logged from multiple channels, when an agent opens the Conversation Thread, then every message renders in one continuous chronological list — never grouped or fragmented by channel.
- Given the ticket detail view, when it renders, then a persistent side panel shows priority, status, SLA countdown, assigned agent, and customer info, and stays visible while the message list scrolls (it does not scroll out of view).
- Given an agent composing a reply, when they submit it, then a new message is appended to the thread with the correct timestamp, author, and channel-of-origin tag, and the ticket's `updated_at`/last-activity is bumped.
- Given an agent, when they submit an empty reply, then submission is blocked client- and server-side with a clear inline message — no empty message is ever persisted.
- Given a ticket assigned to a different agent, when a non-supervisor agent opens it, then they can view it only if the role/permission model (WIS-1) allows it, and the specific denial reason is shown if not — never a generic error.
- Given a long thread, when it first loads, then it shows a Loading skeleton (never a blank screen) and paginates/lazy-loads older messages rather than fetching the entire history at once.
- Given the side panel's status or priority is changed from within the ticket detail view, when saved, then the change appears in ticket history (shared with WIS-2) with who changed it and when.
- Given RTL (Arabic) rendering, when the thread displays, then the metadata side panel moves to the visual left and timestamps/message bubbles still read top-to-bottom chronologically regardless of text direction.
- Given a network/save error while sending a reply, when it occurs, then the composer preserves the drafted text and shows a retryable error — the user never loses what they typed.
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

- **Blocked by / related ids:** WIS-2 (Ticket Management — a ticket must exist to have a thread), WIS-1 (roles/permissions)
- **Depends on code areas or other stories:** `Ticket` and `TicketHistory` from WIS-2; `Customer` entity (WIS-4) for the customer-info panel

## Extra notes (optional)

- Design reference: `docs/design/references/3.Conversation Thread/`. This is called out in the brief as "the highest-value screen to get right" — agents spend most of their time here.
- AI-assist (suggested reply, ticket summary) is explicitly designed to surface inline near the composer per the Intercom pattern — but building the AI feature itself is out of scope here (see below); only leave the layout slot for it.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: Laravel API (messages table FK to tickets), PostgreSQL. Frontend: React/TypeScript SPA.
- Consider cursor-based pagination for message history on long threads rather than offset pagination.

## Out of scope

- What this story explicitly does **not** cover:
- Real channel-provider integrations (actual WhatsApp/SMS/email send-and-receive) — messages are logged with a channel tag but the composer only sends through one internal reply channel for this story; wiring real providers is a later Integrations story.
- AI-generated suggested replies or ticket summaries (client requirement category 7) — the layout reserves a slot for this, but no AI call is made in this story.
- Live chat / real-time WebSocket delivery — this story is request/response; real-time push is a later enhancement, not required for MVP correctness.
