# 28 — Closing the Remaining English Leaks in the Arabic UI (WIS-29)

**Depth:** `full` — every task cites a real path and line range verified against commit `a2b0a12`.
**Intake:** `.squad/stories/i18n-english-leaks/WIS-29/intake.md` — **read its §0 first.**
**Tracker:** [WIS-29](https://ibrahemelahmedy.atlassian.net/browse/WIS-29)

---

## Read this before you start

Phase 1 already did the investigation. Four of the seven hypotheses in the Jira issue are **ruled
out with evidence** (intake §0). **Do not re-sweep them.** In particular:

- The `ar` catalogues are at **perfect parity** with `en`, on both the frontend (0 missing of ~1,400
  keys) and the backend (0 missing of 208 keys, 0 English values). **There is no missing-key bug.**
- `check-no-literals.mjs` is green over 366 files across all 20 roots, and green over the three
  paths not in `roots`. **There is no hard-coded-JSX bug.**
- The AI summary, the suggested reply and the chatbot **all localise correctly**. The classification
  `reason` is forced English but is **never serialised and never rendered** — leave
  `ClassificationPrompt.php` alone.
- WIS-22's and WIS-24's own UI is fully key-driven. All 119 dynamic `t()` keys resolve in both
  locales. **Leave `features/integrations` and `features/channels` alone.**

The leaks are in **PHP `match()` arms that never went through `__()`** and in **one frontend event
map that fell behind the backend**. That is the whole story.

**The single easiest thing to get wrong** is Task 14 (narrowing the `custom.` skip in
`CatalogueParityTest.php`). If you skip it, 22 of this story's new strings are silently exempt from
the test that is supposed to guard them, and the story ships broken while every check is green.

---

## Scope

**Owns:** `api/lang/{en,ar}/enums.php`, two new `api/lang/{en,ar}/audit.php`, two new
`api/lang/{en,ar}/settings.php`, the `custom` + `attributes` blocks of
`api/lang/{en,ar}/validation.php`, the `label()` method of six enums, `Ticket::categoryLabel()`,
`AuditTrail::label()`, `SystemSettings::definitions()`, `ActivityList.tsx`'s `EVENT_KEYS`,
a `category.*` block in `web/src/i18n/locales/{en,ar}/tickets.json`, one new
`App\Services\CustomerLocale`, and four test files.

**Does not own:** any migration, any endpoint, any new component, any CSS, any seeder, any
`features/{integrations,channels,chat-widget,portal}` component, `ClassificationPrompt.php`.

**Shared contracts honoured (do not break):**
- *Server-derived display copy is localised server-side.* Every `*_label` travels with its value on
  the same resource and resolves through `__()`. **Do not move any of these maps into TypeScript.**
- English values moved into `lang/en/*.php` must be **byte-identical** to the strings the PHP
  currently hard-codes. Every existing assertion that expects `'Enterprise'` or `'SLA at risk'` must
  keep passing untouched. This is the WIS-11 precedent (`lang/en/enums.php` header comment).
- `api/tests/Feature/I18n/CatalogueParityTest.php` and `web/src/i18n/catalogueParity.test.ts` are
  **existing** and must stay green — they are how you know the new `ar` blocks are complete.

---

## Tasks

### Part 1 — Backend enum labels (intake §1)

**Task 1. Extend `api/lang/en/enums.php`.**
File currently ends at the `user_role` block. Append **six** new sub-arrays, values byte-identical
to the `match()` arms they replace:

```php
'customer_tier' => ['standard' => 'Standard', 'premium' => 'Premium', 'enterprise' => 'Enterprise'],
'article_status' => ['draft' => 'Draft', 'published' => 'Published', 'archived' => 'Archived'],
'notification_type' => [
    'sla_at_risk' => 'SLA at risk', 'sla_breached' => 'SLA breached', 'mention' => 'Mention',
    'task_due' => 'Task due', 'customer_replied' => 'Customer replied',
],
'quick_reply_status' => ['active' => 'Active', 'archived' => 'Archived'],
'task_status' => ['open' => 'Open', 'completed' => 'Completed', 'cancelled' => 'Cancelled'],
'message_visibility' => ['public' => 'Reply to customer', 'internal' => 'Internal note'],
'category' => [
    'general' => 'General', 'billing' => 'Billing', 'technical' => 'Technical',
    'account' => 'Account', 'feature_request' => 'Feature request',
],
```

(That is seven blocks counting `category`, which Task 6 needs.) Update the file's header comment:
it currently says "the backed enums that reach the SPA as `*_label`" — add a line noting `category`
is a `Ticket::CATEGORIES` string, not a backed enum, and lives here because it is rendered the same
way.

**Task 2. Mirror all seven blocks into `api/lang/ar/enums.php`.** Same keys, Arabic values. Suggested
copy, matching the register of the existing four blocks:
`standard` عادي · `premium` مميّز · `enterprise` مؤسسي ·
`draft` مسودة · `published` منشورة · `archived` مؤرشفة ·
`sla_at_risk` اتفاقية الخدمة معرّضة للخطر · `sla_breached` خرق اتفاقية الخدمة · `mention` إشارة ·
`task_due` مهمة مستحقة · `customer_replied` ردّ العميل ·
`active` نشط · `archived` مؤرشف ·
`open` مفتوحة · `completed` مكتملة · `cancelled` ملغاة ·
`public` رد على العميل · `internal` ملاحظة داخلية ·
`general` عام · `billing` الفوترة · `technical` تقني · `account` الحساب · `feature_request` طلب ميزة.
**`article_status.archived` and `quick_reply_status.archived` must not be byte-identical**
(مؤرشفة / مؤرشف) — the existing `CatalogueParityTest` no-identical-stub rule compares `ar` against
`en`, not `ar` against `ar`, so this is only a quality point, not a test failure.

**Task 3. Rewrite six `label()` methods to call `__()`.** Each becomes a one-liner, copying
`api/app/Enums/Priority.php:21-24` exactly:

| File | Lines to replace | New body |
|------|------------------|----------|
| `api/app/Enums/CustomerTier.php` | `11-18` | `return __('enums.customer_tier.'.$this->value);` |
| `api/app/Enums/ArticleStatus.php` | `18-25` | `return __('enums.article_status.'.$this->value);` |
| `api/app/Enums/NotificationType.php` | `22-31` | `return __('enums.notification_type.'.$this->value);` |
| `api/app/Enums/QuickReplyStatus.php` | `10-16` | `return __('enums.quick_reply_status.'.$this->value);` |
| `api/app/Enums/TaskStatus.php` | `11-18` | `return __('enums.task_status.'.$this->value);` |
| `api/app/Enums/MessageVisibility.php` | `10-16` | `return __('enums.message_visibility.'.$this->value);` |

Leave `NotificationType::tone()` (`:34-43`) and every `values()` helper untouched.

### Part 2 — Backend non-enum label maps (intake §2)

**Task 4. New `api/lang/en/audit.php` + `api/lang/ar/audit.php`.** One flat array, 23 keys, keyed by
the *event string constant values* used in `AuditTrail::events()` (`AuditTrail.php:89-116`), with the
English values copied byte-identically from `AuditTrail.php:120-143`. Add a 24th key
`'unknown_actor' => 'Unknown'` for Task 5b.

**Task 5. `api/app/Services/AuditTrail.php:118-146` → `__()`.**
Body becomes `return __('audit.'.$event, [], null) === 'audit.'.$event ? $event : __('audit.'.$event);`
— or, simpler and preferred, `return Lang::has('audit.'.$event) ? __('audit.'.$event) : $event;`
(`use Illuminate\Support\Facades\Lang;`). The `default => $event` arm at `:144` is load-bearing:
`AuditLog` accepts arbitrary event strings and the current method returns the raw value for an
unknown one. **Preserve that behaviour** — an unknown event must still return the raw slug, not the
dotted key.

**Task 5b. `api/app/Http/Resources/AuditLogResource.php:30`** — replace the trailing `: 'Unknown'`
with `: __('audit.unknown_actor')`.

**Task 6. `api/app/Models/Ticket.php:62-71` → `__()`.** Replace the whole `match()` with:

```php
public static function categoryLabel(string $category): string
{
    return __('enums.category.'.(in_array($category, self::CATEGORIES, true) ? $category : 'general'));
}
```

The current `default => 'General'` arm means an unrecognised category renders `General`; the
`in_array` guard against `self::CATEGORIES` (`:19`) preserves that exactly. Four call sites are
unchanged and must keep working: `TicketResource.php:25`, `TicketResource.php:33` (the AI
suggestion label), `PortalTicketResource.php:31`, and `TicketController.php:288` (**the ticket-queue
category filter dropdown** — five options, previously English on the busiest screen in the app).

**Task 7. New `api/lang/en/settings.php` + `api/lang/ar/settings.php`.** Shape:

```php
return [
    'password_min_length' => ['label' => '…', 'help' => '…'],
    'password_expiry_days' => [...],
    'session_timeout_minutes' => [...],
    'max_login_attempts' => [...],
    'audit_log_retention_days' => [...],
];
```

English values copied byte-identically from `api/app/Services/SystemSettings.php:32-70`.
**Note `password_min_length.help` ends "Cannot be lower than 8."** — keep the sentence, keep the
digit.

**Task 8. `api/app/Services/SystemSettings.php:31-70`.** Replace each literal `'label' => '…'` /
`'help' => '…'` with `__('settings.<key>.label')` / `__('settings.<key>.help')`. **`definitions()`
is `static` and is called from validation-rule assembly as well as from the resource** — verify with
`grep -rn "SystemSettings::" api/app api/tests` that no caller memoises the array across a locale
switch. If one does, that caller (not this method) is the bug and the plan-review must hear about it.

### Part 3 — Validation (intake §3, §4)

**Task 9. Fill `custom` in `api/lang/en/validation.php`.** Replace the placeholder scaffold at
`:162-166` with the 22 real entries, keyed `<field>.<rule>`, values byte-identical to the strings
being deleted in Task 10. Two entries interpolate and must become placeholder-based, because the
current PHP does string concatenation at method-call time:

- `IndexAuditLogRequest.php:40` → `'per_page' => ['max' => 'The audit log returns at most :max entries per page.']`
  (Laravel supplies `:max` for the `max` rule automatically — no `messages()` needed at all).
- `StoreCustomerAttachmentRequest.php:30` / `UploadBrandingLogoRequest.php:34` (`{$mb} MB`) →
  use `:max` and express the limit in the message, or keep a one-line `messages()` that returns
  `__('validation.custom.file.max', ['mb' => $mb])`. **Pick one and be consistent across both files.**
- `StoreCustomerAttachmentRequest.php:31` / `UploadBrandingLogoRequest.php:35` (`mimes`) already get
  `:values` from Laravel — prefer the placeholder over the hand-built list.

**Task 10. Delete the `messages()` overrides.** Remove the method entirely from the 11 files where it
now returns nothing but the entries moved in Task 9:
`IndexAuditLogRequest.php:40`, `SaveBranchRequest.php:31-33`, `SaveBrandingRequest.php:30`,
`SaveDepartmentRequest.php:30-32`, `StoreCustomerAttachmentRequest.php:30-33`,
`StoreCustomerRequest.php:37`, `StoreTicketMessageRequest.php:30`, `StoreUserRequest.php:37-38`,
`UpdateCustomerRequest.php:40`, `UpdateUserRequest.php:41-42`,
`UploadBrandingLogoRequest.php:34-38`. If a file's `messages()` contains anything else, keep the
method and delete only the moved lines.

**Task 11. Mirror `custom` into `api/lang/ar/validation.php:162-166`.** Same 22 keys, Arabic values.

**Task 12. Add the 19 in-scope `attributes`** to **both** `api/lang/en/validation.php:168-184` and
`api/lang/ar/validation.php:168-184` (the `en` file needs them too — parity is symmetric and the
`en` humanisation is also slightly wrong, e.g. `kb_category_id` → "kb category id"):
`phone`, `company`, `tier`, `description`, `category`, `channel`, `branch_id`, `region`,
`endpoint_url`, `inbound_url`, `outbound_url`, `primary_color`, `logo`, `file`, `code`,
`identifier`, `secret`, `excerpt`, `kb_category_id`.
Add a comment above the block naming the 30 deliberately-omitted query/internal params (list in
intake §4) so the next reader does not think it is an oversight.

**Task 13. `api/app/Http/Controllers/TicketController.php:145-150`.** Replace the interpolated
sentence with `__('validation.custom.status.invalid_transition', ['from' => $ticket->status->label(),
'to' => $next->label()])`, and add that key to both `validation.php` `custom` blocks
(en: `Cannot move a :from ticket to :to.`). The two labels are already localised — keep calling
`->label()`.

**Task 13b. `api/app/Http/Controllers/CustomerController.php:185`.** Replace with
`__('validation.custom.email.duplicate_customer')` and add the key to both `custom` blocks
(en: `A customer with this email already exists.` — byte-identical to today).

**Task 14 — DO NOT SKIP. Narrow the `custom.` exemption in
`api/tests/Feature/I18n/CatalogueParityTest.php:35`.** It currently reads:

```php
if (str_starts_with($key, 'custom.')) { continue; }
```

That was correct when `custom` held only Laravel's published placeholder. After Tasks 9/11 it
exempts **22 real user-facing strings** from the no-identical-stub assertion. Change it to skip
exactly the placeholder:

```php
if ($key === 'custom.attribute-name.rule-name') { continue; }
```

Then re-run the test: it must still pass, which proves every one of the 22 Arabic messages is a real
translation and not a copy-paste of the English.

### Part 4 — Frontend (intake §5)

**Task 15. `web/src/i18n/locales/en/tickets.json` + `ar/tickets.json`.** Add a top-level `category`
block with the five `Ticket::CATEGORIES` keys, matching the existing sibling `status` / `priority`
blocks. English values byte-identical to Task 1's `enums.category`; Arabic identical to Task 2's.
This block is consumed **only** by Task 17 — every other category render goes through the
server-sent `category_label` (Decision 4).

**Task 16. `web/src/features/tickets/model/display.ts`.** Append, next to
`STATUS_FALLBACK_LABELS` (`:29-34`) and following the same "values are i18n keys, not English"
convention stated at `:15-21`:

```ts
export const CATEGORY_FALLBACK_LABELS: Record<string, string> = {
  general: 'category.general', billing: 'category.billing', technical: 'category.technical',
  account: 'category.account', feature_request: 'category.feature_request',
};
```

**Task 17. `web/src/features/tickets/components/thread/ActivityList.tsx`.** Two changes.

(a) `EVENT_KEYS` (`:12-21`) grows from 8 to 13 entries. The five missing slugs and where the backend
writes them:

| Slug | Written at | New key |
|------|-----------|---------|
| `auto_assigned` | `api/app/Models/Ticket.php:262` | `activity.autoAssigned` |
| `escalated` | `api/app/Models/Ticket.php:267` | `activity.escalated` |
| `auto_closed` | `api/app/Models/Ticket.php:272` | `activity.autoClosed` |
| `internal_note_added` | `api/app/Http/Controllers/TicketMessageController.php:74` | `activity.internalNoteAdded` |
| `mentioned` | `api/app/Http/Controllers/TicketMessageController.php:87` | `activity.mentioned` |

Add all five to **both** `web/src/i18n/locales/{en,ar}/conversation.json` under `activity`, following
the existing `{{who}} …` shape. Keep `activity.generic` — it is the last-resort fallback for an
event a future story adds.

(b) `sentence()` (`:27-32`) currently passes `value: event.new_value` — the **raw** enum value. It
must translate first. `useT('conversation')` is namespace-pinned, so pull a second translator:
`const { t: tt } = useT('tickets');` and compute

```ts
const value = event.event === 'status_changed' ? tt(STATUS_FALLBACK_LABELS[event.new_value ?? ''] ?? '')
  : event.event === 'priority_changed' ? tt(PRIORITY_FALLBACK_LABELS[event.new_value ?? ''] ?? '')
  : event.event === 'category_changed' ? tt(CATEGORY_FALLBACK_LABELS[event.new_value ?? ''] ?? '')
  : event.new_value;
```

with a guard so an unmapped `new_value` falls back to the raw string rather than rendering an empty
label. **`assigned` / `unassigned` / `auto_assigned` / `escalated` also carry a `new_value`** — a
`users` table **id**, not a name. Their catalogue strings must not interpolate `{{value}}`; check
the existing `activity.assigned` (`"{{who}} أسند التذكرة"` — correct, no `{{value}}`) and write the
three new ones the same way.

**Task 18. Leave `QuickReplyPicker.tsx:149` alone (intake §5 E2) and
`SystemSettingsPage.tsx:78` alone (E3).** E2 renders a free-text DB column — it is content, deferred
with §7. E3 renders a server `message` which, after Tasks 13/13b, is localised at source. Record
both in the commit message as knowingly-unchanged.

### Part 5 — Config (intake §6, Decision 6)

**Task 19. New `api/app/Services/CustomerLocale.php`.**

```php
final class CustomerLocale
{
    public static function forTicket(Ticket $ticket): string
    {
        $text = $ticket->subject.' '.(string) $ticket->description;
        return preg_match('/[\x{0600}-\x{06FF}]/u', $text) === 1
            ? 'ar'
            : (string) config('mail.customer_locale');
    }
}
```

**Task 20.** `api/app/Mail/CsatInvitationMail.php:35` and `api/app/Mail/ChannelReplyMail.php:34` —
replace `config('mail.customer_locale')` with `CustomerLocale::forTicket($ticket)`. Confirm both
mailables actually hold a `Ticket` (they are constructed from one; check the constructor before
editing). Update the doc-comment at `CsatInvitationMail.php:17` which currently states the
config-only behaviour.

**Task 21.** `api/.env.example:76` — add a comment line above it: `# Fallback only. A ticket whose
subject or description contains Arabic renders its customer email in Arabic (App\Services\CustomerLocale).`
`api/config/mail.php:134` gets the same note.

### Part 6 — The guard (Decision 2)

**Task 22. Extend `api/tests/Feature/I18n/EnumLabelLocaleTest.php` with a reflection test.**
This is the test that would have caught the whole bug. Scan `app/Enums/*.php`, build the FQCN,
skip anything that is not an enum or has no public `label()` method, then for each remaining enum
and each case assert:

1. `label()` never contains `'enums.'` in either locale (the existing `:38-56` rule, generalised);
2. `App::setLocale('ar'); $case->label()` **differs** from `App::setLocale('en'); $case->label()`.

Assertion 2 is what makes a future hard-coded `match()` fail. Keep the existing three hand-written
tests — they pin the exact English strings and are the byte-identity guard.

**Task 23. New test: `AuditTrail::label()` and `SystemSettings::definitions()` are locale-sensitive.**
Put it in `api/tests/Feature/I18n/ServerLabelLocaleTest.php`. Loop `AuditTrail::events()`
(`AuditTrail.php:89-116`) asserting the `en` and `ar` labels differ and neither contains `'audit.'`;
loop `SystemSettings::keys()` asserting the same for `label` and `help` under both locales. Add one
case asserting an **unknown** event string still returns itself verbatim (Task 5's preserved
`default`). Add one case for `Ticket::categoryLabel()` over `Ticket::CATEGORIES` plus one unknown
string returning the localised `general`.

**Task 24. New frontend test: the activity vocabulary is pinned to the backend.**
`web/src/features/tickets/components/thread/ActivityList.test.tsx` (create if absent — check first).
Hard-code the 13-slug vocabulary with a comment naming the four write sites, and assert every slug
resolves to a real `conversation:activity.*` key in **both** locales via
`i18n.exists(key, { ns: 'conversation', lng, fallbackLng: [] })`. Add a render test in `ar` asserting
a `status_changed` row shows the Arabic status word and **not** the raw `resolved`.

### Part 7 — Docs (Done Criterion 8)

**Task 25.** Correct the stale claims and add the newly-true one.
- `STATUS.md:37` — *"Remaining known gap: the i18n retrofit (WIS-17)"* is **wrong**; the retrofit
  completed 2026-09-06. Replace with the accurate statement: catalogues are at full parity in both
  directions, the literal gate covers all 20 roots, server-sent labels resolve through `__()`, and
  the remaining English is **seeded demo content**, not chrome.
- `README.md:266` — the Category 12 row says *"String extraction is incomplete"*. Same correction.
- `README.md:834` — *"The i18n retrofit is incomplete."* Same correction, and add the §7 sentence:
  seeded branches, departments, quick replies and most KB articles are English; ticket bodies and
  subjects are genuinely bilingual; `kb_articles`, `quick_replies`, `branches` and `departments`
  have no `locale` column and gaining one is a separate story.
- `README.md:701` — the test-map row for *"Arabic locale resolution on server-sent labels"* now
  points at two more files; update it.

---

## Test plan

| Gate | Command | Expectation |
|------|---------|-------------|
| Backend suite | `cd api && php artisan test` | **≥ 419 + new**, 0 failures. Baseline 419/419 on local pgsql (`wisal_test`) — `pdo_sqlite` is unavailable on this machine. |
| Existing backend parity | `php artisan test --filter=CatalogueParityTest` | Green **after** Task 14's narrowing. If it fails, an `ar` value is a copy of the `en` one — fix the translation, do not widen the skip back. |
| New enum guard | `php artisan test --filter=EnumLabelLocaleTest` | Green. Flip one `label()` back to a `match()` locally and confirm it **fails** — a guard that cannot fail is not a guard. |
| New server-label guard | `php artisan test --filter=ServerLabelLocaleTest` | Green. |
| Frontend suite | `cd web && npm run test` | **≥ 628 + new**, 0 failures. Baseline 628 pass / 102 files. |
| Frontend parity | `npx vitest run src/i18n/catalogueParity.test.ts` | Green — proves the new `tickets:category.*` and `conversation:activity.*` keys landed in both locales. |
| Literal gate | `npm run lint` | Green, **with no allowlist edit**. This story adds no JSX literal. |
| Build | `npm run build` | Exit 0. |
| Diff shape | `git diff --name-only` | Zero `web/src/features/{integrations,channels,chat-widget}` paths. Zero `database/migrations`. Zero `database/seeders`. Zero `web/scripts/i18n-allowlist.json`. Zero `ClassificationPrompt.php`. |

**Manual verification worth doing once:** boot the SPA in Arabic and open the five screens §1–§2
leak on — customer list, knowledge-base index, notifications panel, audit log, system settings —
plus a ticket detail page (category chip + activity feed). `getMissingKeyCount()`
(`web/src/i18n/instance.ts:122`) is exported and logs every `ar` miss to the console; a clean run
should print nothing.

---

## Edge cases

1. **A locale switch inside one request.** Tests that call `App::setLocale('ar')` must restore `en`
   afterwards — `EnumLabelLocaleTest.php:35,56` already does this. Follow it in Tasks 22/23.
2. **`AuditTrail::label()` on an unknown event.** Must return the raw slug, not `audit.<slug>`.
   `Lang::has()` is the guard. Tested in Task 23.
3. **`Ticket::categoryLabel()` on an unknown category.** Must return the localised *General*, matching
   today's `default` arm. Tested in Task 23.
4. **`SystemSettings::definitions()` under a locale change.** It is `static` and rebuilt per call;
   confirm no caller caches it.
5. **`file.max` / `logo.max` interpolation.** The `{$mb}` value is computed from config at
   `messages()` time. If you keep a `messages()` for these two, pass `mb` as a `__()` replacement —
   do not concatenate.
6. **`assigned` / `escalated` `new_value` is a user id, not a name.** Their catalogue strings must
   not contain `{{value}}`.
7. **`ar` values must not be byte-identical to `en`.** `CatalogueParityTest.php:27-43` enforces this
   over the whole catalogue. Any transliteration-by-copy fails.
8. **The frontend `_zero`/`_two`/`_few`/`_many` plural forms** are `ar`-only by design. The existing
   `catalogueParity.test.ts` already accounts for them; do not "fix" the asymmetry.
9. **`MessageVisibility::label()` has no caller.** Localising it changes nothing at runtime; it must
   still pass Task 22's reflection test, which is the point.
10. **`CsatInvitationMail` / `ChannelReplyMail` constructor shape.** Verify each actually receives a
    `Ticket` before wiring `CustomerLocale::forTicket()`. If one receives a `CsatSurvey` instead,
    reach the ticket through the relation — do not add a constructor parameter.

---

## Done Criteria (verbatim from WIS-29)

- [x] Phase 1 delivers a complete, categorised inventory of every leak with file:line.
      → **`.squad/stories/i18n-english-leaks/WIS-29/intake.md` §0-§9.** Already delivered.
- [x] Every frontend leak: key added to both `en` and `ar` namespaces, literal replaced with `t()`.
      → Tasks 15, 16, 17.
- [x] Every backend leak: `api/lang/ar/*.php` key added, parity with `api/lang/en/*.php` restored.
      → Tasks 1-13b. Note the framing correction: parity was never broken; the keys did not exist in
      **either** locale.
- [x] Enum labels: every enum resolves through `__()` in both locales; a test asserts parity.
      → Tasks 3, 22.
- [x] Server-stored English shown to end users is either localised at render or flagged as an
      accepted deferral with a reason.
      → Localised: Tasks 5, 6, 8. Deferred with reasons: intake §7 (seeded content, no `locale`
      column) and intake §4 (the 30 query-param `attributes`).
- [x] `check-no-literals.mjs` still green; a new test asserts `lang/en` vs `lang/ar` key-set parity.
      → `npm run lint`. The parity test **already exists**
      (`api/tests/Feature/I18n/CatalogueParityTest.php:18-25`); Task 14 makes it actually cover this
      story's strings, and Tasks 22-24 add the guard that was genuinely missing.
- [x] `npm run test`, `npm run build`, `php artisan test` all green.
      → Test plan table.
- [x] README / STATUS i18n notes corrected to match reality.
      → Task 25.

---

## Plan-review verdict (2026-09-10, Opus 5)

**CLEARED — 8/8 Done Criteria, all 25 tasks applied, all 10 edge cases covered.**
Gates: `php artisan test` 808/808 (3846 assertions) · `npm run test` 631/631 (103 files) ·
`npm run lint` + `check-no-literals.mjs` (366 files / 20 roots) · `npm run build` exit 0 ·
`tests/Feature/I18n` 17/17. Diff shape clean — zero forbidden paths, no scope creep.

Guards proven to fail, then reverted: reintroducing a hard-coded `match()` in
`MessageVisibility::label()` fails `EnumLabelLocaleTest.php:110`; copying an English string into
`ar` `validation.custom.branch.name_required` fails `CatalogueParityTest.php:45`.

Five executor deviations judged sound: the Task 14 key literal must carry the `validation.`
file prefix (`CatalogueParityTest.php:12` flattens with it); `validation.custom` keys are global
so `name`/`email`/`body` are form-prefixed with a one-line `messages()` (no English is reachable
on any path); `mimes` keeps an uppercase `:types` one-liner because the byte-identity contract
(`CustomerAttachmentTest.php:59` pins `PDF`) outranks the plan's soft "prefer `:values`";
`CustomerLocale::forTicket()` is nullable because both mailables reach the ticket through a
`BelongsTo`; English values are byte-identical throughout and no existing assertion changed.

**Plan defect recorded (not the executor's):** Task 9 keys `per_page.max` globally, so the four
other index requests (`IndexCustomerRequest.php:29`, `IndexKbArticleRequest.php:30`,
`IndexNotificationRequest.php:26`, `IndexUserRequest.php:30`) now render the audit-log wording.
Localised in both locales, and `per_page` is one of the 30 query params intake §4 records as never
surfacing in a form error — cosmetic, tracked separately.

---

## Expected diff

**Backend (24 files):** 4 new `lang` files (`{en,ar}/audit.php`, `{en,ar}/settings.php`); 4 edited
`lang` files (`{en,ar}/enums.php`, `{en,ar}/validation.php`); 6 enums; `Models/Ticket.php`;
`Services/AuditTrail.php`; `Services/SystemSettings.php`; new `Services/CustomerLocale.php`;
`Resources/AuditLogResource.php`; `Controllers/TicketController.php`;
`Controllers/CustomerController.php`; 11 `Http/Requests/*.php`; 2 `Mail/*.php`; `.env.example`;
`config/mail.php`.

**Backend tests (3):** `EnumLabelLocaleTest.php` (extended), `CatalogueParityTest.php` (one line),
new `ServerLabelLocaleTest.php`.

**Frontend (6):** `locales/{en,ar}/tickets.json`, `locales/{en,ar}/conversation.json`,
`features/tickets/model/display.ts`, `features/tickets/components/thread/ActivityList.tsx`,
plus `ActivityList.test.tsx`.

**Docs (2):** `STATUS.md`, `README.md`.

No migration. No new endpoint. No new component. No CSS.
