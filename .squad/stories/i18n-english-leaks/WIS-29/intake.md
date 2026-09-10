> **Fetched from jira:** [WIS-29](https://ibrahemelahmedy.atlassian.net/browse/WIS-29)
> *Fetched 2026-09-10. Edit the sections below as needed; the planner reads this file verbatim.*


## Source — work item (from tracker)

**Title:** Close remaining untranslated English in the Arabic UI
**Type:** Story
**Status:** To Do
**Priority:** Medium
**Assignee:** ibrahem elahmady

### Description

```
## Reported symptom

The owner, using the app in Arabic, reports **substantial untranslated English text** across many
screens. The `check-no-literals.mjs` gate is green and the `web/src/i18n/locales/ar/*` catalogues
have no stray English values, so the leaks are NOT missing catalogue keys — they are somewhere the
gate does not look.

## Investigation first (phase 1 must produce the actual list before planning a fix)

Sweep every surface and classify each leak. Likely sources, to confirm or rule out:

1. **Server-sent dynamic content rendered as-is** — AI classification `reason`, sync-run error
   blobs (WIS-24), integration/channel test-connection error keys, webhook/outbox failure text,
   anything stored in English and shown verbatim.
2. **Backend** `lang/ar` gaps — `api/lang/ar/*.php` vs `api/lang/en/*.php`: enum labels for the
   enums added since WIS-11 (channel connection status, chat states, classification, sync status,
   outbox status), validation messages for the new Form Requests, `channels.php` / `ai.php` /
   `mail.php` keys.
3. **New frontend namespaces** — `chat-widget`, and any WIS-22/23/24 strings that were added to
   `en/*.json` but not `ar/*.json`, or added to neither and rendered from a constant.
4. `MAIL_CUSTOMER_LOCALE=en` — the CSAT invitation is always English regardless of the customer;
   decide whether that is correct or should follow a customer locale.
5. **Toasts, empty/error states, and aria-labels** in components added after the WIS-17 retrofit.
6. **Enum** `*_label` fields — confirm every enum added since WIS-11 resolves its label through
   `__()` against both `api/lang/{en,ar}`, per the STATUS.md contract.
7. Anything the `check-no-literals` allowlist exempts that is actually user-facing prose.

## Goal

Every user-facing string in the Arabic UI renders in Arabic, or is a deliberate, documented
exception (product name, ISO codes, the Latin "AI" pill).

## Done criteria

* [ ] Phase 1 delivers a complete, categorised inventory of every leak with file:line.
* [ ] Every frontend leak: key added to both `en` and `ar` namespaces, literal replaced with `t()`.
* [ ] Every backend leak: `api/lang/ar/*.php` key added, parity with `api/lang/en/*.php` restored.
* [ ] Enum labels: every enum resolves through `__()` in both locales; a test asserts parity.
* [ ] Server-stored English shown to end users is either localised at render or flagged as an
      accepted deferral with a reason.
* [ ] `check-no-literals.mjs` still green; a new test asserts `lang/en` vs `lang/ar` key-set parity.
* [ ] `npm run test`, `npm run build`, `php artisan test` all green.
* [ ] README / STATUS i18n notes corrected to match reality.

## Note

If phase-1 investigation finds the scope is very large, partition into a tracked sub-list and do
the highest-traffic screens first — but the inventory itself must be complete.
```

### Attachments

None.

---
# Story intake

- Folder: `.squad/stories/i18n-english-leaks/WIS-29/intake.md`

---

## Feature

- **Feature name (display):** Closing the Remaining English Leaks in the Arabic UI
- **Feature slug (folder under `plans/`):** `i18n-english-leaks`

## Tracker (metadata only)

- **Tracker type:** `jira`
- **Work item id:** `WIS-29`
- **Work item type:** `Story`
- **Status:** `To Do`
- **Assignee:** `ibrahem elahmady`
- **Labels:** ``

---

## Title

```
Close remaining untranslated English in the Arabic UI
```

---

## Acceptance criteria

*(Copied verbatim from the Jira issue's "Done criteria" block. All eight are this story's Done
Criteria and the plan reproduces them word-for-word.)*

```
[ ] Phase 1 delivers a complete, categorised inventory of every leak with file:line.
[ ] Every frontend leak: key added to both `en` and `ar` namespaces, literal replaced with `t()`.
[ ] Every backend leak: `api/lang/ar/*.php` key added, parity with `api/lang/en/*.php` restored.
[ ] Enum labels: every enum resolves through `__()` in both locales; a test asserts parity.
[ ] Server-stored English shown to end users is either localised at render or flagged as an
    accepted deferral with a reason.
[ ] `check-no-literals.mjs` still green; a new test asserts `lang/en` vs `lang/ar` key-set parity.
[ ] `npm run test`, `npm run build`, `php artisan test` all green.
[ ] README / STATUS i18n notes corrected to match reality.
```

Criterion 1 is **discharged by this intake** — the inventory below is the phase-1 deliverable.

---

# THE INVENTORY — phase 1 deliverable (Done Criterion 1)

Swept 2026-09-10 against commit `a2b0a12`. Every line below was produced by running the check, not
by reading a comment. **19 leak sites, ≈118 individual English strings.** Four of the seven Jira
hypotheses are **ruled out with evidence**; the leaks live in three places nobody was looking.

## §0 — What is NOT broken (ruled out, with the command that proves it)

These four were the issue's leading hypotheses. All four are clean. The execute agent must not
spend time here.

**R1. Frontend catalogue parity: PERFECT — 0 missing keys, either direction.**
A flatten-and-diff of all 18 `en/*.json` against their `ar/*.json` siblings returns **zero**
missing keys. The only asymmetries are 140 `_zero`/`_two`/`_few`/`_many` Arabic CLDR plural forms
that correctly exist only in `ar` (WIS-11 Decision 1). Ten `ar` values contain Latin characters and
**all ten are correct**: eight are interpolation-only templates (`"{{who}} — {{event}}"`,
`"{{min}}–{{max}}"`, `"{{list}}"`, `"{{label}}: {{value}}"`, `"{{relative}} · {{date}}"`), and two
are `csat:toggleTo` / `portal:toggleTo` = `"English"`, which is the language-switcher label and
**must** stay English.

**R2. Backend `lang/ar` vs `lang/en` parity: PERFECT — 0 missing keys, 0 English values.**
All nine files match exactly: `ai.php` 10/10, `auth.php` 3/3, `channels.php` 7/7, `enums.php`
16/16, `mail.php` 7/7, `passwords.php` 5/5, `portal.php` 10/10, `sla.php` 6/6, `validation.php`
144/144. No `ar` value contains a Latin letter. **`api/tests/Feature/I18n/CatalogueParityTest.php`
already asserts exactly this** (both key-set parity and no-byte-identical-stub) — Done Criterion 6's
"new test asserts `lang/en` vs `lang/ar` key-set parity" **already exists** and has been green the
whole time. That is precisely why it caught nothing: the missing strings are not *in* the
catalogues, they are *absent from them*, hard-coded in PHP.

**R3. `check-no-literals.mjs`: green, and its roots are complete.**
`node scripts/check-no-literals.mjs` → *"no hard-coded literals in 366 file(s) across 20 root(s)"*.
All 17 feature folders under `web/src/features/` are in `roots`, `chat-widget` included. The three
paths **not** in `roots` — `src/lib` (2 files), `src/App.tsx`, `src/main.tsx` — were scanned
explicitly and are **also clean**. The six allowlisted `literals` (`⌘K`, `Wisal`, `EN`, `AR`, `ع`,
`AI`) and three `patterns` are all legitimate; **no allowlist entry is hiding user-facing prose**
(Jira hypothesis 7 = ruled out). No `toast(...)` call anywhere in `web/src` takes a string literal.

**R4. The AI surfaces are locale-correct — including the one the issue names.**
- Summary and suggested reply: `api/app/Services/Ai/AssistTranscript.php:74-86` appends *"Write the
  summary in Arabic." / "Write the reply in Arabic."* when `$locale === 'ar'`.
- Chatbot: `api/app/Services/Ai/ChatPrompt.php:40` substitutes `{LANGUAGE}` with `Arabic` when the
  conversation locale is `ar`; `PortalChatbot.php:47-51` persists the locale on the conversation row.
- **The classification `reason` IS forced English** (`ClassificationPrompt.php:26`: *"at most 140
  characters, in English"*) — **but it is never exposed.** `TicketResource.php:29-40` emits
  `suggested_category`, `suggested_category_label`, `suggested_priority`,
  `suggested_priority_label`, `confidence`, `needs_triage`, `classified_at` and **no `reason`**;
  `grep -rn "reason" web/src` finds no render site. It is a debugging column. **Not a leak — leave
  the prompt alone** (changing it would break `tests/Unit/ClassificationPromptTest.php` for no
  user-visible gain).
- All three HTTP clients send the header: `web/src/lib/api.ts:52`,
  `features/portal/api/portalClient.ts:60`, `features/chat-widget/api/widgetClient.ts:49`, and
  `api/app/Http/Middleware/SetLocale.php:27` reads it. The plumbing is sound.

**R5. WIS-22 and WIS-24's own UI are clean.** `ar/chat-widget.json` exists, is at full parity, and
is fully Arabic. All 119 dynamic `t()` keys the SPA can construct from a backend enum — every
`sync.status.*`, `sync.direction.*`, `sync.counter.<dir>.*`, `sync.trigger.*`, `sync.event.*`,
`sync.error.*`, `error.*`, `type.*.label|help`, `status.*`, `presentation.*.label|helpLine`,
`newRequest.category.*`, `rating.*`, `units.*` — were checked by booting the real `i18next` against
the real catalogues and calling `exists(key, {lng, fallbackLng: []})`. **All resolve in both
locales.** `SyncRunRow.tsx`, `SyncRunErrors.tsx`, `StatusPill.tsx`, `DeadLetterPanel.tsx`,
`ChannelCard.tsx`, `ChannelConnectPanel.tsx` all route every server string through
`t(unscopeKey(...))`. WIS-24's `error_key` / `reason_key` / `label_key` architecture works
perfectly. **Hypotheses 1 (mostly), 2, 3 and 7 are closed.**

## §1 — Category A: enums whose `label()` bypasses `__()` — 5 live + 1 dead

**This is the primary leak class.** `api/lang/{en,ar}/enums.php` covers exactly four enums
(`priority`, `ticket_status`, `channel`, `user_role`). There are **25** enum classes in
`api/app/Enums/`; **10** of them define a `label()`; only **4** call `__()`
(`Priority.php:23`, `TicketStatus.php:14`, `Channel.php:15`, `UserRole.php:13`). The other six
`match()` on hard-coded English — and five of them are serialised onto a resource as a `*_label`
field that the SPA renders **verbatim** into the Arabic UI.

| # | Enum | `label()` | Cases | Serialised at | Rendered at (Arabic UI) |
|---|------|-----------|-------|---------------|--------------------------|
| A1 | `CustomerTier` | `CustomerTier.php:11-18` | 3 (`Standard`/`Premium`/`Enterprise`) | `CustomerResource.php:21` `tier_label`; `CustomerController.php:74` facet option `label` | `customers/model/columns.tsx:61` (**every row of the customer list**), `pages/CustomerProfilePage.tsx:53`, `pages/CustomersPage.tsx:111` (bulk-confirm title). `CustomerTierBadge.tsx:4` prints `label` raw. |
| A2 | `ArticleStatus` | `ArticleStatus.php:18-25` | 3 (`Draft`/`Published`/`Archived`) | `KbArticleResource.php:37`, `KbArticleSummaryResource.php:27` | `knowledge-base/model/columns.tsx:48`, `pages/ArticleReaderPage.tsx:116`, `pages/ArticleEditorPage.tsx:179`, `components/ArticlePickerPanel.tsx:124`. `ArticleStatusBadge.tsx:9-16` prints `label` raw. |
| A3 | `NotificationType` | `NotificationType.php:22-31` | 5 (`SLA at risk`/`SLA breached`/`Mention`/`Task due`/`Customer replied`) | `NotificationResource.php:27` `type_label` | `notifications/components/NotificationRow.tsx:36` — **every row of the notification panel AND the notifications page**. |
| A4 | `QuickReplyStatus` | `QuickReplyStatus.php:10-16` | 2 (`Active`/`Archived`) | `QuickReplyResource.php:21` | `agent-productivity/pages/QuickRepliesPage.tsx:136` (`qr.status_label.toUpperCase()`). |
| A5 | `TaskStatus` | `TaskStatus.php:11-18` | 3 (`Open`/`Completed`/`Cancelled`) | `TicketTaskResource.php:31` | **No render site** — `TicketTasksPanel.tsx` reads `task.status`, never `status_label`. Dead payload, but fix the enum anyway (an admin API consumer sees it, and leaving one of six unfixed is how the next one is added). |
| A6 | `MessageVisibility` | `MessageVisibility.php:10-16` | 2 (`Reply to customer`/`Internal note`) | **nowhere** | **Dead code.** `grep -rn "->label()" api/app` returns no `MessageVisibility` hit. Either localise it for symmetry or delete the method — the plan picks one. |

**Count: 6 enums, 18 English label strings.**

## §2 — Category B: backend English label maps that are not enums — 3 sites, 39 strings

| # | Site | Strings | Reaches the Arabic UI at |
|---|------|---------|--------------------------|
| B1 | `api/app/Models/Ticket.php:62-71` `categoryLabel()` | 5 (`Billing`, `Technical`, `Account`, `Feature request`, `General`) | `TicketResource.php:25` `category_label` **and** `:32` `ai_classification.suggested_category_label`; `PortalTicketResource.php` `category_label`. Rendered at `tickets/components/thread/ClassificationCard.tsx:35` (the first chip on **every ticket detail page**) and interpolated into `classification.suggested` at `:66`. **The single highest-traffic leak in the app.** |
| B2 | `api/app/Services/AuditTrail.php:118-146` `label(string $event)` | 23 (`User created` … `Signed out`) | `AuditLogResource.php:24` `event_label` → `users-roles-admin/pages/AuditLogPage.tsx:52` (the ACTION column of **every audit row**) and `:191` `getRowLabel` (the row's accessible name). **The whole Audit Log screen body is English in Arabic.** |
| B3 | `api/app/Services/SystemSettings.php:31-70` `definitions()` | 10 (5 `label` + 5 `help`) | `SystemSettingsPage.tsx:129` renders `setting.label` and `:130` renders `setting.help`. **The entire System Settings form is English in Arabic** — only the page chrome translates. |
| B4 | `api/app/Http/Resources/AuditLogResource.php:30` | 1 (`'Unknown'`) | Fallback actor name for a deleted user whose email is also blank. |

**Count: 39 strings.**

## §3 — Category C: hard-coded English messages on the wire — 24 strings

All of these render inside an otherwise-Arabic form or toast, because `SetLocale` already puts
Laravel in `ar` and every *catalogue-resolved* validation message comes back Arabic — these
`messages()` overrides simply never consult the catalogue.

**C1 — 22 `messages()` entries across 11 Form Requests:**

```
IndexAuditLogRequest.php:40           per_page.max
SaveBranchRequest.php:31,32,33        name.required / name.unique / timezone.timezone
SaveBrandingRequest.php:30            primary_color.regex
SaveDepartmentRequest.php:30,31,32    branch_id.required / branch_id.exists / name.required
StoreCustomerAttachmentRequest.php:30,31,33   file.max / file.mimes / file.required
StoreCustomerRequest.php:37           email.unique
StoreTicketMessageRequest.php:30      body.required
StoreUserRequest.php:37,38            role.required / email.unique
UpdateCustomerRequest.php:40          email.unique
UpdateUserRequest.php:41,42           role.required / email.unique
UploadBrandingLogoRequest.php:34,35,37,38  logo.max / logo.mimes / logo.image / logo.required
```

**C2 — `api/app/Http/Controllers/TicketController.php:149`** —
`'status' => "Cannot move a {$ticket->status->label()} ticket to {$next->label()}."`. Note the
irony: the two interpolated labels **are** localised, the sentence around them is not. This is the
invalid-transition error on the ticket detail page.

**C3 — `api/app/Http/Controllers/CustomerController.php:185`** —
`'message' => 'A customer with this email already exists.'` (the 409 body).

**Count: 24 strings.**

## §4 — Category D: `validation.php` `attributes` covers 15 of 70 validated fields

`api/lang/ar/validation.php:168-184` (and its `en` twin) list **15** attribute names. Extracting
every top-level rule key from `api/app/Http/Requests/*.php` gives **70** distinct field names.
**49 have no entry**, so Laravel humanises the raw snake_case English identifier and drops it into
an Arabic sentence — *"حقل endpoint url مطلوب"*.

Of the 49, these ~19 appear in a form a user actually fills and are **in scope**:
`phone`, `company`, `tier`, `description`, `category`, `channel`, `branch_id`, `region`,
`endpoint_url`, `inbound_url`, `outbound_url`, `primary_color`, `logo`, `file`, `code`,
`identifier`, `secret`, `excerpt`, `kb_category_id`.

The remaining 30 are query-string / internal params never surfaced in a form error
(`page`, `per_page`, `sort`, `dir`, `filter`, `q`, `from`, `to`, `period`, `ids`, `action`,
`actor_id`, `event`, `config`, `settings`, `conflict_rules`, `inbound_field_map`,
`outbound_events`, `verify_token`, `provider`, `mentions`, `is_active`, `visibility`,
`assigned_to`, `due_at`, `at_risk_threshold_pct`, `auto_close_after_days`,
`escalate_after_minutes`, `escalate_to_role`, `escalation_enabled`, `first_response_minutes`,
`notify_on_breach`, `resolution_minutes`, `inbound_enabled`, `outbound_enabled`) — **explicit
deferral**, recorded in the plan.

**Count: 19 in scope, 30 deferred.**

## §5 — Category E: frontend rendering a raw server/DB value — 3 sites

| # | Site | What leaks |
|---|------|-----------|
| E1 | `web/src/features/tickets/components/thread/ActivityList.tsx:12-21,29-31` | `EVENT_KEYS` maps **8** event slugs. The backend writes **13**: `created`, `status_changed`, `priority_changed`, `category_changed`, `assigned`, `unassigned`, `reopened`, `replied` (mapped) plus **`auto_assigned`** (`Ticket.php:262`), **`escalated`** (`:267`), **`auto_closed`** (`:272`), **`internal_note_added`** (`TicketMessageController.php:74`) and **`mentioned`** (`:87`) — unmapped. Those five fall to `activity.generic` = `"{{who}} — {{event}}"`, which prints the **raw English snake_case slug** in the Arabic activity feed. **Secondly**, `:30` passes `value: event.new_value` into `activity.statusChanged` / `priorityChanged` / `categoryChanged`, and `new_value` is the raw enum *value* (`resolved`, `feature_request`) — so even the three mapped change events render *"…غيّر الحالة إلى resolved"*. Ticket-detail page, every visit. |
| E2 | `web/src/features/agent-productivity/components/QuickReplyPicker.tsx:149` | `{category.toUpperCase()}` — the quick-reply group heading is a free-text DB column, seeded in English. Data-shaped; see §7. |
| E3 | `web/src/features/users-roles-admin/pages/SystemSettingsPage.tsx:78` | `error.response.data?.message` rendered raw. Harmless once C3-style controller messages are localised, but note it: any un-localised server `message` reaches the screen unfiltered. |

**Count: 3 sites, ~6 visible strings + a slug vocabulary of 5.**

## §6 — Category F: `MAIL_CUSTOMER_LOCALE=en` — 1 config decision

`api/.env.example:76` sets it; `api/config/mail.php:134` reads
`env('MAIL_CUSTOMER_LOCALE', env('APP_LOCALE', 'en'))`; `CsatInvitationMail.php:35` and
`ChannelReplyMail.php:34` both call `$this->locale(config('mail.customer_locale'))`. Every CSAT
invitation and every outbound channel email is therefore **always English**, for every customer,
regardless of the ticket. `api/lang/ar/mail.php` has all seven CSAT keys translated and
`tests/Feature/Mail/MailTemplateRenderTest.php:53` already proves the Arabic render works — the
Arabic email exists and is simply never selected.

**Recommendation: fix it here, cheaply, without a migration.** See Decision 6.

## §7 — Category G: seeded content in English — ACCEPTED DEFERRAL

Counted over `api/database/seeders/**`:

| File | Arabic tokens | Long string literals | Containing Arabic |
|------|---------------|----------------------|-------------------|
| `data/ticket-scenarios.php` | 1,134 | 378 | 80 |
| `data/ticket-message-templates.php` | 923 | 168 | 0 |
| `data/ticket-schedule.php` | 0 | 326 | 0 |
| `DatabaseSeeder.php` | 0 | 203 | 0 |
| `KnowledgeBaseSeeder.php` | 122 | 107 | 2 |
| `TicketScenarioSeeder.php` | 6 | 129 | 0 |

WIS-25 made ticket **bodies and subjects** genuinely bilingual — that part is deliberate and
correct. But `DatabaseSeeder.php` has **zero** Arabic: branch names (`Downtown HQ`, `North Branch`,
`East Support Center`, `Remote Team`), department names (`Technical Support`, `Billing`,
`Customer Success`, `Escalations`), quick-reply titles/bodies/categories, and customer company
names are all English; `KnowledgeBaseSeeder.php` ships 2 Arabic article titles out of ~14.

**This is DATA, not chrome — and it is almost certainly the larger half of what the owner
actually saw.** It is deferred, not denied: fixing it means either translating the seed (a WIS-25
follow-up) or adding `locale` columns to `kb_articles` / `quick_replies` / `branches` /
`departments` (four migrations and four UI surfaces — a story of its own). The plan records this
as the explicit Done-Criterion-5 deferral, and the README/STATUS edit (Done Criterion 8) says it
out loud so the next reader is not surprised. Related: `kb_articles` has **no `locale` column**
(WIS-23's own finding), so the portal chatbot answers in Arabic but cites English article titles —
same deferral, same reason.

## §8 — Category H: RTL (bonus sweep)

Nothing found worth a task. Every stylesheet added since WIS-17 (`portal.css`, `channels.css`,
`csat.css`, and the WIS-28 blocks in `index.css`) is written in logical properties; WIS-28's
plan-review re-verified this eight days ago. **RTL is not this story's problem — the language is.**

## §9 — Roll-up

| Category | Sites | Strings | In this story? |
|----------|-------|---------|----------------|
| A — enum `label()` bypassing `__()` | 6 | 18 | **Yes** |
| B — non-enum backend label maps | 4 | 39 | **Yes** |
| C — hard-coded `messages()` / controller messages | 13 | 24 | **Yes** |
| D — `validation.attributes` gap | 1 | 19 (of 49) | **Yes** (30 deferred) |
| E — frontend rendering raw server values | 3 | ~11 | **Yes** |
| F — `MAIL_CUSTOMER_LOCALE` | 1 | — | **Yes** |
| G — seeded content | — | hundreds | **No — accepted deferral** |
| H — RTL | 0 | 0 | n/a |
| **Total in scope** | **28** | **≈111** | |

**No partition of the fix list is needed.** Every in-scope item is mechanical, and A+B together are
one coherent change (move an English `match()` into `lang/{en,ar}` and call `__()`). The *only*
partition is §7 (content) and the 30 non-form `attributes` in §4, both recorded above with reasons.

---

## Decisions

**Decision 1 — A and B are the same fix, and it is an `__()` refactor, not an `ar` key add.**
There is no `ar` key to add, because there is no `en` key either: the strings live in PHP `match()`
arms. Every one of the six enums in §1 and the three maps in §2 gets its English text **moved** into
`api/lang/en/enums.php` (new sub-arrays) — byte-identical, so no existing test or API consumer
changes — plus a new `api/lang/ar/enums.php` sub-array, and the method body becomes
`return __('enums.<group>.'.$this->value);`, exactly matching `Priority.php:21-24`.
`AuditTrail::label()` and `SystemSettings::definitions()` are not enums, so they get their own
files: **`api/lang/{en,ar}/audit.php`** and **`api/lang/{en,ar}/settings.php`**. This keeps
`enums.php` meaning "backed enum cases" and nothing else.

**Decision 2 — the regression guard is a reflection test, not another parity test.**
Done Criterion 6 asks for a `lang/en` vs `lang/ar` key-set parity test. **It already exists**
(`api/tests/Feature/I18n/CatalogueParityTest.php:18-25`) and has been green throughout — and the
frontend twin exists too (`web/src/i18n/catalogueParity.test.ts`). Adding a third would be theatre.
The test that would actually have caught this bug is **reflection-driven**: enumerate every class
in `api/app/Enums/` that declares a `label()` method, call it under `en` then under `ar`, and assert
the two differ (or that the enum is in a short, commented exempt list). That converts "someone
remembered to use `__()`" from a convention into an enforcement. A second reflection test does the
same for `AuditTrail::label()` over `AuditTrail::events()` and for every `SystemSettings::
definitions()` `label`/`help`. Criterion 6 is satisfied by *pointing at* the existing parity tests
and *adding* the guard that was missing. Both existing parity tests must stay green — they are what
proves the new `enums.php` / `audit.php` / `settings.php` `ar` blocks are complete.

**Decision 3 — E1 gets a mapped vocabulary plus a test that pins it to the backend.**
`EVENT_KEYS` grows from 8 to 13 entries, and `activity.generic` stays as the last-resort fallback
for an event a future story adds. The guard is a **frontend** test that lists all 13 slugs and
asserts every one resolves to a real `conversation:activity.*` key — so adding a 14th event
server-side and forgetting the catalogue fails the suite. The `{{value}}` half is fixed by
translating the value before interpolation: `status_changed` / `priority_changed` interpolate
`t(\`status.\${new_value}\`)` / `t(\`priority.\${new_value}\`)` from the existing `tickets`
namespace fallback maps (`features/tickets/model/display.ts` `STATUS_FALLBACK_LABELS` /
`PRIORITY_FALLBACK_LABELS` — already there, already localised), and `category_changed` uses the new
`tickets:category.*` keys this story adds anyway for B1's frontend twin.

**Decision 4 — B1 (`categoryLabel`) is fixed server-side only, and the SPA is not touched.**
`category_label` already travels with `category` on `TicketResource` and `PortalTicketResource`,
which is the WIS-11 cross-cutting contract (*"Server-derived display copy is localised
server-side… Do not duplicate these maps in TypeScript"*). So the fix is `__('enums.category.'.
$category)` and **zero** change to `ClassificationCard.tsx`. The one exception is Decision 3's
`category_changed` activity line, where the SPA holds only a raw slug and no label — that needs a
`tickets:category.*` block in both catalogues. Five keys, both files.

**Decision 5 — C1's 22 messages move into `validation.custom`, not into a new file.**
`api/lang/{en,ar}/validation.php` already ships the `custom` scaffold at `:162-166`
(`'attribute-name' => ['rule-name' => '...']`). Filling it is Laravel's own designed mechanism, the
Form Request `messages()` methods are then **deleted** (not translated), and — importantly —
`CatalogueParityTest.php:35` currently `continue`s on any key starting `custom.`, exempting the
placeholder from the no-identical-stub rule. That skip must be **narrowed** to the literal
placeholder key `custom.attribute-name.rule-name`, or the 22 new real entries would be silently
exempt from the very test that guards them. This is the single most easily-missed step in the
story.

**Decision 6 — `MAIL_CUSTOMER_LOCALE`: FIX IT, by inferring from the ticket. No migration.**
The tempting reading is "accepted deferral — there is no `customers.locale` column." That reading
is wrong, because the column is not needed. Both mailables are constructed **from a ticket**, and
the ticket's own text is the best available signal: if the ticket's `subject` or `description`
contains any character in `\x{0600}-\x{06FF}`, the customer writes Arabic and the mail renders
`ar`; otherwise it renders `config('mail.customer_locale')` exactly as today. A tiny
`App\Services\CustomerLocale::forTicket(Ticket $t): string` helper, one unit test, no schema change,
no new env var, and `MAIL_CUSTOMER_LOCALE` keeps its current meaning as the **fallback** for a
ticket with no Arabic in it. This is strictly better than a deferral (the Arabic customer gets an
Arabic email today) and strictly cheaper than a migration (which would need a UI to set the column
and a portal preference to populate it). The migration remains the right long-term answer and is
recorded as a follow-up. **`.env.example:76` gains a comment saying it is now a fallback.**

**Decision 7 — no partition of the fix, and §7 is named out loud in the docs.**
Every in-scope item is a mechanical string move; splitting it would cost more in coordination than
it saves. But Done Criterion 8 (README / STATUS correction) must do two things, not one: (a) delete
the stale claim that the i18n retrofit is incomplete (`STATUS.md:37`, `README.md:266`, `:834` —
the retrofit **is** complete, per the 2026-09-06 memory note and R3 above), and (b) **add** the
newly-true statement that seeded demo *content* is largely English and that this is data, not
chrome. Replacing one wrong claim with a different wrong claim is not an improvement.

**Decision 8 — `MessageVisibility::label()` is localised, not deleted.**
It is dead today, but `visibility` is a live enum on a live column with a live UI toggle
(`ReplyComposer`), and the next story that wants a label will add the resource field, not the
method. Localising it costs two keys; deleting it risks the method being re-added hard-coded.

---

## Dependencies

- **Blocked by:** nothing. Every story whose strings this touches is shipped.
- **Depends on code areas / other stories:**
  - **Story 15 — internationalization (WIS-11)**, `.squad/plans/internationalization/`. Owns
    `api/lang/{en,ar}/enums.php`, `SetLocale`, the `*_label`-travels-with-its-value contract, the
    `parseMissingKeyHandler` → `humanizeKey` degradation (`web/src/i18n/instance.ts:114-119,
    168-176`) that is *why* a missing dynamic key renders as English rather than failing loudly,
    and both existing parity tests.
  - **Story 16 — i18n-retrofit (WIS-17)**, `.squad/plans/i18n-retrofit/`. Owns
    `check-no-literals.mjs`, `i18n-allowlist.json`, and the seven `web/src/__i18nArabicSweep.*.
    test.tsx` files. **Read those seven first** — they are the render-in-Arabic-and-assert-no-Latin
    pattern this story extends, and their `CHROME_STRINGS_EN` arrays deliberately list only *chrome*
    strings while the fixtures hand-feed `tier_label: 'Enterprise'` / `role_label: 'Agent'`. That
    scoping choice is exactly why every §1 leak survived the retrofit.
  - **Stories 08 / 09 / 10 / 11 / 20** own the five screens §1–§2 leak on (users+audit+settings,
    knowledge base, quick replies, notifications, organization).
  - **Story 23 — transactional-email (WIS-27)** owns `config/mail.php:134` and both mailables.

## Technical hints

- **Commands:** `cd api && php artisan test`; `cd web && npm run test && npm run build && npm run lint`
  (`lint` = `oxlint` then `node scripts/check-no-literals.mjs`).
- **Baseline to beat:** backend **419/419** (local pgsql `wisal_test` — `pdo_sqlite` is unavailable
  on this machine; `api/phpunit.xml` targets pgsql, see the memory note). Frontend **628 pass /
  102 files** after WIS-28.
- **`php` on this machine is Herd's** — `C:\Users\ibrah\.config\herd\bin\php.bat`, PHP 8.4.24.
- **Re-run the sweep to verify:** the two throwaway scripts that produced §0/R1 and R2 are worth
  recreating rather than trusting — a flatten-and-diff over `web/src/i18n/locales/{en,ar}/*.json`,
  and the same over `api/lang/{en,ar}/*.php`. Both are ~20 lines. The i18next `exists()` harness
  used for R5 is the one worth keeping as a real test if the plan finds it cheap.

## Out of scope

- **Translating seeded demo content** (§7) and adding a `locale` column to `kb_articles`,
  `quick_replies`, `branches` or `departments`.
- **The 30 non-form `validation.attributes`** listed in §4.
- **`ClassificationPrompt.php`** and the `ai_reason` column (§0 R4 — never rendered).
- **Any RTL / CSS / layout change** (§8).
- **Any new endpoint, migration, or component.** This story adds catalogue keys, `__()` calls, one
  small service, and tests.
- **Raising `.assist-chip`'s 4.24:1 dark contrast** — still WIS-18's, still deferred (WIS-28
  Decision 5).
