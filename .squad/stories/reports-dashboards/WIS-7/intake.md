> **Fetched from jira:** [WIS-7](https://ibrahemelahmedy.atlassian.net/browse/WIS-7)  
> *Fetched 2026-08-24T15:01:48.265Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Reports & Management Dashboards  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirements category 9. Ticket reports, SLA performance, agent performance, customer satisfaction (CSAT), management dashboards. Calm/low-density layout (Linear/Notion pattern) — a small number of decisions surfaced, not every metric available. Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 and 
    
                
            
            WIS-6
        
                                                    To Do
            
 (needs ticket and SLA data to report on).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/reports-dashboards/WIS-7/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Reports & Management Dashboards
- **Feature slug (folder under `plans/`):** `reports-dashboards`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-7` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Reports & Management Dashboards
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirements category 9. Ticket reports, SLA performance, agent performance, customer satisfaction (CSAT), management dashboards. Calm/low-density layout (Linear/Notion pattern) — a small number of decisions surfaced, not every metric available. Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 and 
    
                
            
            WIS-6
        
                                                    To Do
            
 (needs ticket and SLA data to report on).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given a Team Lead/Supervisor or Administrator, when they open Reports, then they see ticket-volume, SLA-performance (breach rate, average resolution time), and agent-performance (tickets resolved, average handle time) figures for a selectable date range.
- Given an Agent (not Team Lead/Administrator), when they attempt to open Reports, then access is denied server-side — Reports is not exposed to the Agent role per the role model in WIS-1.
- Given a selected date range, when applied, then all figures on the page recompute for that range consistently (no widget silently showing a different, stale range than the others).
- Given the SLA-performance figures, when computed, then they read from the same SLA-risk/breach source of truth built in WIS-6 — not a separately reimplemented calculation that could disagree with the Ticket Queue's live indicator.
- Given customer satisfaction (CSAT) is not yet collected anywhere in the MVP (no survey/rating mechanism exists in WIS-2/WIS-3), then the CSAT widget shows an explicit Empty state ("no CSAT data collected yet") rather than a fabricated or zeroed chart.
- Given the dashboard, when it renders, then it follows the "calm layout" rule from `docs/design/brief.md` — a small, named set of decisions (my team's SLA risk today, resolution trend), not every metric the schema could produce.
- Given a report figure is based on zero underlying data (e.g. a brand-new deployment with no tickets yet), then it shows an Empty state, not a misleading 0%/0.0 that looks like a real measurement.
- Given the dashboard is viewed in RTL (Arabic), when charts render, then chart directionality and legends are checked for RTL-appropriateness (numeric axes typically stay LTR even in an RTL layout — this must be a deliberate decision in the plan, not left to a charting library's default).
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

- **Blocked by / related ids:** WIS-2 (Ticket Management), WIS-6 (SLA Rules & Automation — Reports reads its breach/risk calculations)
- **Depends on code areas or other stories:** Should be sequenced last among the reporting-adjacent stories, since it aggregates data produced by WIS-2 and WIS-6.

## Extra notes (optional)

- Design reference: `docs/design/references/7.Admin Reports` (Reports charts).
- No CSAT survey mechanism exists anywhere else in this story slate — flag this explicitly in the plan rather than quietly fabricating fake CSAT numbers to fill the widget.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: consider precomputed/materialized aggregates (or a scheduled rollup job) for performance rather than computing agent-performance stats from raw ticket rows on every page load, if ticket volume is expected to grow.
- Frontend: pick one charting library and note the choice + why in the plan; check its RTL/axis-direction behavior before committing to it.

## Out of scope

- What this story explicitly does **not** cover:
- Building the actual CSAT collection mechanism (a post-resolution survey) — that is a new capability not covered by any other story in this slate; Reports only displays it once/if it exists.
- Exporting reports to PDF/Excel — not in the client's stated 5 sub-requirements (ticket reports, SLA performance, agent performance, CSAT, management dashboards); can be added later.
- Real-time/live-updating dashboards — periodic refresh (on load / manual refresh) is sufficient for MVP; WebSocket-pushed live metrics are a later enhancement.
