# Story 21 — Realistic Seed Data: Genuine Tickets, Threads & Timelines (Story: WIS-25)

---

## Prerequisites

- **Story 04 completed** ([`../ticket-management/04-story-ticket-management-queue.md`](../ticket-management/04-story-ticket-management-queue.md)) — owns `tickets`, `App\Enums\TicketStatus`, `App\Enums\Priority`, `App\Enums\Channel`, `Ticket::CATEGORIES` (`api/app/Models/Ticket.php:19`) and the `booted()` observer at `api/app/Models/Ticket.php:202–230` that writes a `ticket_events` row on every `created` and on every `status`/`priority`/`category`/`assigned_to` change. Seeding through `Ticket::create()` fires it. **Model events are not disabled anywhere in this story.**
- **Story 05 completed** ([`../conversation-thread/05-story-conversation-thread.md`](../conversation-thread/05-story-conversation-thread.md)) — owns `ticket_messages`, `TicketMessage::AUTHOR_CUSTOMER|AUTHOR_AGENT|AUTHOR_SYSTEM` (`api/app/Models/TicketMessage.php:20–24`) and `App\Enums\MessageVisibility`. `TicketMessageController::index` cursor-paginates at **30** (`api/app/Http/Controllers/TicketMessageController.php:38`), which is the only reason the long thread in Task 6 exists.
- **Story 06 completed** ([`../sla-rules-automation/06-story-sla-rules-automation.md`](../sla-rules-automation/06-story-sla-rules-automation.md)) — `App\Services\SlaClock::applyTo()` (`api/app/Services/SlaClock.php:52–95`) anchors **every** target on `$ticket->created_at`. That is the whole mechanism behind "SLA targets recomputed from the real created date": backdate first, call `applyTo()` second. `riskFor()` (`:134–159`) and `minutesLeft()` (`:162–173`) are the verdicts this story's dates are tuned against.
- **Story 13 completed** ([`../csat-collection/13-story-csat-collection.md`](../csat-collection/13-story-csat-collection.md)) — owns `csat_surveys`. **`App\Observers\TicketResolutionObserver::updated()` (`api/app/Observers/TicketResolutionObserver.php:23–34`) fires only on an `updated` event where `status` changed to `Resolved`.** It does **not** fire on `create`. Task 4's rule that every ticket is created with its final status is what keeps that observer inert and leaves CSAT entirely under the seeder's control.
- **Story 14 completed** ([`../channels-overview/14-story-channels-overview.md`](../channels-overview/14-story-channels-overview.md)) — `ChannelOverviewController` (`api/app/Http/Controllers/ChannelOverviewController.php:26–59`) groups by `channel` **inside a `created_at` window**. `ChannelOverviewRequest::PERIODS` is `7d|30d|90d` and `DEFAULT_PERIOD` is `30d` (`api/app/Http/Requests/ChannelOverviewRequest.php:23–25`). This is why Decision 8 exists.
- **Story 09 completed** — `api/database/seeders/KnowledgeBaseSeeder.php` is the in-repo precedent this story copies: a **separate seeder class**, called from `DatabaseSeeder`, with a header comment naming what it deliberately seeds and why (`:14–27`).
- **No coordination needed with any unfinished story.** This story adds no schema, no endpoint, and no frontend module.

---

## Story Goal

Make every seeded ticket read as a real support case, so a reviewer opening the running app or a screenshot sees a support desk rather than a fixture dump.

1. **Plausible subjects, in English and Arabic.** A pool of **40 authored scenarios** (both an EN and an AR subject on every row, `Ticket::CATEGORIES`-mapped), replacing `fake()->sentence(6)` for seeded rows.
2. **Coherent threads.** Every ticket except two deliberate empty-state rows carries **1–8 messages** alternating customer/agent, with a shape determined by its status: Open ends on the customer, Pending ends on an agent asking for information, Resolved/Closed contain an agent resolution message.
3. **A real timeline.** Ticket and message timestamps span **42 days**. Finished tickets are old; running tickets are hours old, because a 30-day-old Open ticket is a breached ticket, not a realistic one (Decision 4).
4. **Truthful SLA state.** `SlaClock::applyTo()` is re-run after every backdate, so the queue shows a designed mix — **3 breached, 3 at-risk, the rest healthy** among running tickets, and **2 deliberately missed** among finished ones.
5. **Truthful CSAT.** Surveys attach only to `Resolved`/`Closed` tickets that have a resolution message.
6. **Channel counts that reconcile.** `GET /api/channels/overview?period=90d` totals equal `Ticket::count()` per channel, exactly.

**Explicitly NOT in scope:**

- **No schema change.** No migration, no column, no table. This is a data story.
- **No change to any controller, resource, service or enum.** If seeded data and an endpoint disagree, the data is wrong.
- **No change to `TicketFactory`'s randomness contract.** 48 test files under `api/tests` call `Ticket::factory()`; it stays a general-purpose random generator (Decision 2).
- **No i18n work.** The Arabic subjects and bodies are *content* rows in a seeder. Nothing under `web/src/i18n` or `api/lang` changes.
- **No screenshot refresh.** `docs/screenshots/` is left alone; regenerating it is a follow-up.

---

## Context — Read These Files First

1. `api/database/seeders/DatabaseSeeder.php` — the whole file (378 lines). The regions this story replaces: the four hand-written tickets at **`:231–275`**, the three factory batches at **`:277–281`**, the SLA backdate-and-stamp block at **`:283–293`**, the two `seedThread()` calls at **`:295–310`**, the CSAT block at **`:316–334`**, and the private `seedThread()` helper at **`:348–377`**. Everything **above** line 231 (SLA rules, branches, departments, 14 users, 10 named customers, 40 customer-factory rows) is **kept unchanged**.
2. `api/app/Services/SlaClock.php` — read **`:52–95`** (`applyTo`, anchored on `created_at`), **`:98–103`** (`pause`), **`:126–131`** (`markFirstResponse`, first-caller-wins), **`:134–159`** (`riskFor` — note `:145–150`, a paused ticket's clock is frozen at `sla_paused_at`, and `:141–142`, a Resolved/Closed ticket answers `ok`/`breached` from `wasMetOnClose()` and never `at_risk`).
3. `api/app/Models/Ticket.php` — **`:19`** (`CATEGORIES`), **`:21–29`** (`$fillable`; note `resolved_at`, `closed_at`, `sla_paused_at`, `sla_paused_minutes` are all fillable), **`:89–92`** (`finishedAt()` — `resolved_at ?? closed_at`, order matters), **`:202–230`** (`booted()`), **`:265–276`** (`recordEvent()` — it stamps `created_at => now()`, which is why Task 7 exists).
4. `api/app/Models/TicketMessage.php` — **`:20–24`** author constants, **`:26`** `$fillable` (note `visibility` is fillable; `created_at`/`updated_at` are **not**, so threads must be written with `forceFill` or an explicit `created_at` key on a `new` model — see Task 5's `writeMessage()` signature).
5. `api/app/Observers/TicketResolutionObserver.php` — the whole file (77 lines). **`:25–31`** is the guard that keeps it inert when a ticket is *created* Resolved rather than *updated* to Resolved.
6. `api/app/Http/Requests/ChannelOverviewRequest.php:23–25` and `:52–58` — `DEFAULT_PERIOD = '30d'` and `window()` = `[now()->subDays(N)->startOfDay(), now()]`. Read this before writing the `/channels` verification command.
7. `api/database/seeders/KnowledgeBaseSeeder.php:14–27` and `:29–50` — the shape to copy: a class docblock listing what is deliberately seeded and why, `updateOrCreate` keyed on a natural key, and a private data method at the bottom of the class.
8. `api/app/Enums/Channel.php:6–10` — the five cases: `email`, `whatsapp`, `chat`, `sms`, `web_form`. `api/app/Enums/TicketStatus.php:6–9` — `open`, `pending`, `resolved`, `closed`. `api/app/Enums/Priority.php:10–13` — `low`, `normal`, `high`, `urgent`.
9. `api/app/Http/Controllers/TicketMessageController.php:33–39` — `->reorder('id','desc')->cursorPaginate(30)`. **30 is the page size the long thread in Task 6 must exceed.**
10. Grep `Ticket::factory` under `api/tests/` — **48 files**. Confirm for yourself that none of them seeds; then grep `DatabaseSeeder\|->seed(\|Seeder::class` under `api/tests/` — **zero hits**. Decision 9 rests on both results.
11. `README.md:88–128` — section 1, "Run it in 60 seconds". The seed-contents note goes after the credentials table at `:112–117` and before the SLA-engine paragraph at `:119`.
12. `api/phpunit.xml:53–58` — the suite runs against local PostgreSQL (`wisal_testing`/`wisal_test`), not SQLite. Any raw SQL added in a test must still satisfy the repo's dual-engine rule (`.squad/plans/00-index.md`, "Cross-cutting rules").

---

## Decisions

These are settled. Do not re-litigate them during implementation.

**Decision 1 — a new `TicketScenarioSeeder`, not a bigger `DatabaseSeeder`.**
`DatabaseSeeder::run()` is already 320 lines. Ticket generation moves into `api/database/seeders/TicketScenarioSeeder.php` (the engine) with its authored content in `api/database/seeders/data/ticket-scenarios.php` (a plain PHP file `return`ing an array, loaded with `require`, not autoloaded as a class). `DatabaseSeeder` keeps the users, branches, departments and customers it seeds today and gains **one** `$this->call(TicketScenarioSeeder::class)` line, exactly like the existing `KnowledgeBaseSeeder` call at `DatabaseSeeder.php:314`. The engine reads the users and customers it needs by email/name from the database — it does not take constructor arguments.

**Decision 2 — `TicketFactory` keeps its randomness; only its *lorem source* changes.**
48 test files call `Ticket::factory()` and several depend on it producing varied statuses and priorities. `definition()` (`api/database/factories/TicketFactory.php:21–34`) keeps every random element; only **`'subject' => fake()->sentence(6)`** becomes a random pick from a short constant array of realistic subjects, and **`'description' => fake()->paragraph()`** becomes a random pick from a short constant array of realistic openings (Task 8). No new state method, no removed state method, no changed default. **The seeder never calls `Ticket::factory()` at all** — factory tickets are for tests only from this story on.

**Decision 3 — every ticket is created with its FINAL status, in one `Ticket::create()`.**
No seeded ticket is created Open and later updated to Resolved. Two things depend on this: `TicketResolutionObserver::updated()` (`:25–31`) never fires, so no auto-minted CSAT survey with `resolved_by = null` appears; and `Ticket::booted()`'s `updated` hook (`api/app/Models/Ticket.php:206–219`) writes no `status_changed` history row dated today. Ticket history for seeded rows is the single `created` event, repaired to the ticket's real creation time by Task 7.

**Decision 4 — age is a function of status. This is the core of the story.**
The naive reading of "spread created_at over six weeks" produces a queue in which every Open ticket is catastrophically breached: a Normal ticket's resolution target is 1440 minutes (`DatabaseSeeder.php:52`), so an Open Normal ticket seeded 30 days back reads **–43,000 minutes**. Therefore:

| Status | Age of `created_at` | Why |
|---|---|---|
| `open`, `pending` | **1–76 hours** | The clock is running. Age is chosen per row to land a designed `riskFor()` verdict. |
| `resolved`, `closed` | **3–42 days** | The clock stopped at `finishedAt()`; age is free. **This is what makes the timeline span six weeks.** |

The multi-week span comes from the 32 finished tickets. Running tickets stay days old, which is what a real queue looks like.

**Decision 5 — the two deliberate empty-state rows are `Open`, never `Closed`.**
Today the no-message row is the Closed CSV ticket (`DatabaseSeeder.php:266–275`, commented at `:309`), which is precisely the "closed ticket with no conversation" the intake calls unbelievable. The empty state moves to two **just-arrived Open** tickets (schedule rows A-19 and A-20), where zero messages is the honest state. Both carry an inline comment saying so.

**Decision 6 — Pending tickets are paused; Resolved/Closed tickets are not.**
`SlaClock::pause()` is what the app does when a ticket enters Pending, and `riskFor()` freezes a paused clock at `sla_paused_at` (`SlaClock.php:147–150`). Every Pending row calls `$clock->pause($ticket, $lastMessageAt)` after `applyTo()`, so a Pending ticket's countdown reads the value it had when the agent last replied. `sla_paused_minutes` stays `0` — the pause is still open, it has not been resumed.

**Decision 7 — `resolved_at` is `created_at + resolve_hours`, authored per row, and it decides the closed-SLA verdict.**
`riskFor()` on a finished ticket delegates to `wasMetOnClose()` (`SlaClock.php:141–142`), which compares `finishedAt()` against `resolution_due_at`. Every Resolved/Closed schedule row therefore carries an explicit **`resolve_hours`** chosen against its priority's resolution target (Urgent 240 min / High 480 / Normal 1440 / Low 7200, `DatabaseSeeder.php:36–60`). **Two rows deliberately exceed their target** (C-07 and D-09) so a "missed SLA" figure in Reports is not zero. `closed_at` on a Closed row is `resolved_at + close_days`.

**Decision 8 — `/channels` is verified at `?period=90d`, not at the default.**
`DEFAULT_PERIOD` is `30d` (`ChannelOverviewRequest.php:25`) and the spread is 42 days, so the default view legitimately omits the oldest tickets. That is correct behaviour, not a bug, and the endpoint is **not** changed. The Done Criterion "`/channels` counts equal the actual per-channel ticket counts" is discharged against the **90d** window, which covers the whole spread. The verification command in step 4 says so explicitly. Also note `ChannelOverviewController::31` scopes by `Ticket::visibleTo($request->user())` — **verify as `admin@wisal.test` or `lead@wisal.test`**, because an Agent sees only their own tickets and their counts are correctly smaller.

**Decision 9 — no existing test is updated, because no existing test reads the seeder.**
The intake's "some tests assert on seeded shapes" was a defensive guess. Verified at plan time: `grep -rn "DatabaseSeeder\|->seed(\|Seeder::class" api/tests` returns **nothing**; every feature test builds rows from factories. In `web/`, the hits for `agent@wisal.test` are hard-coded vitest string fixtures, not assertions against a seeded database. **The executor re-runs both greps as step 0 of Task 9 and, if either now returns a hit, updates that test rather than the seeder.** New tests are added (Task 10); none are modified or deleted.

**Decision 10 — message bodies come from a template bank, subjects and openings are authored per scenario.**
Authoring 250 unique message bodies by hand is not a good use of the file. Each of the 40 scenarios authors its own **subject (EN + AR)** and its own **opening customer message (EN + AR)** — the two strings a reader actually notices. The intermediate turns are drawn deterministically from a **template bank** keyed by turn role (`agent_ack`, `agent_question`, `customer_followup`, `agent_update`, `customer_chase`, `agent_pending`, `agent_resolution`, `customer_thanks`), each with an EN and an AR variant list, and `agent_question`/`agent_resolution` additionally keyed by category. Every string is real prose. **No `fake()->paragraph()`, `fake()->sentence()`, `fake()->text()` or `fake()->realText()` call survives anywhere in `database/seeders/`.**

**Decision 11 — determinism.** `TicketScenarioSeeder::run()` calls `fake()->seed(20250909)` (or `mt_srand(20250909)`) as its first statement, so template-variant selection and intra-thread minute jitter are reproducible across runs. Timestamps are still relative to `now()`, so re-seeding a week later shifts the whole window forward — that is intended.

---

## Backend Tasks

`No frontend changes required.` Nothing under `web/` is edited by this story.

### 1 — Create the scenario pool

**Create file:** `api/database/seeders/data/ticket-scenarios.php`

A plain PHP file returning a list of 40 scenario rows. **Not a class** — it is loaded with `require __DIR__.'/data/ticket-scenarios.php'`.

Row shape:

```php
[
    'key'        => 'tech-01',        // stable id; the schedule table references it
    'category'   => 'technical',      // MUST be one of Ticket::CATEGORIES
    'lang'       => 'en',             // 'en' | 'ar' — picks which subject/opening is used
    'subject_en' => '…',
    'subject_ar' => '…',
    'opening_en' => '…',              // the customer's first message; also the ticket description
    'opening_ar' => '…',
],
```

**Rules the executor must hold:** `category` ∈ `Ticket::CATEGORIES` (`api/app/Models/Ticket.php:19`); `subject_*` ≤ 120 characters (the column is `string` = varchar(255), `2026_08_25_200001_create_tickets_table.php:14`); `opening_*` is 1–3 sentences of ordinary customer prose, never a bug report template; the AR strings are real Arabic, not transliteration.

The 40 rows, with the subject pair authored for each. `L` marks the language actually used (`lang`):

| key | cat | L | `subject_en` | `subject_ar` |
|---|---|---|---|---|
| tech-01 | technical | en | Email integration stopped syncing after the weekend | توقف تكامل البريد الإلكتروني عن المزامنة بعد عطلة نهاية الأسبوع |
| tech-02 | technical | ar | WhatsApp messages are not reaching the inbox | رسائل واتساب لا تصل إلى صندوق الوارد |
| tech-03 | technical | en | Attachments over 5 MB fail to upload | فشل رفع المرفقات التي يزيد حجمها عن 5 ميجابايت |
| tech-04 | technical | en | Webhook deliveries have returned 500 since Tuesday | إرسال الـ webhook يعيد الخطأ 500 منذ يوم الثلاثاء |
| tech-05 | technical | ar | The ticket list takes over 30 seconds to load | بطء شديد في تحميل قائمة التذاكر |
| tech-06 | technical | en | SSO login loops back to the sign-in page | تسجيل الدخول الموحّد يعيدني إلى صفحة الدخول |
| tech-07 | technical | en | Mobile app crashes when opening a ticket thread | تطبيق الجوال يتوقف عند فتح محادثة التذكرة |
| tech-08 | technical | ar | Reports show empty data after the latest update | التقارير تظهر بيانات فارغة بعد التحديث الأخير |
| tech-09 | technical | en | Search returns no results for Arabic customer names | البحث لا يعيد أي نتائج لأسماء العملاء بالعربية |
| tech-10 | technical | en | Notification emails land in the spam folder | رسائل الإشعارات تصل إلى مجلد البريد غير المرغوب |
| tech-11 | technical | ar | Report export to Excel fails silently | لا يمكن تصدير التقرير إلى ملف Excel |
| tech-12 | technical | en | API rate limit is hit during the nightly sync | تجاوز حد الطلبات على الـ API أثناء المزامنة الليلية |
| bill-01 | billing | en | Invoice charged twice for the March subscription | تم خصم فاتورة اشتراك مارس مرتين |
| bill-02 | billing | ar | Request to upgrade the subscription to Enterprise | طلب ترقية الاشتراك إلى الباقة المؤسسية |
| bill-03 | billing | en | VAT number missing from the last three invoices | الرقم الضريبي غير مذكور في آخر ثلاث فواتير |
| bill-04 | billing | en | Refund not received ten days after cancellation | لم يصل المبلغ المسترد بعد عشرة أيام من الإلغاء |
| bill-05 | billing | ar | Card payment failed at renewal | فشل الدفع بالبطاقة الائتمانية عند التجديد |
| bill-06 | billing | en | Seat count on the invoice does not match our team size | عدد المستخدمين في الفاتورة لا يطابق حجم فريقنا |
| bill-07 | billing | en | Purchase order number needs to appear on invoices | يجب إظهار رقم أمر الشراء على الفواتير |
| bill-08 | billing | ar | Question about an extra charge on the August invoice | استفسار عن رسوم إضافية في فاتورة أغسطس |
| acct-01 | account | en | Password reset email never arrives | رسالة إعادة تعيين كلمة المرور لا تصل |
| acct-02 | account | en | Locked out after too many failed sign-in attempts | تم قفل الحساب بعد محاولات دخول فاشلة متكررة |
| acct-03 | account | ar | Request to change the primary account email | طلب تغيير البريد الإلكتروني للحساب الرئيسي |
| acct-04 | account | en | New agent cannot see the team queue | الموظف الجديد لا يرى قائمة تذاكر الفريق |
| acct-05 | account | en | Two-factor codes are rejected as invalid | رموز التحقق بخطوتين تُرفض باعتبارها غير صحيحة |
| acct-06 | account | ar | Deactivate the account of an employee who left | إلغاء تفعيل حساب موظف غادر الشركة |
| acct-07 | account | en | Admin role was removed by mistake | تم سحب صلاحية المدير عن طريق الخطأ |
| acct-08 | account | en | Company name is spelled incorrectly on the profile | اسم الشركة مكتوب بشكل خاطئ في الملف التعريفي |
| gen-01 | general | en | How do I add a second branch to our workspace? | كيف أضيف فرعًا ثانيًا إلى مساحة العمل؟ |
| gen-02 | general | ar | What are the support team's working hours? | ما هي ساعات عمل فريق الدعم؟ |
| gen-03 | general | en | Onboarding session request for five new agents | طلب جلسة تعريفية لخمسة موظفين جدد |
| gen-04 | general | en | Where can I find the data retention policy? | أين أجد سياسة الاحتفاظ بالبيانات؟ |
| gen-05 | general | ar | Request a copy of the SLA agreement | طلب نسخة من اتفاقية مستوى الخدمة |
| gen-06 | general | en | Moving our workspace to a different time zone | نقل مساحة العمل إلى منطقة زمنية أخرى |
| feat-01 | feature_request | en | Export the ticket queue to CSV | تصدير قائمة التذاكر إلى ملف CSV |
| feat-02 | feature_request | ar | Add push notifications on mobile | إضافة إشعارات فورية على الهاتف المحمول |
| feat-03 | feature_request | en | Bulk reassign tickets between agents | إعادة إسناد التذاكر بالجملة بين الموظفين |
| feat-04 | feature_request | en | Saved filter views on the ticket queue | حفظ طرق عرض التصفية في قائمة التذاكر |
| feat-05 | feature_request | ar | Arabic support for saved quick replies | دعم الردود الجاهزة باللغة العربية |
| feat-06 | feature_request | en | Dark mode for the customer portal | الوضع الداكن لبوابة العملاء |

**Language tally: 13 Arabic rows** (tech-02, tech-05, tech-08, tech-11, bill-02, bill-05, bill-08, acct-03, acct-06, gen-02, gen-05, feat-02, feat-05), 27 English. All 40 carry both strings.

`opening_en` / `opening_ar` are authored to match the subject. Examples of the register required (write the remaining 38 in the same voice):

- **tech-01** — EN: `"Our inbox stopped pulling new mail some time on Saturday. Nothing has come through since, and sending still works. Can you check the connection on your side?"` · AR: `"توقف صندوق الوارد لدينا عن سحب الرسائل الجديدة يوم السبت. لم يصلنا أي شيء منذ ذلك الحين، بينما لا تزال عملية الإرسال تعمل. هل يمكنكم التحقق من الاتصال من جانبكم؟"`
- **bill-01** — EN: `"We were charged twice for the March subscription on the same card, two days apart. The second charge has cleared. Could you confirm and refund the duplicate?"` · AR: `"تم خصم اشتراك مارس مرتين من نفس البطاقة بفارق يومين. الخصم الثاني تمت معالجته بالفعل. هل يمكنكم التأكد واسترجاع المبلغ المكرر؟"`

---

### 2 — Create the message template bank

**Create file:** `api/database/seeders/data/ticket-message-templates.php`

Returns a nested array. Top level = turn role; each role maps to `['en' => [...variants], 'ar' => [...variants]]`. Two roles are additionally keyed by category first.

```php
return [
    'agent_ack'        => ['en' => [ /* ≥5 */ ], 'ar' => [ /* ≥5 */ ]],
    'agent_question'   => ['technical' => ['en' => [...], 'ar' => [...]], 'billing' => [...], 'account' => [...], 'general' => [...], 'feature_request' => [...]],
    'customer_followup'=> ['en' => [ /* ≥5 */ ], 'ar' => [ /* ≥5 */ ]],
    'agent_update'     => ['en' => [ /* ≥4 */ ], 'ar' => [ /* ≥4 */ ]],
    'customer_chase'   => ['en' => [ /* ≥4 */ ], 'ar' => [ /* ≥4 */ ]],
    'agent_pending'    => ['en' => [ /* ≥4 */ ], 'ar' => [ /* ≥4 */ ]],
    'agent_resolution' => ['technical' => ['en' => [...], 'ar' => [...]], 'billing' => [...], 'account' => [...], 'general' => [...], 'feature_request' => [...]],
    'customer_thanks'  => ['en' => [ /* ≥4 */ ], 'ar' => [ /* ≥4 */ ]],
    'internal_note'    => ['en' => [ /* ≥4 */ ], 'ar' => [ /* ≥4 */ ]],
];
```

Register per role, with one example each (write ≥3 more variants per list):

- **`agent_ack`** — EN `"Thanks for getting in touch. I have the details and I'm looking into it now — I'll come back to you shortly."` · AR `"شكرًا لتواصلك معنا. اطّلعت على التفاصيل وأنا أتابع الأمر الآن، وسأعود إليك قريبًا."`
- **`agent_question` / technical** — EN `"Could you tell me roughly when this started, and whether it affects every user or only some accounts? A screenshot of the error would help too."` · AR `"هل يمكنك إخباري تقريبًا متى بدأت المشكلة، وهل تؤثر على جميع المستخدمين أم على بعض الحسابات فقط؟ صورة للخطأ ستكون مفيدة أيضًا."`
- **`agent_question` / billing** — EN `"Could you send me the invoice number and the last four digits of the card so I can match it to the transaction?"` · AR `"هل يمكنك إرسال رقم الفاتورة وآخر أربعة أرقام من البطاقة حتى أتمكن من مطابقتها بالعملية؟"`
- **`customer_followup`** — EN `"It started on Monday morning and it affects the whole team, not just my account. I've attached what I can see on my screen."` · AR `"بدأت المشكلة صباح الاثنين وتؤثر على الفريق بأكمله وليس على حسابي فقط. أرفقت ما يظهر على شاشتي."`
- **`agent_update`** — EN `"A quick update: I've reproduced this on our side and passed it to the platform team. I'll let you know as soon as there's a fix."` · AR `"تحديث سريع: تمكّنت من إعادة إنتاج المشكلة لدينا وأحلتها إلى فريق المنصة، وسأعلمك فور توفر حل."`
- **`customer_chase`** — EN `"Any news on this? It's starting to hold up our week."` · AR `"هل من جديد بخصوص هذا الموضوع؟ بدأ الأمر يعطّل عملنا هذا الأسبوع."`
- **`agent_pending`** — EN `"I need one more thing before I can go further: could you confirm the account email you're signing in with? I'll keep this ticket open on your side until then."` · AR `"أحتاج إلى معلومة أخيرة قبل المتابعة: هل يمكنك تأكيد البريد الإلكتروني الذي تسجّل الدخول به؟ سأبقي التذكرة بانتظار ردك."`
- **`agent_resolution` / technical** — EN `"This is fixed — the connector was re-authorised and mail has been flowing since 09:40. Please confirm you're seeing new messages, and I'll close this off."` · AR `"تم حل المشكلة — أُعيد تفويض الموصّل ووصلت الرسائل منذ الساعة 09:40. يرجى التأكيد بأنك ترى الرسائل الجديدة وسأقوم بإغلاق التذكرة."`
- **`agent_resolution` / billing** — EN `"The duplicate charge has been refunded and should reach the card within five working days. A corrected invoice is attached."` · AR `"تمت إعادة المبلغ المكرر وسيصل إلى البطاقة خلال خمسة أيام عمل. الفاتورة المصححة مرفقة."`
- **`customer_thanks`** — EN `"Confirmed, everything is working again. Thanks for the quick turnaround."` · AR `"تم التأكد، كل شيء يعمل مجددًا. شكرًا على سرعة الاستجابة."`
- **`internal_note`** — EN `"Noting for the team: this is the third report of the same connector fault this month. Flagged to platform."` · AR `"للتوثيق للفريق: هذه ثالث حالة لنفس عطل الموصّل هذا الشهر. تم إبلاغ فريق المنصة."`

---

### 3 — Create the schedule

**Create file:** `api/database/seeders/data/ticket-schedule.php`

Returns **64 instance rows** in four status blocks. Every row references a `key` from Task 1. A scenario may appear more than once — a second customer reporting the same thing at a different time is realistic, and the engine gives it a different thread.

Row shape:

```php
[
    'key'      => 'tech-01',
    'status'   => 'open',      // TicketStatus value
    'priority' => 'high',      // Priority value
    'channel'  => 'email',     // Channel value
    'assignee' => 'agent1',    // 'agent1' | 'agent2' | null
    'age'      => ['hours' => 9],           // open/pending
    // or        ['days' => 28, 'resolve_hours' => 6, 'close_days' => 2]  // resolved/closed
    'turns'    => 4,           // total messages; 0 = deliberate empty state
    'note'     => 'breached',  // optional, informational only — see Verification step 3
],
```

#### Block A — `open`, 20 rows

Rows A-01…A-08 are **unassigned** (`'assignee' => null`) with **customer-only** threads — nobody has picked them up yet, so no agent has replied. Rows A-19 and A-20 are the two **deliberate empty-state** rows (Decision 5).

| # | key | prio | channel | age | assignee | turns | intended `riskFor()` |
|---|---|---|---|---|---|---|---|
| A-01 | tech-03 | normal | web_form | 5h | — | 1 | ok |
| A-02 | gen-01 | low | web_form | 30h | — | 1 | ok |
| A-03 | feat-01 | low | web_form | 52h | — | 2 | ok |
| A-04 | acct-08 | low | email | 9h | — | 1 | ok |
| A-05 | gen-04 | low | web_form | 76h | — | 1 | ok |
| A-06 | feat-04 | low | email | 21h | — | 2 | ok |
| A-07 | bill-07 | normal | email | 3h | — | 1 | ok |
| A-08 | gen-06 | low | chat | 14h | — | 1 | ok |
| A-09 | tech-01 | high | email | 9h | agent1 | 4 | **breached** |
| A-10 | tech-06 | urgent | chat | 5h | agent1 | 3 | **breached** |
| A-11 | tech-09 | normal | email | 20h | agent1 | 4 | **at_risk** |
| A-12 | tech-12 | high | email | 7h | agent1 | 3 | **at_risk** |
| A-13 | acct-04 | normal | chat | 6h | agent1 | 3 | ok |
| A-14 | gen-03 | low | email | 40h | agent1 | 2 | ok |
| A-15 | bill-01 | high | email | 10h | agent2 | 4 | **breached** |
| A-16 | bill-04 | normal | email | 22h | agent2 | 5 | **at_risk** |
| A-17 | bill-08 | normal | whatsapp | 4h | agent2 | 3 | ok |
| A-18 | acct-01 | urgent | sms | 2h | agent2 | 3 | ok |
| A-19 | acct-05 | urgent | chat | 1h | agent2 | **0** | ok — *empty state* |
| A-20 | feat-06 | low | web_form | 6h | agent2 | **0** | ok — *empty state* |

The verdicts follow arithmetically from the seeded SLA rules (`api/database/seeders/DatabaseSeeder.php:36–60`) and `SlaClock::applyTo`'s at-risk formula (`api/app/Services/SlaClock.php:76–78`, `at_risk_threshold_pct = 80`): Urgent resolution 240 min / at-risk from 192; High 480 / 384; Normal 1440 / 1152; Low 7200 / 5760. A row is `breached` when its age exceeds the resolution figure, `at_risk` between the two, `ok` below.

#### Block B — `pending`, 12 rows

All paused (Decision 6). Each thread ends on the agent's `agent_pending` turn.

| # | key | prio | channel | age | assignee | turns |
|---|---|---|---|---|---|---|
| B-01 | tech-04 | high | email | 26h | agent1 | 5 |
| B-02 | tech-05 | normal | whatsapp | 34h | agent1 | 4 |
| B-03 | tech-07 | normal | chat | 18h | agent1 | 4 |
| B-04 | tech-10 | low | email | 60h | agent1 | 3 |
| B-05 | acct-02 | normal | chat | 12h | agent1 | 4 |
| B-06 | gen-05 | low | email | 48h | agent1 | 3 |
| B-07 | feat-02 | low | whatsapp | 70h | agent1 | 3 |
| B-08 | bill-03 | normal | email | 30h | agent2 | 5 |
| B-09 | bill-05 | high | whatsapp | 16h | agent2 | 4 |
| B-10 | bill-06 | normal | email | 44h | agent2 | 4 |
| B-11 | acct-03 | normal | email | 25h | agent2 | 4 |
| B-12 | acct-07 | high | chat | 11h | agent2 | 3 |

#### Block C — `resolved`, 14 rows

`resolved_at = created_at + resolve_hours`; `closed_at` stays **null**.

| # | key | prio | channel | days | resolve_h | assignee | turns | closed-SLA |
|---|---|---|---|---|---|---|---|---|
| C-01 | tech-02 | high | whatsapp | 6 | 5 | agent1 | 5 | ok |
| C-02 | tech-08 | normal | email | 11 | 18 | agent1 | 6 | ok |
| C-03 | tech-11 | normal | email | 15 | 20 | agent1 | 5 | ok |
| C-04 | acct-06 | low | email | 9 | 40 | agent1 | 4 | ok |
| C-05 | gen-02 | low | chat | 4 | 2 | agent1 | 3 | ok |
| C-06 | feat-03 | low | web_form | 19 | 60 | agent1 | 4 | ok |
| C-07 | tech-09 | high | chat | 8 | **9** | agent1 | 5 | **breached** (target 8h) |
| C-08 | bill-02 | normal | email | 7 | 6 | agent2 | 5 | ok |
| C-09 | bill-04 | normal | email | 13 | 22 | agent2 | 6 | ok |
| C-10 | bill-08 | low | whatsapp | 5 | 30 | agent2 | 4 | ok |
| C-11 | acct-01 | urgent | sms | 3 | 2 | agent2 | 4 | ok |
| C-12 | acct-05 | high | chat | 17 | 5 | agent2 | 5 | ok |
| C-13 | gen-01 | low | web_form | 21 | 70 | agent2 | 3 | ok |
| C-14 | feat-05 | low | email | 24 | 90 | agent2 | 4 | ok |

#### Block D — `closed`, 18 rows

`resolved_at = created_at + resolve_hours`; `closed_at = resolved_at + close_days`.

| # | key | prio | channel | days | resolve_h | close_d | assignee | turns | closed-SLA |
|---|---|---|---|---|---|---|---|---|---|
| D-01 | tech-01 | high | email | 28 | 6 | 2 | agent1 | **36** | ok — *the long thread, Task 6* |
| D-02 | tech-03 | normal | email | 31 | 15 | 2 | agent1 | 5 | ok |
| D-03 | tech-06 | urgent | chat | 26 | 3 | 1 | agent1 | 6 | ok |
| D-04 | tech-12 | high | email | 35 | 7 | 3 | agent1 | 5 | ok |
| D-05 | acct-02 | normal | chat | 23 | 10 | 2 | agent1 | 5 | ok |
| D-06 | acct-04 | normal | email | 38 | 20 | 2 | agent1 | 4 | ok |
| D-07 | gen-03 | low | email | 40 | 50 | 3 | agent1 | 4 | ok |
| D-08 | feat-01 | low | web_form | **42** | 100 | 3 | agent1 | 5 | ok — *the oldest ticket* |
| D-09 | tech-07 | high | whatsapp | 29 | **12** | 2 | agent1 | 6 | **breached** (target 8h) |
| D-10 | bill-01 | high | email | 27 | 5 | 2 | agent2 | 6 | ok — *mixed-channel, Task 6* |
| D-11 | bill-03 | normal | email | 33 | 16 | 2 | agent2 | 5 | ok |
| D-12 | bill-05 | high | whatsapp | 25 | 4 | 1 | agent2 | 5 | ok |
| D-13 | bill-06 | normal | sms | 36 | 21 | 3 | agent2 | 4 | ok |
| D-14 | bill-07 | low | email | 39 | 65 | 2 | agent2 | 4 | ok |
| D-15 | acct-03 | normal | email | 30 | 19 | 2 | agent2 | 5 | ok |
| D-16 | acct-07 | urgent | chat | 22 | 3 | 1 | agent2 | 5 | ok |
| D-17 | gen-04 | low | web_form | 41 | 80 | 3 | agent2 | 3 | ok |
| D-18 | feat-04 | low | chat | 37 | 110 | 4 | agent2 | 4 | ok |

#### Invariants the schedule encodes — assert these in Task 10

| Dimension | Expected |
|---|---|
| Total tickets | **64** |
| Status | open **20**, pending **12**, resolved **14**, closed **18** |
| Channel | email **30**, chat **14**, web_form **9**, whatsapp **8**, sms **3** |
| Assignee | agent1 **29**, agent2 **27**, unassigned **8** (all unassigned are Open) |
| Tickets with zero messages | **2** (A-19, A-20), both Open |
| Age span | oldest `created_at` = 42 days (D-08); newest = 1 hour (A-19) |
| Running-clock verdicts | breached **3**, at_risk **3** (Open only; Pending are frozen) |
| Finished-clock verdicts | breached **2** (C-07, D-09) |

---

### 4 — Create the engine

**Create file:** `api/database/seeders/TicketScenarioSeeder.php`

```php
<?php

namespace Database\Seeders;

use App\Enums\Channel;
use App\Enums\MessageVisibility;
use App\Enums\Priority;
use App\Enums\TicketStatus;
use App\Models\CsatSurvey;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use App\Models\User;
use App\Services\SlaClock;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Story 21 (WIS-25) — realistic ticket seed data.
 *
 * Replaces the 60 `Ticket::factory()` filler rows the DatabaseSeeder used to
 * create. Every ticket here is one row of data/ticket-schedule.php, pointing
 * at one authored scenario in data/ticket-scenarios.php, with a thread built
 * from data/ticket-message-templates.php.
 *
 * Three properties this file exists to guarantee:
 *  - Age follows status. A running ticket is HOURS old; a finished one is
 *    DAYS old. A 30-day-old Open ticket is a breached ticket, not a realistic
 *    one — see the plan's Decision 4.
 *  - Every ticket is CREATED with its final status. Nothing here transitions a
 *    ticket, so TicketResolutionObserver never mints a survey behind our back
 *    and no `status_changed` history row is written dated today.
 *  - SlaClock::applyTo() runs AFTER created_at is backdated, because it
 *    anchors every target on created_at.
 *
 * Deliberately seeded: two Open tickets with zero messages (the empty state),
 * two tickets whose SLA was missed on close, one 36-message thread (the
 * message index cursor-paginates at 30), two multi-channel threads, and four
 * internal notes.
 */
class TicketScenarioSeeder extends Seeder
{
    public function run(): void { /* … */ }
}
```

`run()` in order:

1. `mt_srand(20250909);` and `fake()->seed(20250909);` — Decision 11.
2. Resolve the actors: `$agents = ['agent1' => User::where('email','agent@wisal.test')->firstOrFail(), 'agent2' => User::where('email','agent2@wisal.test')->firstOrFail()];`
3. Resolve the customer pool: `$customers = Customer::query()->orderBy('id')->get();` — **`->firstOrFail()` on an empty pool must not happen**; guard with `if ($customers->isEmpty()) { $this->command?->warn('…'); return; }`.
4. `$scenarios = collect(require __DIR__.'/data/ticket-scenarios.php')->keyBy('key');`
   `$templates = require __DIR__.'/data/ticket-message-templates.php';`
   `$schedule  = require __DIR__.'/data/ticket-schedule.php';`
5. `$clock = app(SlaClock::class);`
6. Loop the schedule with index `$i`; for each row call `$this->seedTicket(...)`, assigning the customer **round-robin** — `$customers[$i % $customers->count()]` — biased so the first 10 named customers (the design-matched rows, `DatabaseSeeder.php:199–226`) each get **at least three** tickets: iterate the first 32 schedule rows over `$customers->take(10)` and the remaining 32 over the whole collection.

`seedTicket()` steps, in this exact order — **the order is the contract**:

```
a. $createdAt = age.hours ? now()->subHours(h) : now()->subDays(d);
   For a 'days' row, jitter the time of day: ->setTime(mt_rand(8,17), mt_rand(0,59));
   For an 'hours' row, keep the exact offset (the SLA verdicts depend on it) and
   only jitter seconds.
b. $ticket = Ticket::create([...])   // final status, subject/description from the
   scenario in its `lang`, category, channel, priority, assigned_to, created_by
   = assignee id ?? null, customer_id, resolved_at / closed_at computed here.
c. $ticket->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
d. $messages = $this->seedThread($ticket, $row, $scenario, $templates, $agent);
e. if ($messages non-empty) $ticket->forceFill(['updated_at' => last message created_at])->save();
f. $clock->applyTo($ticket);                       // AFTER (c) — anchors on created_at
   if (first agent message exists) $clock->markFirstResponse($ticket, $firstAgentAt);
   if (status === Pending)         $clock->pause($ticket, $lastMessageAt ?? $createdAt);
   $ticket->save();
g. Task 7's ticket_events repair.
h. if (status is Resolved or Closed) and this row is in the CSAT list → Task 8.
```

**`resolved_at` / `closed_at` (step b):**
`resolved_at = $createdAt->copy()->addHours($row['age']['resolve_hours'])` for both Resolved and Closed rows. `closed_at = $resolvedAt->copy()->addDays($row['age']['close_days'])` for Closed rows only; **null on Resolved rows**. Open/Pending rows leave both null. `Ticket::finishedAt()` (`api/app/Models/Ticket.php:89–92`) returns `resolved_at` first, so a Closed row's SLA verdict is judged on the resolution moment, which is correct.

---

### 5 — Thread generation

**Same file**, private methods on `TicketScenarioSeeder`.

```php
/** @return array<int, TicketMessage> in chronological order */
private function seedThread(Ticket $ticket, array $row, array $scenario, array $templates, ?User $agent): array
```

**Turn plan** — build an ordered list of `[role, isAgent]` pairs from `status` and `turns`, then truncate/extend the middle to hit exactly `turns` messages:

| status | turn plan |
|---|---|
| `open`, **unassigned** | `customer:opening` → (`customer:customer_chase`) — **never an agent turn**; `turns` is 1 or 2 |
| `open`, assigned | `customer:opening` → `agent:agent_ack` → [`agent:agent_question` → `customer:customer_followup`]* → **`customer:customer_followup`** — the last message is always the customer |
| `pending` | `customer:opening` → `agent:agent_ack` → [`customer:customer_followup` → `agent:agent_update`]* → **`agent:agent_pending`** — the last message is always the agent |
| `resolved`, `closed` | `customer:opening` → `agent:agent_ack` → [`agent:agent_question` → `customer:customer_followup`]* → **`agent:agent_resolution`** → (`customer:customer_thanks`) |

Rules the executor must enforce mechanically:

- **`turns === 0` → return `[]` immediately.** Rows A-19 and A-20 only.
- The **first** message is always `customer` and its body is the scenario's `opening_{lang}`. It is also the ticket's `description` (set in step b).
- **Open threads must end on a customer message.** If the truncation would land on an agent turn, drop that agent turn.
- **Pending threads must end on the `agent_pending` message.**
- **Resolved/Closed threads must contain the `agent_resolution` message, and it must be the last *agent* message.** A `customer_thanks` may follow it (add it when `turns` is even for Resolved/Closed rows, so roughly half have one).
- **Unassigned tickets get no agent message at all**, so `markFirstResponse` is never called for them and their first-response SLA stays open. That is the honest state for a ticket nobody has picked up.

**Body selection:** `$templates[$role][$lang][ $index % count($variants) ]` where `$index` is a per-role running counter across the whole seed run, so consecutive tickets do not repeat the same variant. For `agent_question` and `agent_resolution`, index into `$templates[$role][$scenario['category']][$lang]` instead.

**Timestamps:** walk forward from `$ticket->created_at`. The first message shares the ticket's `created_at` exactly. Each subsequent message adds a gap:

- Running tickets (`open`/`pending`): gap = `mt_rand(12, 95)` minutes, and **the last message must not exceed `now()`** — if it would, compress all gaps proportionally.
- Finished tickets: distribute the messages evenly across `created_at → resolved_at`, then jitter each by ±20% of the interval, keeping the sequence strictly increasing. **The `agent_resolution` message's timestamp is `resolved_at` exactly.** A `customer_thanks` after it lands `resolved_at + mt_rand(30, 240)` minutes, which is **before** `closed_at` on every Block D row (min `close_days` is 1 = 1440 minutes).

**Writing a message** (`created_at` is **not** in `TicketMessage::$fillable`, `api/app/Models/TicketMessage.php:26`):

```php
private function writeMessage(
    Ticket $ticket,
    string $authorType,
    ?User $agent,
    Channel $channel,
    string $body,
    Carbon $at,
    MessageVisibility $visibility = MessageVisibility::Public,
): TicketMessage {
    $message = TicketMessage::create([
        'ticket_id'   => $ticket->id,
        'author_type' => $authorType,
        'user_id'     => $authorType === TicketMessage::AUTHOR_AGENT ? $agent?->id : null,
        'customer_id' => $authorType === TicketMessage::AUTHOR_CUSTOMER ? $ticket->customer_id : null,
        'channel'     => $channel->value,
        'body'        => $body,
        'visibility'  => $visibility->value,
    ]);

    // created_at is not fillable; the timestamp is stamped after insert.
    $message->forceFill(['created_at' => $at, 'updated_at' => $at])->save();

    return $message;
}
```

Do **not** disable model timestamps globally to achieve this, and do **not** use `saveQuietly()` — `TicketMessage` has no observer that this needs to bypass.

---

### 6 — The four deliberate outliers

These exist so a manual reviewer can reach paths that a uniform seed hides. Each gets an inline comment in `TicketScenarioSeeder` naming why.

1. **The long thread — schedule row D-01, `turns: 36`.** `TicketMessageController::index` cursor-paginates at **30** (`api/app/Http/Controllers/TicketMessageController.php:38`), so a 36-message ticket is the only way "Load earlier messages" is reachable in the running app. The existing seeder provides this via `seedThread(..., extra: 32)` at `DatabaseSeeder.php:301`; **that capability must not be lost.** Build it as: `customer:opening`, then 33 alternating `agent_update` / `customer_followup` turns, then `agent:agent_resolution`, then `customer:customer_thanks`.
2. **Two mixed-channel threads.** On **C-01** (ticket channel `whatsapp`) one agent turn is written with `Channel::Email`; on **D-10** (ticket channel `email`) one customer turn is written with `Channel::Whatsapp`. This preserves what `DatabaseSeeder.php:303–307` demonstrates today — that `GET /api/tickets/{id}/messages` returns one continuous multi-channel list. **Message channel does not affect `/channels` counts**, which group on `tickets.channel` (`ChannelOverviewController.php:36–38`), so the tallies in Task 3 stand.
3. **Four internal notes.** On rows **A-09**, **B-08**, **C-02** and **D-03**, insert one extra agent message with `'visibility' => MessageVisibility::Internal->value` and a body from `internal_note`, placed second-to-last. It counts toward `turns`. This makes the public/internal split visible in the running app; `InternalNoteVisibilityTest` already covers it in tests.
4. **Two empty-state Open tickets** — A-19, A-20 (Decision 5).

---

### 7 — Repair `ticket_events` timestamps

`Ticket::recordEvent()` (`api/app/Models/Ticket.php:265–276`) writes `'created_at' => now()`, so the `created` event that fires inside `Ticket::create()` is dated today even for a 42-day-old ticket. The ticket-detail history panel would show "Ticket created — 2 minutes ago" on every seeded row.

After step (c) of `seedTicket()`:

```php
TicketEvent::query()
    ->where('ticket_id', $ticket->id)
    ->where('event', 'created')
    ->update(['created_at' => $createdAt]);
```

For Resolved and Closed rows, also **append** the history the ticket would really have, with `user_id` = the assignee:

```php
TicketEvent::create(['ticket_id' => $ticket->id, 'user_id' => $agent?->id, 'event' => 'status_changed',
    'field' => 'status', 'old_value' => 'open', 'new_value' => 'resolved', 'created_at' => $resolvedAt]);
// Closed rows only:
TicketEvent::create([... 'old_value' => 'resolved', 'new_value' => 'closed', 'created_at' => $closedAt]);
```

`TicketEvent::create()` accepts `created_at` because `ticket_events` has no `updated_at` and the column is a plain fillable timestamp (`api/database/migrations/2026_08_27_120200_create_ticket_events_table.php:19`). Confirm `created_at` is in `TicketEvent::$fillable`; if it is not, use `forceFill(...)->save()` after create rather than editing the model.

---

### 8 — CSAT, only on genuinely resolved tickets

**In `TicketScenarioSeeder`**, replacing `DatabaseSeeder.php:316–334` (which attaches surveys to the first nine tickets of two agents regardless of status).

Attach a survey to the **first 12 Block C/D rows in schedule order** — 6 from Block C, 6 from Block D. Every one of them has a resolution message and a non-null `resolved_at`, so the survey is truthful.

```php
CsatSurvey::create([
    'ticket_id'        => $ticket->id,
    'resolution_cycle' => 1,
    'resolved_by'      => $ticket->assigned_to,          // never null on these rows
    'resolved_at'      => $ticket->resolved_at,          // the REAL resolution moment
    'rating'           => $rating,                        // see below
    'comment'          => $comment,                       // see below
    'responded_at'     => $rating === null ? null : $ticket->resolved_at->copy()->addHours($respondHours),
    'expires_at'       => $ticket->resolved_at->copy()->addDays(30),
]);
```

Ratings, in order, so the Reports CSAT average is a plausible 4.2 and every star bucket is populated:
`[5, 4, 5, 3, 4, 5, 2, 4, 5, 4, null, 5]` — **one `null`** (index 10) is the deliberate outstanding survey, and its ticket must be one whose `resolved_at + 30 days` is still in the **future** (pick a Block C row with `days ≤ 14`, i.e. C-05, so `state` resolves to `Outstanding`, not `Expired` — see `CsatSurvey::getStateAttribute()`, `api/app/Models/CsatSurvey.php:62–74`).
Comments: attach a real sentence to indices 0, 3, 6 and 9 — e.g. `"Fixed on the same day and explained clearly. No complaints."`, `"Took a couple of rounds but got there in the end."` — and leave the rest null. Use one Arabic comment (index 3): `"تمت المعالجة بسرعة والشرح كان واضحًا."`

**Delete** the `$resolvedTickets`/`$ratings` block at `DatabaseSeeder.php:316–334` entirely.

---

### 9 — Rewire `DatabaseSeeder`

**File:** `api/database/seeders/DatabaseSeeder.php`

- **Keep unchanged:** everything from `:29` (`$password`) through `:229` (`Customer::factory()->count(40)->create();`).
- **Delete `:231–334`** — the four hand-written tickets, the three factory batches, the SLA backdate/stamp loop, the two `seedThread()` calls, and the CSAT block. **Keep the `$this->call(KnowledgeBaseSeeder::class)` line at `:314`**, moving it above the new call.
- **Delete the private `seedThread()` method at `:348–377`** entirely.
- **Insert** after the KnowledgeBase call:

```php
// Story 21 (WIS-25) — 64 realistic tickets with coherent threads, a
// six-week timeline and SLA state recomputed from the real created date.
// See TicketScenarioSeeder's docblock for what is deliberately seeded.
$this->call(TicketScenarioSeeder::class);
```

- **Keep** the `last_contact_at` reconciliation loop at `:336–345` — it is still correct and now reconciles against real thread timestamps. Move it **after** the `TicketScenarioSeeder` call so it sees the new messages.
- **Remove the now-unused imports** from `:5–20`: `Channel`, `Priority`, `TicketStatus`, `CsatSurvey`, `SlaClock`. **Keep** `Customer`, `Ticket`, `TicketMessage` (the reconciliation loop uses all three), `Branch`, `Department`, `SlaRule`, `User`, `CustomerTier`, `UserRole`, `Hash`, `Seeder`. Run `vendor/bin/pint` afterwards and let it settle the import order.

---

### 10 — De-lorem `TicketFactory`

**File:** `api/database/factories/TicketFactory.php`

Only two lines change (Decision 2). Add two class constants and use them:

```php
/** Realistic subjects for FACTORY tickets (tests). The seeder does not use this factory. */
private const SUBJECTS = [
    'Login fails after the latest update',
    'Invoice does not match the agreed plan',
    'Attachment upload times out',
    'Request to add a new team member',
    'Notification emails are delayed',
    'Export finishes but the file is empty',
    'Chat widget does not load on mobile',
    'Question about the renewal date',
    'Duplicate ticket created by the email connector',
    'Report totals differ from the dashboard',
    'Two-factor prompt appears on every sign-in',
    'Request to change the billing contact',
];

private const OPENINGS = [
    'This started this morning and is affecting the whole team. Can you take a look?',
    'We noticed the problem yesterday. It is not urgent but we would like it resolved this week.',
    'Following up on the previous conversation — the issue is still happening.',
    'Could you confirm whether this is expected behaviour or something on our side?',
];
```

```php
'subject'     => fake()->randomElement(self::SUBJECTS),
'description' => fake()->randomElement(self::OPENINGS),
```

Everything else in `definition()` (`:27–32`) and both state methods (`:36–48`) are **unchanged**. This keeps all 48 test files that use the factory green while removing the last lorem source from generated data.

---

### 11 — README note

**File:** `README.md`

Insert after the credentials table (which ends at `:117`) and before the SLA-engine paragraph (`:119`):

```markdown
**What the seed contains.** 64 tickets, not filler: 40 authored support scenarios (subjects and
opening messages written in both English and Arabic) spread over the last six weeks, each with a
thread whose shape follows its status — an Open ticket's last message is from the customer, a
Pending ticket's is the agent asking for something, and every Resolved or Closed ticket carries
the agent's resolution message. SLA targets are recomputed from each ticket's real creation date,
so the queue opens on three breached and three at-risk tickets rather than sixty identical ones.
CSAT surveys attach only to tickets that were genuinely resolved. Two Open tickets are seeded with
no messages on purpose — that is the empty state, not an accident.
```

Also update the test-count line at `README.md:135` (`# 500 tests, 2,345 assertions`) to whatever `vendor/bin/pest` actually prints after Task 12 lands. **Do not guess the number** — run the suite and copy it.

---

## Edge Cases & Failure Modes

- **Re-running `php artisan db:seed` without `migrate:fresh`.** `DatabaseSeeder` uses `User::create` / `Customer::create` / `Branch::create` (not `updateOrCreate`) above line 229, so a second run already fails on the unique email index. `TicketScenarioSeeder` inherits that: it is a **fresh-install seeder**. State this in its docblock; the supported command is `php artisan migrate:fresh --seed`.
- **Empty customer pool.** `TicketScenarioSeeder` runs after `DatabaseSeeder` has created 50 customers, but a partial run could leave it empty. Guard with the early `return` in Task 4 step 3 and a `$this->command?->warn(...)` — never a `firstOrFail()` exception mid-seed.
- **A running ticket's last message landing in the future.** The 42-day spread is applied to finished tickets only, but a `turns: 5` Open ticket at 2 hours old with 95-minute gaps would exceed `now()`. Task 5's "compress gaps proportionally" rule is the fix, and it must be implemented, not assumed. Assert it: `TicketMessage::where('created_at','>',now())->count() === 0`.
- **`created_at` not being fillable on `Ticket`.** It is not in `$fillable` (`api/app/Models/Ticket.php:21–29`). Backdating **must** go through `forceFill([...])->save()`, exactly as the current seeder does at `DatabaseSeeder.php:287`. A plain `Ticket::create(['created_at' => …])` silently keeps `now()`.
- **`SlaClock::applyTo()` called before the backdate.** The single most likely implementation bug: `applyTo()` reads `$ticket->created_at` (`api/app/Services/SlaClock.php:70`). Called in the wrong order it stamps every target off `now()` and **every** SLA verdict in Task 3's table is wrong. Step (f) comes after step (c); the assertion in Test 4 catches a regression.
- **`markFirstResponse` being called for an unassigned ticket.** `SlaClock::markFirstResponse` is first-caller-wins (`:126–131`). Unassigned rows A-01…A-08 have **no agent message**, so it must not be called; a null `first_response_at` on those rows is the correct state and Test 6 asserts it.
- **`TicketResolutionObserver` firing on a save.** It guards on `wasChanged('status')` (`api/app/Observers/TicketResolutionObserver.php:25`). The backdate `save()` in step (c) changes only timestamps, so it stays inert. **If the executor ever transitions a seeded ticket instead of creating it in its final state**, a survey with `resolved_by = null` appears and Test 5 fails. Decision 3 is the guard.
- **Pending tickets showing `at_risk`.** They cannot: `riskFor()` freezes a paused clock at `sla_paused_at` (`:147–150`), and `sla_paused_at` is set to the last agent message, hours after creation but inside the target for every Block B row. Verify by eye in the queue; the frozen countdown is intended.
- **Duplicate `(ticket_id, resolution_cycle)` on CSAT.** `csat_surveys` has a unique index on the pair. Every seeded survey uses `resolution_cycle => 1` on a distinct ticket, so no collision — but if a schedule row is duplicated in the CSAT list, the seed dies with a 23505. Take the CSAT list from **distinct** ticket ids.
- **Arabic strings and the `subject` `LIKE` filter.** `Ticket::scopeFilter` searches `subject LIKE %v%` (`api/app/Models/Ticket.php:120`). PostgreSQL is case-sensitive for `LIKE`; Arabic has no case, so Arabic subject search works. **English subject search remains case-sensitive** — that is pre-existing behaviour this story neither fixes nor worsens. Do not "fix" it here.
- **Line-length and encoding.** The three data files are UTF-8 without BOM. `vendor/bin/pint` must pass on all of them; run it before committing.
- **`docs/screenshots/` goes stale.** Every screenshot in the README shows the old seeded subjects. Out of scope (intake), but flag it in the PR description so the owner can decide.

---

## Test Plan

All new. **No existing test is modified** (Decision 9), subject to the executor re-running the two greps in Task 9's step 0.

**Create file:** `api/tests/Feature/Seeding/SeededDataRealismTest.php`

Use `RefreshDatabase` and run the real seeder once per test class via `$this->seed(\Database\Seeders\DatabaseSeeder::class)` in a `beforeEach`/`setUp`. **This is the first test in the repo that runs the seeder** — it is slow (≈2–4 s); keep it to one file. Follow the Pest style used across `api/tests/Feature/` (e.g. `api/tests/Feature/CustomerCrudTest.php`).

1. **`it seeds exactly 64 tickets with the designed status mix`** — `Ticket::count() === 64`; `Ticket::where('status', …)->count()` equals 20/12/14/18 for open/pending/resolved/closed.
2. **`it seeds no lorem-ipsum subject or body`** — for the classic Faker Latin stems (`ipsum`, `dolor`, `voluptas`, `quia`, `accusantium`, `laudantium`, `eveniet`, `inventore`, `sunt`, `nemo`), assert `Ticket::where('subject','like',"%$stem%")->count() === 0` **and** `TicketMessage::where('body','like',"%$stem%")->count() === 0`. Discharges Done Criterion 1.
3. **`it gives every closed ticket a resolving agent message and every open ticket a customer last message`** — for each `Closed`/`Resolved` ticket, assert at least one `author_type = agent` message exists **and** `resolved_at` is not null; for each `Open` ticket **with messages**, assert the highest-`id` message has `author_type = customer`; for each `Pending` ticket, assert the highest-`id` message has `author_type = agent`. Exclude the two zero-message Open rows explicitly and assert there are **exactly two** of them. Discharges Done Criterion 2.
4. **`it recomputes SLA targets from the real created date`** — for a sample ticket of each priority, assert `resolution_due_at->diffInMinutes(created_at)` equals the rule's `resolution_minutes` (240/480/1440/7200) plus `sla_paused_minutes`. Then assert the designed verdict counts through `SlaClock::riskFor`: **3** `breached` and **3** `at_risk` among `Open` tickets, and **2** `breached` among `Resolved`+`Closed`. This is the regression guard for the applyTo-ordering bug.
5. **`it seeds CSAT only on resolved or closed tickets`** — `CsatSurvey::count() === 12`; every survey's ticket has status ∈ {resolved, closed} and a non-null `resolved_at`; every `resolved_by` is non-null; exactly one survey has a null `rating` and its `state` is `CsatSurveyState::Outstanding`.
6. **`it spreads ticket and message timestamps across six weeks`** — `Ticket::min('created_at')` is at least 40 days before `now()`; `Ticket::max('created_at')` is within 2 hours of `now()`; `Ticket::selectRaw('count(distinct date(created_at))')` (valid on both engines) returns **≥ 25** distinct days; `TicketMessage::where('created_at','>',now())->count() === 0`; `TicketMessage::min('created_at')` is at least 40 days back. Discharges Done Criterion 3.
7. **`it matches the channels overview counts`** — authenticate as `admin@wisal.test` (whose `visibleTo` scope is the whole table), `getJson('/api/channels/overview?period=90d')`, and assert each card's `ticket_count` equals `Ticket::where('channel', $c)->count()` and that `total_tickets === 64`. Assert the literal tally too: email 30, chat 14, web_form 9, whatsapp 8, sms 3. Discharges Done Criterion 4.
8. **`it keeps one thread longer than the message page size`** — assert at least one ticket has `messages()->count() > 30`, so `TicketMessageController::index`'s `cursorPaginate(30)` returns a next-page cursor. Then `getJson("/api/tickets/{$id}/messages")` as `admin@wisal.test` and assert `meta.next_cursor` (or the equivalent key the resource returns) is not null.
9. **`it dates the created history event to the ticket's creation`** — for the oldest ticket (D-08), assert its `ticket_events` row with `event = 'created'` has `created_at` equal to the ticket's `created_at`, not to `now()`.
10. **`it seeds internal notes and multi-channel threads`** — `TicketMessage::where('visibility','internal')->count() === 4`; at least two tickets have a message whose `channel` differs from `tickets.channel`.

**Modify:** nothing. **Delete:** nothing.

---

## Migration / Rollback

**No migration.** No schema object is created, altered or dropped.

Rollback is `git revert` of the commit plus `php artisan migrate:fresh --seed`. There is no half-applied state to reason about: `TicketScenarioSeeder` is only ever run against a fresh database (Edge Cases, item 1), and a failure mid-seed leaves a partially populated development database that the same command re-creates from scratch.

The one non-obvious risk: **a live demo database is not re-seeded by this change.** If the deployed Supabase instance holds the old filler tickets, they stay until someone re-runs the seeder there. Note it in the PR description; do not add a data migration.

---

## Verification Steps

1. **Backend builds:** in `api/` — `vendor/bin/pint --test` then `vendor/bin/pint` if it fails.
2. **Seed runs clean:** in `api/` — `php artisan migrate:fresh --seed`. Must finish with no exception and no warning. **The execute agent runs this once locally to verify; it is not run against any deployed database.**
3. **Spot-check the data:** in `api/` —
   ```bash
   php artisan tinker --execute="
     use App\Models\Ticket; use App\Models\TicketMessage; use App\Services\SlaClock;
     \$c = app(SlaClock::class);
     echo 'tickets: '.Ticket::count().PHP_EOL;
     echo 'by status: '.Ticket::selectRaw('status, count(*) n')->groupBy('status')->pluck('n','status')->toJson().PHP_EOL;
     echo 'by channel: '.Ticket::selectRaw('channel, count(*) n')->groupBy('channel')->pluck('n','channel')->toJson().PHP_EOL;
     echo 'oldest: '.Ticket::min('created_at').' newest: '.Ticket::max('created_at').PHP_EOL;
     echo 'no-message tickets: '.Ticket::doesntHave('messages')->count().PHP_EOL;
     echo 'risk: '.Ticket::all()->groupBy(fn(\$t)=>\$c->riskFor(\$t) ?? 'null')->map->count()->toJson().PHP_EOL;
     echo 'future messages: '.TicketMessage::where('created_at','>',now())->count().PHP_EOL;
   "
   ```
   Expected: 64; `{"open":20,"pending":12,"resolved":14,"closed":18}`; `{"email":30,"chat":14,"web_form":9,"whatsapp":8,"sms":3}`; oldest ≈ 42 days back; no-message = 2; future messages = 0.
4. **Channels reconcile:** log in as `admin@wisal.test` and open `/channels`, choose the **90d** period. Every card's count must match step 3's channel tally, and the total must read 64. The **30d** default legitimately shows fewer (Decision 8).
5. **Backend tests:** in `api/` — `vendor/bin/pest`. All green, including the new `SeededDataRealismTest`. Record the new test/assertion counts for README `:135`.
6. **Frontend tests:** in `web/` — `npm run test`. All green, unchanged. Then `npm run lint && npm run build`.
7. **Regression — look at it:** run `php artisan serve` + `npm run dev`, sign in as `agent@wisal.test`, and confirm by eye: the queue's SUBJECT column reads as support work in both scripts, TIME LEFT shows a mix of red/amber/grey rather than one value, opening a Closed ticket shows a conversation ending in a resolution, and the two empty-state tickets show the thread Empty state. Switch to Arabic and confirm the Arabic subjects render RTL in the queue.

---

## Done Criteria

- [x] No lorem-ipsum subject or body anywhere in seeded data — `SeededDataRealismTest` test 2 passes, and `grep -rn "fake()->paragraph\|fake()->sentence\|fake()->text\|realText" api/database/seeders/` returns nothing.
- [x] Every Closed ticket has a resolving agent message and a non-null `resolved_at`; every Open ticket with messages ends on a customer message; every Pending ticket ends on an agent message — test 3.
- [x] Ticket and message timestamps span at least 40 days across at least 25 distinct days, and no message is dated in the future — test 6.
- [x] `GET /api/channels/overview?period=90d` as an Administrator returns per-channel counts equal to the actual per-channel ticket counts, totalling 64 — test 7.
- [x] CSAT surveys exist only on Resolved/Closed tickets, 12 of them, one deliberately outstanding — test 5.
- [x] Exactly two seeded tickets have no messages, and both are Open — test 3.
- [x] SLA targets are anchored on each ticket's real `created_at`, producing 3 breached and 3 at-risk running tickets and 2 missed-on-close tickets — test 4.
- [x] `cd api && vendor/bin/pest` is green; `cd web && npm run test` is green and unmodified.
- [x] `README.md` section 1 carries the "What the seed contains" paragraph, and the test-count line at `:135` matches the real output.
- [x] `api/database/seeders/DatabaseSeeder.php` no longer calls `Ticket::factory()`, and its private `seedThread()` helper is gone.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 22.**
