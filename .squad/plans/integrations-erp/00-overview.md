# integrations-erp — plan overview

Entry point for the **integrations-erp** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 18 | [18-story-integrations-erp-admin.md](18-story-integrations-erp-admin.md) | Integrations & ERP — Admin Connection Management (Category 11) | WIS-19 | 01 authentication · 02 app-shell · 06 sla-rules (screen pattern) · 08 users-roles (admin group, `AuditTrail`) · 14 channels-overview (honesty framing) · 15 i18n · **coordinate with** 16 i18n-retrofit (WIS-17) |

## Dependency notes

This is the **configuration counterpart to Story 14**. `/channels` reports where tickets came from;
`/integrations` is where an Administrator configures the outside systems. Neither reads the other's
data, and Story 14's screen is not modified.

**It executes late by choice, not by blocker.** Nothing in Stories 03–14 depends on it, and it depends
on no product data — only on Story 08's admin route group and `AuditTrail`, and Story 06's card-grid
screen pattern. It could be pulled forward as soon as those two are on disk.

**Coordinate with WIS-17** ([`../i18n-retrofit/16-story-i18n-retrofit.md`](../i18n-retrofit/16-story-i18n-retrofit.md)):
that story is widening `web/scripts/i18n-allowlist.json`'s `roots` one feature at a time. Story 18
ships `src/features/integrations` already compliant and **adds that root itself**, so WIS-17 never has
to retrofit it. Whichever lands second rebases the `roots` array; the PR must say which order happened.

## Planning decisions recorded in the story

Four judgement calls the intake left open are settled in the story file. Two of them other work will
cite:

- **Decision 1 — a new `IntegrationType` enum, not a reuse of `Channel`.** `Channel` is
  `email, whatsapp, chat, sms, web_form`; the integration list is `erp, email, sms, whatsapp,
  api_webhook`. Two overlapping sets, not one set seen twice. **`Channel` is never edited by this
  feature**, and `tickets.channel` never gains an `erp` value.
- **Decision 3 — "Last checked", not "Last synced".** The design export says *"Last synced 3 hours
  ago"*. Nothing in this release syncs, so shipping that copy would fabricate a capability — the exact
  thing Story 14's honest not-connected framing exists to prevent, and the intake names keeping the two
  screens consistent as a dependency. **This is a deliberate deviation from the design export** and the
  only one; record it in the PR.

**⚠️ Decision 2 is the one to confirm before implementing.** "Test connection" performs a **real**
outbound HTTPS reachability request (5s timeout, redirects off, SSRF guard), because the design's
failure copy — *"Couldn't reach the endpoint"* — would otherwise be a lie. It verifies reachability,
never that the provider accepted the credential. If the reviewer wants zero outbound traffic from the
API instead, the button and its three modal artboards need different copy.

## Cross-cutting rules this feature adds

- **`APP_KEY` becomes load-bearing for stored data.** `integrations.secret` is the codebase's first
  `encrypted` cast. Rotating `APP_KEY` silently invalidates every stored secret; the story handles the
  resulting `DecryptException` as an ordinary connection error rather than a 500.
- **Route parameters under `/api/admin/*` stay unconstrained.** `AdminAuthorizationTest` sweeps the
  live route list and substitutes placeholders by name; a `->whereIn(...)` constraint turns its 403
  assertion into a 404 and the failure reads like an authorization bug. Story 18 extends that
  substitution for `{type}` and leaves the route open, with the reason in a comment in `routes/api.php`.
