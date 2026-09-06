> **Source: Jira WIS-18**, filled manually on 2026-09-02.
> The original `squad new-story` auto-fetch failed — `squad doctor` reports **tracker connectivity HTTP 401**,
> and Jira answers an unauthorised issue read with 404, which is the "not found" the scaffold recorded.
> The fields below were copied verbatim from the live issue via the Atlassian API.
> Issue: <https://ibrahemelahmedy.atlassian.net/browse/WIS-18> · last updated on Jira 2026-08-31.

---

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/ai-assist-panel/WIS-18/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** AI Assist — Ticket Summary & Suggested Reply
- **Feature slug (folder under `plans/`):** `ai-assist-panel`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-18`
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** *(none)*
- **Priority:** `Medium`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
AI Assist — Ticket Summary & Suggested Reply (Category 7, partial)
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

````
## Context

Client requirement Category 7 (`docs/requirements/client-requirements-raw.md`): Ticket summaries, Suggested replies, Automatic categorization, Suggested solutions, AI chatbot. Deferred out of the original 9-story MVP — WIS-3 (Conversation Thread) explicitly reserved a layout slot for it but did not build it: _"AI-generated suggested replies or ticket summaries (client requirement category 7) — the layout reserves a slot for this, but no AI call is made in this story."_ (`.squad/stories/conversation-thread/WIS-3/intake.md`).

This story fills that reserved slot for the two sub-bullets that plug directly into the Conversation Thread composer: **ticket summaries** and **suggested replies**. Automatic categorization, suggested solutions, and an AI chatbot are separate surfaces and explicitly out of scope here (see below).

## Design reference (do this first, or use what already exists)

`docs/design/references/17.WisalAIAssistPanel/` — `WisalAIAssistPanel-LightLTR.dc.html` (+ Dark/RTL variants once generated). Covers: ticket-summary card in the metadata panel, suggested-reply card inline above the composer, and all required states (idle, generating, ready, used, dismissed, failed). Built inside the existing Conversation Thread chrome (`docs/design/references/3.Conversation Thread/`) — reuse that shell exactly, do not redesign it.

## In scope

* A ticket-summary card in the Conversation Thread metadata panel: AI-generated 2-4 line summary, clearly badged as AI-generated, regenerate action, staleness timestamp.
* A suggested-reply card inline above the reply composer: AI-drafted reply text, "Use this reply" (inserts into composer, editable, never auto-sends) and "Dismiss" actions, regenerate action.
* Backend: an AI-provider integration (model choice, prompt design, and cost/rate-limit handling are planning decisions, not fixed here) that generates both artifacts from the ticket's message thread.
* All states from the design reference: idle / generating / ready / used / dismissed / failed.

## Explicit constraints

* **No auto-send** — a human always reviews before a reply goes out.
* **AI content is always visually distinguishable** from agent-authored content (badge + distinct surface treatment) — never silently presented as if the agent wrote or said it.
* Generation failure must never block the composer — the agent can always reply without AI assistance.

## Out of scope for this story

* Automatic categorization (belongs to ticket metadata/intake, a different surface).
* Suggested solutions (belongs to Knowledge Base surfacing, a different surface).
* AI chatbot (a separate, standalone customer- or agent-facing surface — much larger scope, its own story if pursued).
* Any Customer Portal-side AI features.

## Dependencies

* WIS-3 (Conversation Thread) — this story fills its reserved slot; must not otherwise modify that screen's existing layout.
* An AI provider/API decision made during planning (client requirement Category 11 territory for the provider _integration_ itself, but the UI/UX and prompt-orchestration logic belong here).

## Suggested next step

Run `/squad-new-story ai-assist-panel` (or `squad new-story ai-assist-panel`) to scaffold `.squad/stories/ai-assist-panel/WIS-18/intake.md`, paste this description in, confirm the design folder above is finalized (all 4 variants), then `/squad-plan`.
````

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
The Jira issue carries no separate Acceptance Criteria section. The following are derived verbatim
from its "In scope" and "Explicit constraints" bullets and should be confirmed during planning:

* Given an open ticket with messages, when an agent views the Conversation Thread metadata panel,
  then a ticket-summary card renders a 2-4 line AI-generated summary, badged as AI-generated, with a
  regenerate action and a staleness timestamp.
* Given an open ticket, when an agent views the reply composer, then a suggested-reply card renders
  above it with "Use this reply" and "Dismiss" actions and a regenerate action.
* Given a suggested reply, when the agent chooses "Use this reply", then the text is inserted into the
  composer as editable content and is NEVER auto-sent — a human always reviews before it goes out.
* Given any AI-produced content, when it is rendered, then it is visually distinguishable from
  agent-authored content (badge + distinct surface treatment) — never presented as if the agent wrote it.
* Given the AI generation fails, when the agent is on the ticket, then the composer remains fully
  usable and the agent can reply without AI assistance — failure never blocks the composer.
* Given each surface, then all six states from the design reference are implemented:
  idle / generating / ready / used / dismissed / failed.
* Given the Conversation Thread screen, then this story adds to it without otherwise modifying its
  existing layout (WIS-3 owns that shell).
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| — | None in `attachments/`. The design reference lives in the repo — see Technical hints below. |

*(Add rows per file. If none, write "None.")*

---

## Dependencies

- **Blocked by / related ids:** `WIS-3` (Conversation Thread) — this story fills its reserved layout slot and must not otherwise modify that screen. `WIS-11` (i18n) — every new string ships AR/EN + RTL like the rest of the product.
- **Depends on code areas or other stories:** the Conversation Thread feature tree (`web/src/features/tickets/components/thread/`) and its metadata panel + reply composer. Backend needs a new AI-provider integration; the provider/model decision is a planning decision, not fixed by the tracker item.

## Extra notes (optional)

- The design is finalized on disk: all four variants exist in `docs/design/references/17.WisalAIAssistPanel/` (Light/Dark × LTR/RTL), so the "(+ Dark/RTL variants once generated)" caveat in the Jira text is stale.
- Known translation decision recorded during the design pass: the "AI" chip was left in Latin script (not "ذكاء اصطناعي") because of chip width — worth confirming during planning.

## Technical hints (optional)

- APIs, screens, services already discussed. Repos/roots: `.`. Primary language: `typescript`.
- **Design reference:** `docs/design/references/17.WisalAIAssistPanel/` — `WisalAIAssistPanel-{Light,Dark}{LTR,RTL}.dc.html`.
- **Chrome to reuse unchanged:** `docs/design/references/3.Conversation Thread/`.
- Model choice, prompt design, and cost/rate-limit handling are open planning decisions.

## Out of scope

- What this story explicitly does **not** cover:
  - Automatic categorization (belongs to ticket metadata/intake, a different surface).
  - Suggested solutions (belongs to Knowledge Base surfacing, a different surface).
  - AI chatbot (a separate, standalone customer- or agent-facing surface — much larger scope, its own story if pursued).
  - Any Customer Portal-side AI features.
