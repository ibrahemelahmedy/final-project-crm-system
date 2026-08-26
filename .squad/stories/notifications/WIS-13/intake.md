> **Fetched from jira:** [WIS-13](https://ibrahemelahmedy.atlassian.net/browse/WIS-13)  
> *Fetched 2026-08-24T20:38:45.541Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Notifications Centre (in-app)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirement category 5, "Alerts and notifications" — the display half. 
    
                
            
            WIS-6
        
                                                    To Do
            
 generates SLA at-risk/breach alerts and 
    
                
            
            WIS-12
        
                                                    To Do
            
 generates @mentions and due reminders, but until now nothing in the product displayed them to a user.

In-app notification centre: a bell in the App Shell header with an accurate unread count, a paginated list with read/unread state, and deep links back to the source record.

Depends on 
    
                
            
            WIS-10
        
                                                    To Do
            
 (the bell lives in the shell header) and its producers 
    
                
            
            WIS-6
        
                                                    To Do
            
 and 
    
                
            
            WIS-12
        
                                                    To Do
            
.

Out of MVP scope and deliberately so: outbound email/SMS/WhatsApp delivery (category 11 — Integrations) and real-time WebSocket push.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/notifications/WIS-13/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Notifications Centre (in-app)
- **Feature slug (folder under `plans/`):** `notifications`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-13` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Notifications Centre (in-app)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirement category 5, "Alerts and notifications" — the display half. 
    
                
            
            WIS-6
        
                                                    To Do
            
 generates SLA at-risk/breach alerts and 
    
                
            
            WIS-12
        
                                                    To Do
            
 generates @mentions and due reminders, but until now nothing in the product displayed them to a user.

In-app notification centre: a bell in the App Shell header with an accurate unread count, a paginated list with read/unread state, and deep links back to the source record.

Depends on 
    
                
            
            WIS-10
        
                                                    To Do
            
 (the bell lives in the shell header) and its producers 
    
                
            
            WIS-6
        
                                                    To Do
            
 and 
    
                
            
            WIS-12
        
                                                    To Do
            
.

Out of MVP scope and deliberately so: outbound email/SMS/WhatsApp delivery (category 11 — Integrations) and real-time WebSocket push.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given any notification-generating event (SLA at-risk or breached from WIS-6; @mention or due task reminder from WIS-12), when it fires, then a notification row is persisted for the target user — not merely pushed to a live session that may not exist. A user offline at the moment of an SLA breach must still see it on next login.
- Given the App Shell header, when a user has unread notifications, then the bell shows an unread count that is correct after a full page refresh — the count is server-derived, never client-only state.
- Given a notification, when the user activates it, then it navigates to the source record (the specific ticket, the specific SLA rule) and is marked read as a result of that navigation.
- Given the notification list, when it loads, then it is paginated server-side and filterable by read/unread — this table grows unbounded and must never be fetched in full.
- Given a user chooses "mark all as read", when it executes, then only their own notifications are affected, and running it twice produces the same result as running it once.
- Given a user has zero notifications, when the panel opens, then it shows an Empty state explaining that there is nothing to see, not a blank panel.
- Given a notification whose source record was deleted or is no longer visible to that user under the role model, when they activate it, then they get a clear "no longer available" state — never a raw 404 or a leak of a record they may not see.
- Given a user is deactivated (WIS-8), when notifications would be delivered to them, then nothing is delivered onward to that disabled account.
- Given RTL and both themes, when the bell and panel render, then they mirror and theme consistently with the rest of the shell.
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

- **Blocked by / related ids:** WIS-10 (the bell occupies a slot the App Shell header reserves), WIS-6 and WIS-12 (the two producers)
- **Depends on code areas or other stories:** Can be built with only WIS-6 as a producer if WIS-12 is not ready — design the notification type as an open enum so WIS-12's mention/reminder types drop in without a schema change.

## Extra notes (optional)

- **Origin of this story:** the 2026-08-24 gap review found WIS-6 creating "in-app notifications" with no screen anywhere in the product that displays them — the alert half of client requirement category 5 was written, the display half was not.
- No design export exists for the bell panel; it needs designing or a deliberate token-derived layout consistent with the shell header.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: Laravel's built-in notifications table is a reasonable base, but the `type` values must be this product's domain events, not framework class names leaking into the API contract.
- Frontend: the unread count is server state — it belongs in TanStack Query with a sensible refetch interval, NOT in a global store (per the frontend architecture reference: server state never lives in a global store).
- Index on `(user_id, read_at)` — the unread-count query runs on every page load for every user.

## Out of scope

- What this story explicitly does **not** cover:
- Outbound delivery by email, SMS, or WhatsApp (client requirement category 11 — Integrations). Everything here is in-app.
- Real-time WebSocket push. Polling / refetch-on-load is sufficient for MVP; state this explicitly in the plan so it reads as a decision rather than an omission.
- Per-user notification preferences (mute types, digest schedules) — a later enhancement once there is evidence of notification volume being a problem.
