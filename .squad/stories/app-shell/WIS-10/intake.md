> **Fetched from jira:** [WIS-10](https://ibrahemelahmedy.atlassian.net/browse/WIS-10)  
> *Fetched 2026-08-24T20:38:35.877Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Application Shell & Navigation  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

The persistent chrome every authenticated screen renders inside: sidebar navigation (Dashboard, Tickets, Customers, Knowledge Base, Channels, Reports, SLA Rules, Users), header with the signed-in user + role, theme toggle, and the language-switcher slot. Role-aware nav visibility (UX only — server-side authorization remains the real boundary).

WIS-1's plan explicitly deferred this: "The app shell itself is not built here beyond a placeholder... The full shell is a later story." This is that story. Every other UI story (
    
                
            
            WIS-2
        
                                                    To Do
            
 through 
    
                
            
            WIS-9
        
                                                    To Do
            
) renders inside this shell, so it must land immediately after 
    
                
            
            WIS-1
        
                                                    To Do
            
.

Design already exists: docs/design/references/1.app-shell (4 variants: Light/Dark x LTR/RTL).

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/app-shell/WIS-10/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Application Shell & Navigation
- **Feature slug (folder under `plans/`):** `app-shell`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-10` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Application Shell & Navigation
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
The persistent chrome every authenticated screen renders inside: sidebar navigation (Dashboard, Tickets, Customers, Knowledge Base, Channels, Reports, SLA Rules, Users), header with the signed-in user + role, theme toggle, and the language-switcher slot. Role-aware nav visibility (UX only — server-side authorization remains the real boundary).

WIS-1's plan explicitly deferred this: "The app shell itself is not built here beyond a placeholder... The full shell is a later story." This is that story. Every other UI story (
    
                
            
            WIS-2
        
                                                    To Do
            
 through 
    
                
            
            WIS-9
        
                                                    To Do
            
) renders inside this shell, so it must land immediately after 
    
                
            
            WIS-1
        
                                                    To Do
            
.

Design already exists: docs/design/references/1.app-shell (4 variants: Light/Dark x LTR/RTL).
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
- Given an authenticated user, when any protected route renders, then it renders inside the shell (sidebar + header) — every screen except /login lives inside this chrome, and no feature story re-implements its own chrome.
- Given the sidebar, when it renders, then it shows exactly the eight nav items the built design specifies: Dashboard, Tickets, Customers, Knowledge Base, Channels, Reports, SLA Rules, Users — no nav item points at a route that does not exist.
- Given an Agent, when the sidebar renders, then Administrator-only items (SLA Rules, Users) are not shown. State explicitly in the plan that this is a UX affordance only — server-side authorization (WIS-1 policies, WIS-8 middleware) remains the actual security boundary, and hiding a nav item is never access control.
- Given the header, when it renders, then it shows the signed-in user's name and role_label from GET /api/user, plus a working sign-out control that calls POST /api/logout and clears client state.
- Given the current route, when the shell renders, then the matching nav item is marked active both visually and with aria-current="page" — not visually only.
- Given the theme toggle, when the user picks light or dark, then the choice persists across reloads and overrides prefers-color-scheme; with no explicit choice ever made, the OS setting is followed on first load (per docs/design/brief.md "Internationalization" section).
- Given a viewport below the tablet breakpoint, when the shell renders, then the sidebar collapses to a drawer opened by a labelled control, and the page body never scrolls horizontally (client requirement 12: web and mobile friendly).
- Given RTL, when the shell renders, then the sidebar moves to the visual right, directional icons (chevrons, back arrows) flip, and nav order mirrors — verified against the existing WisalAppShell-LightRTL and DarkRTL exports.
- Given keyboard-only navigation, when a user tabs through the shell, then every nav item and header control is reachable in a logical order with a visible focus ring — `outline: none` without a replacement is forbidden (docs/design/brief.md "Accessibility").
- Given the shell renders before its user data has loaded, then it shows a skeleton in the header user slot rather than an empty gap or a layout shift when the name arrives.
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

- **Blocked by / related ids:** WIS-1 (auth must exist — the shell only renders for an authenticated user and reads `GET /api/user`)
- **Depends on code areas or other stories:** **This story blocks every other UI story.** WIS-2 through WIS-9, WIS-13 and WIS-15 all render inside this shell. Build it immediately after WIS-1, before any feature screen.

## Extra notes (optional)

- Design reference: `docs/design/references/1.app-shell/` — four finished exports (`WisalAppShell-{LightLTR,DarkLTR,LightRTL,DarkRTL}.dc.html`). This is the most-reviewed design batch in the project; follow it rather than re-deriving from tokens.
- **Origin of this story:** WIS-1's plan (line 491) states verbatim *"The full shell is a later story"* — but no such story existed until the 2026-08-24 gap review. WIS-1 ships only a placeholder rendering the user's name and role.
- The header must reserve a slot for the notification bell (WIS-13) and the language switcher (WIS-11), even though neither is built here — define the slot so those stories drop into it without restructuring the header.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- Frontend: React/TypeScript. Implement as a layout route (`AppLayout`) wrapping the protected route tree, matching the `app/layouts/` convention in the frontend architecture reference — not as a component each page imports for itself.
- **Before copying markup from any `.dc.html` export**, grep it for the classes `fv`, `fvd`, and `sk` — this project has a documented recurring defect where those focus-visible/skeleton classes appear in markup with no matching rule in `<style>`.
- Use CSS logical properties (`margin-inline-start`, not `margin-left`) throughout so RTL mirrors without a second stylesheet.

## Out of scope

- What this story explicitly does **not** cover:
- The content of any individual page — each feature story owns its own screen body.
- The Channels page itself (WIS-15) — this story only provides the nav item pointing at it.
- The notification bell's behaviour and data (WIS-13) and the language switcher's behaviour (WIS-11) — this story defines their slots in the header, nothing more.
- Custom branding / white-labelling (client requirement category 12) — the shell renders the Wisal identity only.
