> **Fetched from jira:** [WIS-17](https://ibrahemelahmedy.atlassian.net/browse/WIS-17)  
> *Fetched 2026-09-06T09:52:20.578Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** i18n String Extraction Retrofit — Complete WIS-11 Coverage  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

    
                
            
            WIS-11
        
                                                    To Do
            
 (Internationalization, AR/EN + RTL) shipped the i18n infrastructure: translation catalogues, the AR/EN language switcher, RTL mirroring, and localisation of every server-sent *_label. It also shipped the enforcement mechanism: web/scripts/i18n-allowlist.json, whose roots array lists the directories the no-hard-coded-strings check currently covers.

That roots list only contains src/app, src/i18n, src/features/auth, and src/features/sla-rules. The string-extraction pass — moving literals out of JSX and into the translation namespaces — was completed for those two feature folders only. The file's own _rootsNote field lists the remaining ten feature folders as "Pending". Every one of those folders still holds English literals not covered by the enforcement check, even though each story's Acceptance Criteria assumes full AR/RTL support.

This is a real execution gap, not a scope decision — 
    
                
            
            WIS-11
        
                                                    To Do
            
 itself is "done," but its retrofit across the codebase is not.

In scope

Extract hardcoded literals into the existing translation-namespace pattern (established in auth and sla-rules) for each of:

src/features/customers
src/features/tickets
src/features/knowledge-base
src/features/notifications
src/features/reports
src/features/users-roles-admin
src/features/agent-dashboard
src/features/agent-productivity
src/features/channels
src/features/csat

Plus src/components (shared UI), also listed as pending in the allowlist note.

Each folder's root is added to web/scripts/i18n-allowlist.json's roots array only once its literals are fully migrated — that array is the acceptance signal.

Acceptance criteria (draft — refine during planning)

	Given the i18n string-check script (npm run target backing i18n-allowlist.json), when it runs after this story, then all eleven pending roots are present in roots and the check passes with zero unlisted-literal violations.

	Given any screen in the migrated folders, when the language switcher is set to Arabic, then all user-facing text renders from the AR catalogue (no English fallback strings), matching the pattern already verified for auth and sla-rules.

	Given the existing literals/patterns exemption list, when new genuinely-non-translatable tokens are found during migration (icons, ISO codes, etc.), then they are added there with a reason, not silently left unlisted.

Out of scope

	New translatable copy/features — this is a retrofit of existing UI text only.

	Non-text RTL/layout defects — those are WIS-11's existing surface, not this story's.

	Any of the 4 deferred categories (AI, Customer Portal, Integrations/ERP, Platform multi-tenant).

Dependencies

    
                
            
            WIS-11
        
                                                    To Do
            
 (must exist and stay unchanged in its infrastructure — this story only consumes the pattern it established).

Suggested next step

Run /squad-new-story i18n-retrofit (or squad new-story i18n-retrofit) to scaffold .squad/stories/i18n-retrofit/WIS-17/intake.md, paste this description in as the tracker source, then run /squad-plan once the intake's Acceptance Criteria are finalised.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/i18n-retrofit/WIS-17/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):**
- **Feature slug (folder under `plans/`):** `i18n-retrofit`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-17` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
i18n String Extraction Retrofit — Complete WIS-11 Coverage
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Context

    
                
            
            WIS-11
        
                                                    To Do
            
 (Internationalization, AR/EN + RTL) shipped the i18n infrastructure: translation catalogues, the AR/EN language switcher, RTL mirroring, and localisation of every server-sent *_label. It also shipped the enforcement mechanism: web/scripts/i18n-allowlist.json, whose roots array lists the directories the no-hard-coded-strings check currently covers.

That roots list only contains src/app, src/i18n, src/features/auth, and src/features/sla-rules. The string-extraction pass — moving literals out of JSX and into the translation namespaces — was completed for those two feature folders only. The file's own _rootsNote field lists the remaining ten feature folders as "Pending". Every one of those folders still holds English literals not covered by the enforcement check, even though each story's Acceptance Criteria assumes full AR/RTL support.

This is a real execution gap, not a scope decision — 
    
                
            
            WIS-11
        
                                                    To Do
            
 itself is "done," but its retrofit across the codebase is not.

In scope

Extract hardcoded literals into the existing translation-namespace pattern (established in auth and sla-rules) for each of:

src/features/customers
src/features/tickets
src/features/knowledge-base
src/features/notifications
src/features/reports
src/features/users-roles-admin
src/features/agent-dashboard
src/features/agent-productivity
src/features/channels
src/features/csat

Plus src/components (shared UI), also listed as pending in the allowlist note.

Each folder's root is added to web/scripts/i18n-allowlist.json's roots array only once its literals are fully migrated — that array is the acceptance signal.

Acceptance criteria (draft — refine during planning)

	Given the i18n string-check script (npm run target backing i18n-allowlist.json), when it runs after this story, then all eleven pending roots are present in roots and the check passes with zero unlisted-literal violations.

	Given any screen in the migrated folders, when the language switcher is set to Arabic, then all user-facing text renders from the AR catalogue (no English fallback strings), matching the pattern already verified for auth and sla-rules.

	Given the existing literals/patterns exemption list, when new genuinely-non-translatable tokens are found during migration (icons, ISO codes, etc.), then they are added there with a reason, not silently left unlisted.

Out of scope

	New translatable copy/features — this is a retrofit of existing UI text only.

	Non-text RTL/layout defects — those are WIS-11's existing surface, not this story's.

	Any of the 4 deferred categories (AI, Customer Portal, Integrations/ERP, Platform multi-tenant).

Dependencies

    
                
            
            WIS-11
        
                                                    To Do
            
 (must exist and stay unchanged in its infrastructure — this story only consumes the pattern it established).

Suggested next step

Run /squad-new-story i18n-retrofit (or squad new-story i18n-retrofit) to scaffold .squad/stories/i18n-retrofit/WIS-17/intake.md, paste this description in as the tracker source, then run /squad-plan once the intake's Acceptance Criteria are finalised.
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

- Progress as of 2026-09-06: 2 of the 11 pending roots are already migrated —
  `src/features/tickets` (+ its `components/thread/` split into the `conversation` namespace)
  and the `common` extension for `src/components`. Verified via
  `web/scripts/i18n-allowlist.json` (`roots` now includes `src/components` and
  `src/features/tickets`; `_rootsNote` lists the 9 still pending: customers,
  knowledge-base, notifications, reports, users-roles-admin, agent-dashboard,
  agent-productivity, channels, csat) and via the catalogue files under
  `web/src/i18n/locales/{en,ar}/` (9 of them still ship as empty `{}`).
- The checker coverage extension (Decision 1 a–d in the prior plan) and the sla-rules
  Task-1 fallout fixes are also done — `node scripts/check-no-literals.mjs` passes today
  over 171 files / 10 roots.
- Replanning this intake should scope the remaining work to exactly these 9 roots plus
  the leftover Task 3/4/6 items that live inside them — not re-plan the 2 roots already shipped.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
