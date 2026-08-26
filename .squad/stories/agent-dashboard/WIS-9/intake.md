> **Fetched from jira:** [WIS-9](https://ibrahemelahmedy.atlassian.net/browse/WIS-9)  
> *Fetched 2026-08-24T15:01:54.417Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Agent Dashboard (Role-Based Home)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirements category 4, plus the design brief's "Role-based home" pattern. Landing page whose content differs by role, not just widget visibility: Agent sees their assigned queue + tickets nearing SLA breach + quick-reply shortcuts; Team Lead/Supervisor sees team queue + workload balance + escalations; Administrator sees user management + SLA rule configuration + audit log entry points. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
, 
    
                
            
            WIS-2
        
                                                    To Do
            
, 
    
                
            
            WIS-6
        
                                                    To Do
            
.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-dashboard/WIS-9/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Agent Dashboard (Role-Based Home)
- **Feature slug (folder under `plans/`):** `agent-dashboard`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-9` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Agent Dashboard (Role-Based Home)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirements category 4, plus the design brief's "Role-based home" pattern. Landing page whose content differs by role, not just widget visibility: Agent sees their assigned queue + tickets nearing SLA breach + quick-reply shortcuts; Team Lead/Supervisor sees team queue + workload balance + escalations; Administrator sees user management + SLA rule configuration + audit log entry points. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
, 
    
                
            
            WIS-2
        
                                                    To Do
            
, 
    
                
            
            WIS-6
        
                                                    To Do
            
.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given an Agent logs in, when they land on the home screen, then they see their own assigned queue, tickets approaching SLA breach, and quick-reply shortcuts — content, not just widget visibility, differs from the other two roles.
- Given a Team Lead/Supervisor logs in, when they land on the home screen, then they see their team's queue, a workload-balance view across agents, and current escalations — not the single-agent view an Agent sees.
- Given an Administrator logs in, when they land on the home screen, then they see entry points into user management, SLA rule configuration, and the audit log — not a ticket queue at all.
- Given the dashboard, when it renders, then every widget on it maps to a specific named user need from the design brief's role list above — no widget is added "because the data was available."
- Given the "tickets approaching SLA breach" widget, when it renders, then it reads from the same SLA-risk source built in WIS-6 — not a separately reimplemented threshold check.
- Given the dashboard on first load, when data is still fetching, then each widget shows its own Loading skeleton independently (a slow widget does not block the rest of the page from rendering).
- Given a role has zero relevant items (e.g. a brand-new Agent with no assigned tickets yet), then the relevant widget shows an Empty state with a clear next action (e.g. "no tickets assigned yet") — not an error or a misleading zero.
- Given RTL (Arabic), when the dashboard renders, then layout mirrors consistently with the rest of the app (App Shell nav, widget order).
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

- **Blocked by / related ids:** WIS-1 (roles), WIS-2 (Ticket Queue data), WIS-6 (SLA-risk data)
- **Depends on code areas or other stories:** This is a composition/aggregation story — it should be built last among the "core loop" stories (after WIS-1, WIS-2, WIS-6 exist) since every widget on it reads data owned by those stories rather than introducing new data of its own.

## Extra notes (optional)

- Design reference: `docs/design/references/1.app-shell` for the shell this renders inside, plus the "Role-based home" section of `docs/design/brief.md`.
- Explicitly guarded against widget-creep per the brief's anti-pattern list: a widget is added only when a specific user need names it.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Frontend: React/TypeScript SPA — role-based composition (render a different widget set per role) rather than one giant component with role-conditional branches everywhere; keep each role's view independently testable.
- Each widget should hit its own scoped API endpoint so one slow widget doesn't block the others (supports the independent-loading-skeleton AC above).

## Out of scope

- What this story explicitly does **not** cover:
- Team Lead escalation *actions* (reassigning, resolving) beyond surfacing the list — actually acting on an escalation happens in the Ticket Queue/Conversation Thread (WIS-2/WIS-3), this dashboard only surfaces and links to it.
- Any new metric/report not already produced by WIS-2 or WIS-6 — full analytics belong in WIS-7 (Reports), this dashboard is a small, curated subset per the "calm layout" rule.
