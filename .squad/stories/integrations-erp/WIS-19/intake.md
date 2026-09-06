> **Fetched from jira:** [WIS-19](https://ibrahemelahmedy.atlassian.net/browse/WIS-19)  
> *Fetched 2026-09-02T20:32:11.168Z. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Integrations & ERP — Admin Connection Management (Category 11)  
**Type:** Story  
**Status:** To Do  
**Assignee:** ibrahem elahmady

### Description

Context

Client requirement Category 11 (docs/requirements/client-requirements-raw.md): APIs, ERP, Email/SMS/WhatsApp, external systems. Deferred out of the original 9-story MVP. The Channels Overview screen (WIS-15) already ships an honest "not available in this release" empty state for real channel integrations — this story is the admin-facing configuration counterpart: where an Administrator connects, configures, and monitors the status of those integrations. The actual send/receive wiring to each external provider is separate, later engineering work per provider — this story only covers the connect/configure/status/test surface.

Design reference

docs/design/references/18.WisalIntegrationsAdmin/ — WisalIntegrationsAdmin-LightLTR.dc.html (+ Dark/RTL variants once generated). Card grid (ERP / Email / SMS / WhatsApp / generic API-webhook), status pills, connect/configure modal with masked secrets and a "Test connection" action, per-card audit strip (last synced / last sync failed).

In scope

	Admin-only "Integrations" screen (new sidebar entry under Admin, alongside SLA Rules/Users) inside the existing App Shell.

	One card per integration type: ERP (generic connector, not provider-specific), Email, SMS, WhatsApp, generic API/Webhook.

	Connect/Configure modal: endpoint URL, API key/secret (always masked in the UI, reveal/copy action, never printed in full by default), "Test connection" before saving.

	Status pills: Not connected / Connected / Connection error, with a "last synced" / "last sync failed" audit line per connected card.

	Backend: persistence of connection config (encrypted at rest for secrets), a generic test-connection endpoint per integration type.

Explicit constraints

	No real provider-specific wiring (no actual ERP field mapping, no live WhatsApp/SMS/Email send-and-receive) — this story is the configuration surface only.

	No plaintext secrets anywhere in the UI or API responses, including on an already-connected integration's "Configure" view.

	Provider-agnostic by design — no real vendor logos/branding, generic icons only.

Out of scope for this story

	Field-level data mapping UI between Wisal and ERP.

	Actually connecting to any real third-party provider's live API — this is config plumbing + status display only.

	Channel-message ingestion changes to WIS-3/WIS-15 (those stories already log messages with a channel tag; this story doesn't touch that flow).

Dependencies

	WIS-15 (Channels Overview) — shares the "integrations not live yet" framing; keep the two screens' messaging consistent.

	WIS-8 (Users/Roles) — Admin-only visibility gate, same pattern as SLA Rules/Users.

Suggested next step

Run /squad-new-story integrations-erp-admin (or squad new-story integrations-erp-admin) to scaffold .squad/stories/integrations-erp-admin/WIS-19/intake.md, paste this description in, confirm the design folder above is finalized (all 4 variants), then /squad-plan.

### Attachments

None.

---
# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/integrations-erp/WIS-19/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Integrations & ERP — Admin Connection Management
- **Feature slug (folder under `plans/`):** `integrations-erp`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-19` *(used in filenames and plan tables; fill manually if empty)*
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Integrations & ERP — Admin Connection Management
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Context

Client requirement Category 11 (docs/requirements/client-requirements-raw.md): APIs, ERP, Email/SMS/WhatsApp, external systems. Deferred out of the original 9-story MVP. The Channels Overview screen (WIS-15) already ships an honest "not available in this release" empty state for real channel integrations — this story is the admin-facing configuration counterpart: where an Administrator connects, configures, and monitors the status of those integrations. The actual send/receive wiring to each external provider is separate, later engineering work per provider — this story only covers the connect/configure/status/test surface.

Design reference

docs/design/references/18.WisalIntegrationsAdmin/ — WisalIntegrationsAdmin-LightLTR.dc.html (+ Dark/RTL variants once generated). Card grid (ERP / Email / SMS / WhatsApp / generic API-webhook), status pills, connect/configure modal with masked secrets and a "Test connection" action, per-card audit strip (last synced / last sync failed).

In scope

	Admin-only "Integrations" screen (new sidebar entry under Admin, alongside SLA Rules/Users) inside the existing App Shell.

	One card per integration type: ERP (generic connector, not provider-specific), Email, SMS, WhatsApp, generic API/Webhook.

	Connect/Configure modal: endpoint URL, API key/secret (always masked in the UI, reveal/copy action, never printed in full by default), "Test connection" before saving.

	Status pills: Not connected / Connected / Connection error, with a "last synced" / "last sync failed" audit line per connected card.

	Backend: persistence of connection config (encrypted at rest for secrets), a generic test-connection endpoint per integration type.

Explicit constraints

	No real provider-specific wiring (no actual ERP field mapping, no live WhatsApp/SMS/Email send-and-receive) — this story is the configuration surface only.

	No plaintext secrets anywhere in the UI or API responses, including on an already-connected integration's "Configure" view.

	Provider-agnostic by design — no real vendor logos/branding, generic icons only.

Out of scope for this story

	Field-level data mapping UI between Wisal and ERP.

	Actually connecting to any real third-party provider's live API — this is config plumbing + status display only.

	Channel-message ingestion changes to WIS-3/WIS-15 (those stories already log messages with a channel tag; this story doesn't touch that flow).

Dependencies

	WIS-15 (Channels Overview) — shares the "integrations not live yet" framing; keep the two screens' messaging consistent.

	WIS-8 (Users/Roles) — Admin-only visibility gate, same pattern as SLA Rules/Users.

Suggested next step

Run /squad-new-story integrations-erp-admin (or squad new-story integrations-erp-admin) to scaffold .squad/stories/integrations-erp-admin/WIS-19/intake.md, paste this description in, confirm the design folder above is finalized (all 4 variants), then /squad-plan.
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

- **Blocked by / related ids:** WIS-15 (Channels Overview — keep the "integrations not live yet" messaging consistent); WIS-8 (Users/Roles — Admin-only visibility gate)
- **Depends on code areas or other stories:** existing App Shell sidebar + Admin section (same gating pattern as SLA Rules / Users), i18n retrofit infrastructure (WIS-11) for all new strings.

## Extra notes (optional)

- Anything not captured above (e.g. chat context) — keep short.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- What this story explicitly does **not** cover:
  - Field-level data mapping UI between Wisal and ERP.
  - Real provider-specific wiring — no live ERP sync, no actual WhatsApp/SMS/Email send-and-receive. Config surface + status display only.
  - Any change to channel-message ingestion in WIS-3 / WIS-15.
  - Real vendor logos or branding; generic icons only.
