> **Fetched from jira:** [WIS-12](https://ibrahemelahmedy.atlassian.net/browse/WIS-12)  
> *Fetched 2026-08-24T20:38:42.299Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Agent Productivity — Quick Replies, Tasks & Internal Collaboration  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

The three client-requirement category 4 sub-requirements that no existing story covers: Quick replies (canned responses), Tasks and reminders, and Team collaboration (internal notes + @mentions).

Gap found during the 2026-08-24 review: 
    
                
            
            WIS-9
        
                                                    To Do
            
 (Agent Dashboard) already consumes "quick-reply shortcuts" in its acceptance criteria, but no story creates or manages them. "Tasks and reminders" and "Team collaboration" were not covered anywhere at all.

Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 (Ticket), 
    
                
            
            WIS-3
        
                                                    To Do
            
 (internal notes render in the Conversation Thread), 
    
                
            
            WIS-13
        
                                                    To Do
            
 (mentions and due reminders need the notification centre), and feeds 
    
                
            
            WIS-9
        
                                                    To Do
            
 (which surfaces tasks and quick replies).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-productivity/WIS-12/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Productivity — Quick Replies, Tasks & Internal Collaboration
- **Feature slug (folder under `plans/`):** `agent-productivity`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-12` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Agent Productivity — Quick Replies, Tasks & Internal Collaboration
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
The three client-requirement category 4 sub-requirements that no existing story covers: Quick replies (canned responses), Tasks and reminders, and Team collaboration (internal notes + @mentions).

Gap found during the 2026-08-24 review: 
    
                
            
            WIS-9
        
                                                    To Do
            
 (Agent Dashboard) already consumes "quick-reply shortcuts" in its acceptance criteria, but no story creates or manages them. "Tasks and reminders" and "Team collaboration" were not covered anywhere at all.

Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 (Ticket), 
    
                
            
            WIS-3
        
                                                    To Do
            
 (internal notes render in the Conversation Thread), 
    
                
            
            WIS-13
        
                                                    To Do
            
 (mentions and due reminders need the notification centre), and feeds 
    
                
            
            WIS-9
        
                                                    To Do
            
 (which surfaces tasks and quick replies).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
QUICK REPLIES (canned responses)
- Given an Agent composing a reply in the Conversation Thread (WIS-3), when they select a quick reply, then its body is inserted into the composer and remains fully editable before sending — selecting a quick reply never sends a message directly.
- Given an Administrator or Team Lead, when they manage quick replies, then they can create, edit, and archive them. Decide and document in the plan whether an Agent may also create personal-scope quick replies; do not leave the ownership model implicit.
- Given a quick reply containing a placeholder (e.g. customer first name, ticket id), when it is inserted, then placeholders resolve against the current ticket and customer. An unresolvable placeholder renders visibly as-is rather than silently collapsing to an empty string — a message reading "Hello ," must never reach a customer.
- Given an archived quick reply, when an agent opens the picker, then it is not offered, but messages already sent from it are unaffected.

TASKS & REMINDERS
- Given a ticket, when an agent creates a task with a due date, then it is attributed to a specific assignee (defaulting to the creator) and appears on that person's Agent Dashboard (WIS-9).
- Given a task reaches its due time, when the scheduler runs, then an in-app notification fires to its assignee via WIS-13 — reminders must fire on a schedule, not only when someone happens to open the ticket.
- Given a task is completed, when it is marked done, then who completed it and when is recorded, and it stops generating reminders.
- Given a ticket is closed with open tasks still on it, then the plan must state the chosen behaviour (auto-close the tasks, or warn the agent) — an orphaned reminder firing for a closed ticket is a defect either way.

INTERNAL COLLABORATION
- Given a ticket, when an agent adds an internal note, then it appears in the Conversation Thread visually distinct from customer-visible messages, and is NEVER included in anything sent to the customer. Enforce the visibility split server-side, not by CSS class alone.
- Given an internal note, when an agent @mentions a colleague, then that colleague receives an in-app notification (WIS-13) and the mention is recorded in ticket history.
- Given an @mention of a user who cannot access that ticket under the role model (WIS-1), when it is submitted, then it is rejected with a clear reason — mentioning someone must not become a way to leak ticket content past authorization.
- Given any customer-facing export or reply path, when it renders a ticket's history, then internal notes are excluded — assert this with an explicit test, since it is the highest-consequence failure in this story.
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

- **Blocked by / related ids:** WIS-2 (Ticket), WIS-3 (internal notes render inside the Conversation Thread), WIS-13 (mentions and due reminders need the notification centre), WIS-1 (who may mention whom follows the role model)
- **Depends on code areas or other stories:** Feeds WIS-9 (Agent Dashboard) — which already lists "quick-reply shortcuts" and a tasks surface in its acceptance criteria. Build this before or alongside WIS-9, not after, or WIS-9 ships against something that does not exist.

## Extra notes (optional)

- **Origin of this story:** the 2026-08-24 gap review found that client requirement category 4 (Agent Dashboard) has five sub-bullets, and three of them — *Tasks and reminders*, *Quick replies*, *Team collaboration* — were covered by no story at all. WIS-9 consumed quick replies without any story producing them.
- No design export exists for quick-reply management or the tasks surface; both need designing (or deliberately deferring to a simple, token-derived layout) before implementation.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: internal notes are best modelled as a `visibility` enum on the existing messages table from WIS-3 (`public` / `internal`) rather than a separate table — one chronological thread is a hard requirement of WIS-3, and two tables make that ordering harder to keep correct.
- Reminders need a scheduled job (same queue infrastructure WIS-6 introduces for SLA breach checks) — reuse it rather than adding a second scheduling mechanism.
- Placeholder resolution belongs in a service, not in the React composer — the same rendering must be reusable from a scheduled/automated context later.

## Out of scope

- What this story explicitly does **not** cover:
- AI-suggested replies (client requirement category 7) — quick replies here are human-authored templates only.
- Real-time presence or typing indicators — collaboration here is asynchronous.
- Outbound email/SMS notification of a mention or reminder (category 11) — delivery is in-app only, via WIS-13.
- Shared team inboxes or ticket following/watching by non-assigned agents — not in the client's stated sub-requirements.
