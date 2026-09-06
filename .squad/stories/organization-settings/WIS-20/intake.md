> **Fetched from jira:** [WIS-20](https://ibrahemelahmedy.atlassian.net/browse/WIS-20)  
> *Fetched 2026-09-03T09:10:46.137Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Organization Settings — Branches, Departments & Branding (Category 12, remainder)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

Client requirement Category 12 (docs/requirements/client-requirements-raw.md): Arabic & English, Web and mobile friendly, Multi-department, Multi-branch, Custom branding. AR/EN + RTL is already fully built (
    
                
            
            WIS-11
        
                                                    To Do
            
). This story covers the remainder: multi-branch, multi-department, and custom branding — previously undesigned and unplanned, noted in the gap analysis as needing a DB schema (tenant model) decision before it could become a story.

Design reference

docs/design/references/19.WisalOrgSettings-Branding/, 20.WisalOrgSettings-Departments/, 21.WisalOrgSettings-Branches/ (+ Dark/RTL variants once generated). One tabbed Admin screen, three tabs: Branches (data table + create/edit modal), Departments (same pattern, each department belongs to exactly one branch), Branding (logo upload, primary color picker with live AA-contrast warning, live preview card).

In scope

	Admin-only "Organization" screen (new sidebar entry under Admin) inside the existing App Shell, three tabs sharing one page shell.

	Branches tab: CRUD (name, region, timezone, active/inactive status), reused data-table pattern.

	Departments tab: CRUD (name, parent branch — required, active/inactive status); UI must handle "no branch exists yet" (selector disabled with a hint).

	Branding tab: logo upload/remove, primary color override (hex + swatch) with a live WCAG AA contrast warning against white/dark backgrounds, live preview card, reset-to-default.

	Backend: branches and departments tables (department FK → branch), an organization_settings (or similar) table for logo asset reference + primary color override, applied wherever the primary color token is currently hardcoded to #4F46E5/#818CF8 in the rendered app.

	Ticket/agent assignment gains an optional branch/department association — decide the exact scope (required vs optional, backfill strategy for existing data) during planning.

Explicit constraints

	A department must belong to exactly one branch (FK not nullable once a branch exists).

	Branding changes must not break existing WCAG AA contrast guarantees elsewhere in the product — the contrast warning is a hard UX requirement, not decorative.

	Do not touch or duplicate the AR/EN language switcher (WIS-11's surface).

Out of scope for this story

	Per-branch/per-department permission matrix (a deeper RBAC extension of 
    
                
            
            WIS-8
        
                                                    To Do
            
) — this story manages the entities themselves only, not new access rules.

	Multi-tenant billing/plan-tier UI — this is internal organizational structure, not SaaS billing.

	Typography/font customization — branding here is logo + primary color only, per the client's literal bullet.

Dependencies

	
    
                
            
            WIS-8
        
                                                    To Do
            
 (Users/Roles/Admin) — Admin-only visibility gate; likely also needs a branch/department field added to user profiles (decide scope during planning).

	
    
                
            
            WIS-2
        
                                                    To Do
            
 (Ticket Management) — if ticket-to-branch association is included in this story's final scope.

	
    
                
            
            WIS-11
        
                                                    To Do
            
 (i18n) — every new string here ships bilingual/RTL from day one like every other screen.

Suggested next step

Run /squad-new-story organization-settings (or squad new-story organization-settings) to scaffold .squad/stories/organization-settings/WIS-20/intake.md, paste this description in, confirm the design folders above are finalized (all 4 variants each), then /squad-plan.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/organization-settings/WIS-20/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `organization-settings`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-20` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Organization Settings — Branches, Departments & Branding (Category 12, remainder)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Context

Client requirement Category 12 (docs/requirements/client-requirements-raw.md): Arabic & English, Web and mobile friendly, Multi-department, Multi-branch, Custom branding. AR/EN + RTL is already fully built (
    
                
            
            WIS-11
        
                                                    To Do
            
). This story covers the remainder: multi-branch, multi-department, and custom branding — previously undesigned and unplanned, noted in the gap analysis as needing a DB schema (tenant model) decision before it could become a story.

Design reference

docs/design/references/19.WisalOrgSettings-Branding/, 20.WisalOrgSettings-Departments/, 21.WisalOrgSettings-Branches/ (+ Dark/RTL variants once generated). One tabbed Admin screen, three tabs: Branches (data table + create/edit modal), Departments (same pattern, each department belongs to exactly one branch), Branding (logo upload, primary color picker with live AA-contrast warning, live preview card).

In scope

	Admin-only "Organization" screen (new sidebar entry under Admin) inside the existing App Shell, three tabs sharing one page shell.

	Branches tab: CRUD (name, region, timezone, active/inactive status), reused data-table pattern.

	Departments tab: CRUD (name, parent branch — required, active/inactive status); UI must handle "no branch exists yet" (selector disabled with a hint).

	Branding tab: logo upload/remove, primary color override (hex + swatch) with a live WCAG AA contrast warning against white/dark backgrounds, live preview card, reset-to-default.

	Backend: branches and departments tables (department FK → branch), an organization_settings (or similar) table for logo asset reference + primary color override, applied wherever the primary color token is currently hardcoded to #4F46E5/#818CF8 in the rendered app.

	Ticket/agent assignment gains an optional branch/department association — decide the exact scope (required vs optional, backfill strategy for existing data) during planning.

Explicit constraints

	A department must belong to exactly one branch (FK not nullable once a branch exists).

	Branding changes must not break existing WCAG AA contrast guarantees elsewhere in the product — the contrast warning is a hard UX requirement, not decorative.

	Do not touch or duplicate the AR/EN language switcher (WIS-11's surface).

Out of scope for this story

	Per-branch/per-department permission matrix (a deeper RBAC extension of 
    
                
            
            WIS-8
        
                                                    To Do
            
) — this story manages the entities themselves only, not new access rules.

	Multi-tenant billing/plan-tier UI — this is internal organizational structure, not SaaS billing.

	Typography/font customization — branding here is logo + primary color only, per the client's literal bullet.

Dependencies

	
    
                
            
            WIS-8
        
                                                    To Do
            
 (Users/Roles/Admin) — Admin-only visibility gate; likely also needs a branch/department field added to user profiles (decide scope during planning).

	
    
                
            
            WIS-2
        
                                                    To Do
            
 (Ticket Management) — if ticket-to-branch association is included in this story's final scope.

	
    
                
            
            WIS-11
        
                                                    To Do
            
 (i18n) — every new string here ships bilingual/RTL from day one like every other screen.

Suggested next step

Run /squad-new-story organization-settings (or squad new-story organization-settings) to scaffold .squad/stories/organization-settings/WIS-20/intake.md, paste this description in, confirm the design folders above are finalized (all 4 variants each), then /squad-plan.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```

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

- **Blocked by / related ids:** (tracker ids only; optional short note)
- **Depends on code areas or other stories:**

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
