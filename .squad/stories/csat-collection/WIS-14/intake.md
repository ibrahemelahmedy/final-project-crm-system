> **Fetched from jira:** [WIS-14](https://ibrahemelahmedy.atlassian.net/browse/WIS-14)  
> *Fetched 2026-08-24T20:38:48.645Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** CSAT Collection (post-resolution survey)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

The last uncovered client-requirement category 9 sub-requirement: Customer satisfaction. 
    
                
            
            WIS-7
        
                                                    To Do
            
 (Reports) has a CSAT widget with no data source — its own intake states plainly that "no CSAT survey mechanism exists anywhere else in this story slate" and that building one is "a new capability not covered by any other story". This is that story.

Scope: a rating request created when a ticket is resolved, a lightweight no-login response surface reached via a signed expiring link, and storage that 
    
                
            
            WIS-7
        
                                                    To Do
            
 aggregates.

Note there is no Customer Portal in this MVP (category 8 deferred), so the response surface must not assume a logged-in customer.

Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 (the resolution event) and feeds 
    
                
            
            WIS-7
        
                                                    To Do
            
 (the consumer).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/csat-collection/WIS-14/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** CSAT Collection (post-resolution survey)
- **Feature slug (folder under `plans/`):** `csat-collection`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-14` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
CSAT Collection (post-resolution survey)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
The last uncovered client-requirement category 9 sub-requirement: Customer satisfaction. 
    
                
            
            WIS-7
        
                                                    To Do
            
 (Reports) has a CSAT widget with no data source — its own intake states plainly that "no CSAT survey mechanism exists anywhere else in this story slate" and that building one is "a new capability not covered by any other story". This is that story.

Scope: a rating request created when a ticket is resolved, a lightweight no-login response surface reached via a signed expiring link, and storage that 
    
                
            
            WIS-7
        
                                                    To Do
            
 aggregates.

Note there is no Customer Portal in this MVP (category 8 deferred), so the response surface must not assume a logged-in customer.

Depends on 
    
                
            
            WIS-2
        
                                                    To Do
            
 (the resolution event) and feeds 
    
                
            
            WIS-7
        
                                                    To Do
            
 (the consumer).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given a ticket transitions to Resolved, when the transition commits, then exactly one CSAT request is created for that resolution cycle. A ticket that is reopened and resolved again must not accumulate duplicate outstanding requests for the same cycle.
- Given a CSAT request, when the customer responds, then the rating is stored against the ticket, the resolving agent, and the resolution timestamp — so WIS-7 can aggregate by agent and by period without re-deriving who resolved what.
- Given the rating scale, when it is implemented, then it is a single fixed scale decided and documented in the plan (1-5 stars or thumbs up/down — pick one and say why). A mixed or configurable scale makes the WIS-7 aggregate meaningless.
- Given a customer submits a rating, when they also write a free-text comment, then it is stored with the rating and is optional — a rating without a comment is a complete, valid response.
- Given a response has already been submitted, when the same link is opened again, then it does not silently overwrite. Decide in the plan whether it is read-only thereafter or offers an explicit "update your rating" action.
- Given the response surface, when a customer reaches it, then NO login is required — there is no Customer Portal in this MVP. Access is via a signed, expiring, single-purpose link that grants access to that one survey and nothing else: it must not authenticate the customer into any other part of the system, and must not expose the ticket's internal notes or history.
- Given an expired or tampered link, when opened, then it shows a clear expired/invalid state — never a stack trace, and never a partially working form.
- Given CSAT responses exist, when Reports (WIS-7) renders, then its CSAT widget shows real aggregates computed from this data instead of the Empty state it currently specifies.
- Given a period with zero responses, when Reports renders it, then it still shows an Empty state — zero responses is "no data", not a score of 0%.
- Given an agent viewing their own performance, when CSAT is shown, then they can read their average but cannot edit or delete any individual response.
- Given the response page, when it renders, then it must state which locale it uses and why — there is no signed-in user to read a language preference from (flagged as out of scope by WIS-11).
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

- **Blocked by / related ids:** WIS-2 (the Resolved transition is the trigger), WIS-7 (the consumer of this data)
- **Depends on code areas or other stories:** Build after WIS-2, and before or alongside WIS-7 — WIS-7's CSAT widget currently specifies a permanent Empty state precisely because this story did not exist.

## Extra notes (optional)

- **Origin of this story:** WIS-7's own intake says plainly that "no CSAT survey mechanism exists anywhere else in this story slate" and lists building one as explicitly out of its scope. That honesty left a real gap in client requirement category 9, which this story closes.
- This is the ONLY customer-facing surface in the entire MVP (the Customer Portal, category 8, is deferred) — so its security surface is different from every other screen and deserves specific attention in the plan.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: use Laravel signed URLs with an expiry for the survey link — do not hand-roll a token scheme.
- The survey response route must sit outside the `auth:sanctum` middleware group, and must be rate-limited independently, since it is publicly reachable.
- Store the rating as a small integer with a DB-level check constraint on the valid range, so an out-of-range value cannot be written even by a bug elsewhere.

## Out of scope

- What this story explicitly does **not** cover:
- Emailing the survey link to the customer (client requirement category 11 — Integrations). For MVP the link is generated and can be surfaced to the agent to share; automated delivery comes with the channels/integrations work.
- NPS, CES, or multi-question surveys — one rating plus one optional comment.
- A customer-facing history of their past ratings (that belongs to the Customer Portal, category 8).
- Reports UI itself (WIS-7) — this story only supplies the data it aggregates.
