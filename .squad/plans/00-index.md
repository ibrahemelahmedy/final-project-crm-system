# Plans index

One row per feature folder under `.squad/plans/`. `NN` continues as a global execution sequence across all features when `naming.globalSequence` is `true` in `config.yaml`.

Rows are listed in **execution order**, not alphabetically — read this table top to bottom to know what to build next.

**Depth vs status.** This column carries two different things: the plan's authored depth
(`full` / `contract`) until the story ships, then `implemented`. The `index-sync` Stop hook
rewrites it once every Done-Criteria box in the story file is ticked, so a row still reading
`full` means the boxes are unticked — not necessarily that no code exists. Check the story
file, not this column, when the two disagree.

| NN | Feature | Overview | Story | Tracker | Depth |
|----|---------|----------|-------|---------|-------|
| 01 | authentication | [authentication/00-overview.md](authentication/00-overview.md) | Authentication & Access Control | WIS-1 | **implemented** |
| 02 | app-shell | [app-shell/00-overview.md](app-shell/00-overview.md) | Application Shell & Navigation | WIS-10 | **implemented** |
| 03 | customer-management | [customer-management/00-overview.md](customer-management/00-overview.md) | Customer Management | WIS-4 | full |
| 04 | ticket-management | [ticket-management/00-overview.md](ticket-management/00-overview.md) | Ticket Management (Queue) | WIS-2 | full |
| 05 | conversation-thread | [conversation-thread/00-overview.md](conversation-thread/00-overview.md) | Conversation Thread (Ticket Detail) | WIS-3 | full |
| 06 | sla-rules-automation | [sla-rules-automation/00-overview.md](sla-rules-automation/00-overview.md) | SLA Rules & Automation | WIS-6 | full |
| 07 | agent-dashboard | [agent-dashboard/00-overview.md](agent-dashboard/00-overview.md) | Agent Dashboard (Role-Based Home) | WIS-9 | contract |
| 08 | users-roles-admin | [users-roles-admin/00-overview.md](users-roles-admin/00-overview.md) | Users & Roles Administration | WIS-8 | **implemented** |
| 09 | knowledge-base | [knowledge-base/00-overview.md](knowledge-base/00-overview.md) | Knowledge Base | WIS-5 | **implemented** |
| 10 | agent-productivity | [agent-productivity/00-overview.md](agent-productivity/00-overview.md) | Agent Productivity — Quick Replies, Tasks & Collaboration | WIS-12 | **implemented** |
| 11 | notifications | [notifications/00-overview.md](notifications/00-overview.md) | Notifications Centre (in-app) | WIS-13 | **implemented** |
| 12 | reports-dashboards | [reports-dashboards/00-overview.md](reports-dashboards/00-overview.md) | Reports & Management Dashboards | WIS-7 | contract |
| 13 | csat-collection | [csat-collection/00-overview.md](csat-collection/00-overview.md) | CSAT Collection (post-resolution survey) | WIS-14 | contract |
| 14 | channels-overview | [channels-overview/00-overview.md](channels-overview/00-overview.md) | Channels Overview (read-only) | WIS-15 | contract |
| 15 | internationalization | [internationalization/00-overview.md](internationalization/00-overview.md) | Internationalization (Arabic & English) | WIS-11 | contract |
| 16 | i18n-retrofit | [i18n-retrofit/00-overview.md](i18n-retrofit/00-overview.md) | i18n String Extraction Retrofit — Complete WIS-11 Coverage | WIS-17 | full |
| 17 | customer-portal | [customer-portal/00-overview.md](customer-portal/00-overview.md) | Customer Portal — Self-Service (Category 8) | WIS-16 | full |
| 19 | ai-assist-panel | [ai-assist-panel/00-overview.md](ai-assist-panel/00-overview.md) | AI Assist — Ticket Summary & Suggested Reply (Category 7, partial) | WIS-18 | **implemented** |
| 18 | integrations-erp | [integrations-erp/00-overview.md](integrations-erp/00-overview.md) | Integrations & ERP — Admin Connection Management (Category 11) | WIS-19 | **implemented** |
| 20 | organization-settings | [organization-settings/00-overview.md](organization-settings/00-overview.md) | Organization Settings — Branches, Departments & Branding (Category 12, remainder) | WIS-20 | **implemented** |
| 21 | seed-data-realism | [seed-data-realism/00-overview.md](seed-data-realism/00-overview.md) | Realistic Seed Data — Genuine Tickets, Threads & Timelines | WIS-25 | **implemented** |
| 22 | ai-provider-seam | [ai-provider-seam/00-overview.md](ai-provider-seam/00-overview.md) | Free AI Provider Behind the AssistGenerator Seam (Gemini / Groq) | WIS-26 | **implemented** |
| 23 | transactional-email | [transactional-email/00-overview.md](transactional-email/00-overview.md) | Real Transactional Email — Brevo SMTP for Portal Codes and CSAT | WIS-27 | full |
| 24 | ai-customer-intelligence | [ai-customer-intelligence/00-overview.md](ai-customer-intelligence/00-overview.md) | AI Auto-Classification & Customer Chatbot (Category 7 completion) | WIS-23 | **implemented** |
| 25 | integration-data-sync | [integration-data-sync/00-overview.md](integration-data-sync/00-overview.md) | Integration Data Sync — Inbound Customer Pull & Outbound Event Push (Category 11 completion) | WIS-24 | full |
| 26 | live-channel-ingestion | [live-channel-ingestion/00-overview.md](live-channel-ingestion/00-overview.md) | Live Channel Ingestion — Inbound Webhooks, Thread Matching & Outbound Channel Replies (Category 3 completion) | WIS-22 | full |

## Two plan depths — read this before implementing

**`full`** — task-level detail verified against real code at plan time: exact file paths, line
ranges, signatures, and runnable commands. Implement straight from the file.

**`contract`** — scope, owned tables/enums/endpoints, cross-story contracts, edge cases, test plan
and done criteria are **final**; task-level file paths and line ranges are deliberately absent,
because the code these stories build on does not exist yet and any line number written today would
be invented. **Before implementing a `contract` story, regenerate it at full depth** by re-running
the plan flow on the same intake:

```
/squad-plan .squad/stories/<feature>/<WIS-id>/intake.md
```

The regenerated plan must keep the story's **Shared contracts** section intact — later stories
already cite it.

## Dependency spine

```
01 authentication ──┬── 02 app-shell ── (every UI story)
                    │
                    └── 03 customers ── 04 tickets ──┬── 05 thread ──┬── 10 productivity
                                                     │               └── 13 CSAT
                                                     ├── 06 SLA ──┬── 07 dashboard
                                                     │            ├── 11 notifications
                                                     │            └── 12 reports
                                                     └── 14 channels
        08 users-roles ── (depends on 01 only; also resolves the `teams` debt)
        09 knowledge-base ── (depends on 02; feeds 05's article picker)
        15 i18n ── 16 i18n-retrofit ── (15 builds the machine; 16 extracts every screen's strings)

        17 customer-portal ── depends on 03·04·05·09·13·15, coordinates with 16
                              (a THIRD audience outside auth:sanctum — after everything)

        18 integrations-erp ── depends on 01·02·06·08·14·15 only (no product data)
                              — the ADMIN CONFIG counterpart to 14 channels; pullable earlier

        19 ai-assist-panel ── depends on 04·05·10·15, coordinates with 16
                              (fills the slot 05 reserved and left empty; a leaf — nothing
                               depends on it, and it is the first PAID outbound call)

        21 seed-data-realism ── depends on 04·05·06·09·13·14 (data only; no schema, no endpoint,
                              no frontend). Rewrites what `migrate:fresh --seed` produces and
                              nothing else.

        22 ai-provider-seam ── depends on 19 (the seam) and 18 (the outbound-HTTP pattern).
                              Adds a second AssistGenerator implementation and a provider registry
                              in config/ai.php; no schema, no endpoint, no frontend. Blocks WIS-23.

        23 transactional-email ── depends on 17 (the portal OTP mailer + the only Blade template),
                              13 (CsatSurvey, the resolution observer, the signed share link),
                              20 (OrganizationBranding = the only "brand" there is) and 15 (locales).
                              No schema, no endpoint, no frontend. Gives the app a real SMTP
                              transport, one shared branded mail layout, and the CSAT invitation
                              email that never existed. Blocks nothing.

        24 ai-customer-intelligence ── depends on 19 (the seam), 22 (a free provider), 04 (ticket
                              creation + ticket_events), 09 (KB search), 17 (the portal identity)
                              and 23 (the DB::afterCommit observer pattern). Finishes Category 7:
                              auto-classification on create and the portal chatbot. Three
                              migrations, four new endpoints, one new portal screen. A leaf —
                              nothing depends on it.

        25 integration-data-sync ── depends on 18 (the integrations table and the ONE SSRF-guarded
                              outbound HTTP path, which it extracts rather than copies), 03
                              (customers = the inbound write target, through the model so the
                              email/phone mutators still hold), 04 and 13 (the three outbound event
                              sources — note CsatSurveyController fires no model event), 06
                              (routes/console.php, the only scheduled-command precedent and the
                              file that states the no-queue-worker constraint) and 23·24 (the two
                              DB::afterCommit deferral patterns). Finishes Category 11: a scheduled
                              customer pull with a field map and per-field conflict rules, plus a
                              persistent outbox with backoff and dead-letter. Four migrations, five
                              new admin endpoints (all with `{type}` as their only parameter), four
                              new frontend panels. A leaf — nothing depends on it.

        26 live-channel-ingestion ── depends on 14 (the read-only Channels screen it completes, and
                              whose "not connected" claim it must rewrite in TWO existing test
                              assertions, not just in a comment), 04 and 05 (tickets, ticket_messages
                              and TicketMessageController:59 — the ONE agent-reply write site in
                              api/app), 03 (Customer::phoneMatchCandidates, how a WhatsApp/SMS sender
                              is resolved), 25 (OutboundUrlGuard — bound, never copied — plus
                              OutboundResponse and the whole outbox shape; WIS-24's overview names
                              this story as the inbound-webhook receiver it deferred), 18 (the
                              encrypted-secret posture and the error-is-an-i18n-key rule), 23 (the
                              only real mail transport, which the email reply rides — so Done
                              Criterion 1 inherits WIS-27's still-pending Brevo credentials), 24 (the
                              afterCommit + terminating + capped-counter pattern and the phpunit
                              feature-flag precedent — but NOT its portal_chat_* tables, which are a
                              different audience), 17 (PortalAuth, the template for the widget
                              session middleware) and 06 (routes/console.php and the no-queue-worker
                              constraint). Finishes Category 3: signature-verified provider webhooks,
                              three-mechanism thread matching with identity beating headers, an
                              embeddable chat widget that needs no external account and no CORS/CSP
                              relaxation, and outbound replies through a persistent outbox. Four
                              migrations, four new admin endpoints (all with `{channel}` as their
                              only parameter — the FIFTH placeholder AdminAuthorizationTest must
                              substitute), two new public route groups, one new frontend feature.
                              A leaf, and the last story in `.squad/pipeline.md`.

        20 organization-settings ── depends on 01·02·03·08·15·18, coordinates with 16
                              (closes Category 12's remaining three bullets; reuses 08's admin
                               gate and `settings` table wholesale and adds NO new authorization
                               boundary — the first story to make the app's palette data-driven)
```

**Rows 18 and 19 are listed out of numeric order above.** `ai-assist-panel` (WIS-18) holds `19` and
`integrations-erp` (WIS-19) holds `18`; the tracker ids and the sequence numbers cross over. Read
the `NN` column, not the row order.

## Cross-cutting rules every plan honours

- **`ticket_events` is the single append-only ticket-history table** (owned by Story 04). Later
  stories append new `event` values. No second history table; nothing about ticket lifecycle goes
  into Story 01's `audit_logs`.
- **`TicketResource.sla` has three frozen keys** (`due_at`, `minutes_left`, `risk`). Story 04 ships
  them `null`; Story 06 fills the values and changes no key.
- **All SQL must be valid on PostgreSQL *and* SQLite** — `api/.env` runs pgsql (Supabase),
  `api/phpunit.xml` runs SQLite `:memory:`. In practice that rules out `NULLS LAST`
  (use a `CASE` expression), `INTERVAL` / `julianday()` day arithmetic (do it in PHP and
  bind a Carbon value), and a bare `LIKE` with backslash escapes (SQLite has no default
  escape character — spell out `ESCAPE '\'`).
- **Server-derived display copy is localised server-side.** Every `*_label` field travels
  with its value on the same resource, so `Priority`/`TicketStatus`/`Channel`/`UserRole`
  labels and `SlaRule::breachActionLabel()` resolve through `__()` against `api/lang/{en,ar}`.
  `SetLocale` reads the SPA's `Accept-Language`. Do not duplicate these maps in TypeScript.
- **`ticketKeys` is the one TanStack Query keying scheme** for anything ticket-shaped; every ticket
  mutation invalidates `ticketKeys.all`.
- **Filter and pagination state lives in the URL**, never in component state.
- **Every data screen ships all four async states** — loading, error, empty, success.
- **Two identities, never mixed.** `users` + `auth:sanctum` is staff; `portal_sessions` + the
  `portal` middleware (Story 17) is external customers. A `Customer` never becomes
  `$request->user()`, and no `/api/portal/*` route carries `auth:sanctum`. Any customer-facing
  render of a ticket thread goes through `TicketMessage::publicOnly()` **in the query**.
