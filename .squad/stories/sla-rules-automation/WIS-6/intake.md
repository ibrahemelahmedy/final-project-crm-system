> **Fetched from jira:** [WIS-6](https://ibrahemelahmedy.atlassian.net/browse/WIS-6)  
> *Fetched 2026-08-24T15:01:45.248Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** SLA Rules & Automation  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirements category 5. Response and resolution time targets per priority tier, automatic assignment rules, escalation rules, alerts/notifications when a ticket is approaching or has breached its SLA. Admin-configured rules that drive the SLA-risk indicator already shown on the Ticket Queue (
    
                
            
            WIS-2
        
                                                    To Do
            
). Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/sla-rules-automation/WIS-6/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** SLA Rules & Automation
- **Feature slug (folder under `plans/`):** `sla-rules-automation`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-6` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
SLA Rules & Automation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirements category 5. Response and resolution time targets per priority tier, automatic assignment rules, escalation rules, alerts/notifications when a ticket is approaching or has breached its SLA. Admin-configured rules that drive the SLA-risk indicator already shown on the Ticket Queue (
    
                
            
            WIS-2
        
                                                    To Do
            
). Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given an Administrator, when they configure an SLA rule, then it specifies a response-time target and a resolution-time target per priority tier (Low/Normal/High/Urgent), matching the priority token set already defined in `docs/design/brief.md`.
- Given a new ticket is created, when no agent is explicitly chosen, then the auto-assignment rule (round-robin, load-based, or category-based — decide and document the specific algorithm in the plan) assigns it, and this decision is recorded in ticket history.
- Given a ticket's elapsed time approaches its resolution-time target (e.g. 80% consumed, threshold configurable), when the threshold is crossed, then its SLA-risk indicator changes to "at risk" wherever it appears (Ticket Queue, Conversation Thread panel, Agent Dashboard).
- Given a ticket's resolution-time target passes with no resolution, when the breach occurs, then its SLA-risk indicator changes to "breached" (using the danger token, not the same value as High priority) and an alert/notification fires to the assigned agent and their Team Lead.
- Given an SLA rule is changed, when saved, then it only applies going forward — it does not retroactively recompute risk/breach state on already-resolved tickets.
- Given an escalation rule (e.g. "Urgent unresponded for 30 min → reassign to Team Lead"), when its trigger condition is met, then the escalation action fires automatically without a human polling for it (background job / scheduled check, not a manual button).
- Given the SLA computation, when a ticket is Pending (waiting on customer), then the SLA clock pauses — pending time does not count against the agent's resolution target (a common help-desk SLA convention, must be explicit, not assumed).
- Given the same SLA state is read from two different screens at the same moment (Queue and Dashboard), then both show the same risk classification — computed from one shared source, not duplicated logic that can drift.
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

- **Blocked by / related ids:** WIS-2 (Ticket Management — the Ticket entity and its status/priority fields must exist first)
- **Depends on code areas or other stories:** Feeds the SLA-risk column already reserved in the WIS-2 Ticket Queue and the SLA countdown in the WIS-3 Conversation Thread side panel; feeds SLA-performance metrics into WIS-7 (Reports).

## Extra notes (optional)

- Design reference: `docs/design/references/7.Admin Reports` (SLA Rules admin screen).
- This is the story that makes the SLA-risk indicator (already visually designed into WIS-2/WIS-3) actually real instead of a static placeholder — sequence it early, right after Ticket Management.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: Laravel scheduled jobs/queue workers for breach detection and escalation (do not compute SLA state only on-request — a ticket nobody views should still breach and alert on schedule).
- Centralize SLA-risk computation in one backend service/query used by every screen that shows it (Queue, Thread, Dashboard, Reports) — do not reimplement the threshold math per screen.

## Out of scope

- What this story explicitly does **not** cover:
- Actual outbound alert delivery via email/SMS/WhatsApp (client requirement category 11 — Integrations) — for this story, an "alert" means an in-app notification/flag; wiring a real notification channel is later.
- AI-based smart routing/assignment — auto-assignment here is rule-based (round-robin/load/category), not ML-driven.
- Historical SLA rule versioning/audit trail beyond what WIS-8's general audit log already captures.
