> **Fetched from jira:** [WIS-15](https://ibrahemelahmedy.atlassian.net/browse/WIS-15)  
> *Fetched 2026-08-24T20:38:51.853Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Channels Overview (read-only)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Closes the broken "Channels" nav item found during the 2026-08-24 review. The built App Shell (docs/design/references/1.app-shell) ships a Channels nav item, but no story or design existed for the destination — so shipping the current story slate would leave a link to a non-existent page.

Real channel integration (Email/WhatsApp/Live chat/SMS/Web forms) is deliberately out of MVP scope (category 11 — Integrations). Rather than remove the nav item the client explicitly asked for (category 3), this story builds an honest read-only overview: the five recognised channels, an explicit "not connected" status for each, and real per-channel ticket volume derived from the Ticket channel field.

The point is to make the architecture visible without fabricating working integrations. No screen may imply ingestion works when it does not.

Depends on 
    
                
            
            WIS-10
        
                                                    To Do
            
 (renders in the shell) and 
    
                
            
            WIS-2
        
                                                    To Do
            
 (the channel field on tickets).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/channels-overview/WIS-15/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Channels Overview (read-only)
- **Feature slug (folder under `plans/`):** `channels-overview`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-15` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Channels Overview (read-only)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Closes the broken "Channels" nav item found during the 2026-08-24 review. The built App Shell (docs/design/references/1.app-shell) ships a Channels nav item, but no story or design existed for the destination — so shipping the current story slate would leave a link to a non-existent page.

Real channel integration (Email/WhatsApp/Live chat/SMS/Web forms) is deliberately out of MVP scope (category 11 — Integrations). Rather than remove the nav item the client explicitly asked for (category 3), this story builds an honest read-only overview: the five recognised channels, an explicit "not connected" status for each, and real per-channel ticket volume derived from the Ticket channel field.

The point is to make the architecture visible without fabricating working integrations. No screen may imply ingestion works when it does not.

Depends on 
    
                
            
            WIS-10
        
                                                    To Do
            
 (renders in the shell) and 
    
                
            
            WIS-2
        
                                                    To Do
            
 (the channel field on tickets).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given the Channels nav item in the App Shell, when a user activates it, then it navigates to a real, rendered screen — the acceptance test for this story is fundamentally that no nav item in the shipped product leads nowhere.
- Given the Channels screen, when it renders, then it lists the five channels named in client requirement category 3 — Email, WhatsApp, Live chat, SMS, Web forms — each with an explicit connection status.
- Given a channel with no integration configured (which, in this MVP, is all five), when it renders, then its status reads unambiguously as not connected. It must NOT display a fabricated "Connected", a fake uptime figure, or a mocked health indicator — a screen that implies working ingestion when there is none is worse than no screen.
- Given tickets exist carrying a channel of origin (the enum field owned by WIS-2), when the screen renders, then per-channel ticket counts for a selectable period are shown, computed from real ticket rows.
- Given zero tickets in the selected period, when counts render, then they show an Empty state rather than zeros presented as if they were a measurement.
- Given an Agent (non-administrator), when they open Channels, then the screen is entirely read-only with no configuration affordance.
- Given an Administrator, when they open Channels, then any configuration entry point states plainly that integration is not yet available in this release — it does not present a form that cannot work.
- Given the screen in RTL and in both themes, when it renders, then it mirrors and themes consistently with the rest of the shell.
- Given the data is still loading, then the screen shows a skeleton; given the request fails, then it shows a retryable error state.
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

- **Blocked by / related ids:** WIS-10 (renders inside the App Shell and closes its Channels nav item), WIS-2 (reads the channel-of-origin field on tickets)
- **Depends on code areas or other stories:** Small story; can be built any time after WIS-10 and WIS-2. It should not ship later than the shell, or the product ships with a broken link in the meantime.

## Extra notes (optional)

- **Origin of this story:** the 2026-08-24 gap review found that the built App Shell design ships a "Channels" nav item, but no story and no design existed for its destination. Two options were considered: remove the nav item, or build an honest placeholder screen.
- **Decision taken:** build the read-only overview. Removing the nav item would signal the capability does not exist at all, when in fact the ticket model already records channel-of-origin and the architecture is ready for integration; a status screen communicates "ready, not yet connected" truthfully. Record this reasoning in the plan so a later reader does not mistake the screen for unfinished work.
- No design export exists for this screen — it needs designing, or a deliberate token-derived layout reusing the existing card/table patterns.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- The channel list should be derived from the same enum WIS-2 defines for the ticket `channel` column — do not hard-code a second, parallel list that can drift out of sync with the one tickets actually use.
- Per-channel counts are an aggregate query (`GROUP BY channel`) over a date range; do not fetch tickets and count them client-side.

## Out of scope

- What this story explicitly does **not** cover:
- Actually connecting any provider — Email, WhatsApp, SMS, Live chat, or Web forms (client requirement category 11 — Integrations). That is a separate, later story per channel or per provider.
- Inbound message ingestion, webhook receivers, or channel-specific composer behaviour.
- A live-chat widget for embedding on a customer's website.
- Any credential entry or OAuth flow for a provider.
