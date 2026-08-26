> **Fetched from jira:** [WIS-8](https://ibrahemelahmedy.atlassian.net/browse/WIS-8)  
> *Fetched 2026-08-24T15:01:51.405Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Users & Roles Administration  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Client requirements category 10, the subset not already covered by 
    
                
            
            WIS-1
        
                                                    To Do
            
 (login/auth itself). Admin CRUD for internal users, role assignment (Agent/Team Lead/Administrator), permission management, audit log viewer, system configuration screens. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/users-roles-admin/WIS-8/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Users & Roles Administration
- **Feature slug (folder under `plans/`):** `users-roles-admin`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-8` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Users & Roles Administration
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Client requirements category 10, the subset not already covered by 
    
                
            
            WIS-1
        
                                                    To Do
            
 (login/auth itself). Admin CRUD for internal users, role assignment (Agent/Team Lead/Administrator), permission management, audit log viewer, system configuration screens. Depends on 
    
                
            
            WIS-1
        
                                                    To Do
            
.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given an Administrator, when they create a new internal user, then they must assign exactly one role (Agent, Team Lead/Supervisor, or Administrator) — a user is never role-less.
- Given an Administrator, when they deactivate a user, then that user can no longer log in (enforced by WIS-1's login check) but their historical ticket/audit records remain intact and attributed to them.
- Given an Administrator deactivates a user who is currently signed in, when the deactivation is saved, then all of that user's active Sanctum tokens (`personal_access_tokens` rows) are revoked immediately — their next request returns 401, not just their next login attempt. (WIS-1's plan explicitly deferred this to WIS-8 — see `// Story: Users admin` comment at the `is_active` check in `AuthenticatedSessionController` — so it must land here, not be silently dropped.)
- Given an Administrator changes a user's role, when saved, then the change takes effect on the user's next request (not just next login) — a currently-logged-in user does not retain stale elevated permissions.
- Given any sensitive action (user created/deactivated, role changed, SLA rule changed, permission changed), when it occurs, then it is written to the audit log with actor, action, target, and timestamp — the audit log itself is never editable or deletable through the UI.
- Given an Administrator, when they open the audit log viewer, then it is filterable by actor, action type, and date range, and paginated server-side (audit logs grow unbounded).
- Given a non-Administrator (Agent or Team Lead), when they attempt to reach any Users/Admin screen or its API endpoints directly, then access is denied server-side regardless of what the frontend nav shows.
- Given system configuration screens (e.g. password policy thresholds referenced in WIS-1), when an Administrator changes a value, then the new value is validated (e.g. min length can't be set to 0) before saving.
- Given the Users list, when it loads, then it uses the same server-side pagination/filter pattern as Customers (WIS-4) for consistency.
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

- **Blocked by / related ids:** WIS-1 (Authentication & Access Control — this story extends the same `User`/role model with admin CRUD; do not redesign the role model here, build on WIS-1's)
- **Depends on code areas or other stories:** Audit log here is the shared audit trail also referenced by WIS-6 (SLA rule changes) and any other admin action across the app — build it as one shared service, not per-feature logging.

## Extra notes (optional)

- Design reference: `docs/design/references/7.Admin Reports` (Users screen).
- WIS-1's intake already scoped "login, access control, and admin security settings" (category 10) as its concern; this story is explicitly the CRUD/management layer on top of that — read WIS-1's plan before starting this one to avoid re-deciding the role model.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Backend: Laravel API, PostgreSQL — audit log as an append-only table (no UPDATE/DELETE grants at the DB role level, not just app-level, if feasible) so "never editable" is enforced structurally.
- Role/permission checks belong in a policy/middleware layer shared with every other story (WIS-2 through WIS-9 all depend on this being correct and centralized, not reimplemented per controller).
- Token revocation on deactivate: `$user->tokens()->delete()` (all of them, unlike WIS-1's logout which deletes only `currentAccessToken()`) inside the same transaction that flips `is_active`. Do this in the User update/deactivate service method, not the controller.

## Out of scope

- What this story explicitly does **not** cover:
- Building the login/session mechanism itself (cookie vs. token Sanctum mode) — that is WIS-1's concern; this story only manages users/roles once auth already exists.
- Fine-grained per-record permission overrides (e.g. "this specific Agent can also see this one other agent's tickets") — the role model is role-based (RBAC), not per-record ACLs, for MVP scope.
- The Customer Portal's separate, lightly-authenticated user model (client requirement category 8) — that is a distinct audience/table, not part of this internal-staff admin story.
