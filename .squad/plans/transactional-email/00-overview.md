# transactional-email — plan overview

Entry point for the **transactional-email** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 23 | [23-story-transactional-email.md](23-story-transactional-email.md) | Real Transactional Email — Brevo SMTP for Portal Codes and CSAT | WIS-27 | Stories 17, 13, 20, 15 |

## Dependency notes

**This is an infrastructure story with one new user-visible feature inside it.** It adds no
migration, no endpoint and no frontend module. It gives the application a real mail transport, one
shared branded layout, and — the part the tracker text understates — **the CSAT invitation email,
which has never existed**. Planned at **full** depth: every path, line range and signature was
verified against real code at plan time.

- **Depends on** [`../customer-portal/17-story-customer-portal.md`](../customer-portal/17-story-customer-portal.md).
  Story 17 built `PortalCodeNotifier`, `MailPortalCodeNotifier`, `PortalAccess`,
  `PortalAccessCodeMail` and the one existing Blade template. **Its Decision 4 (mail is the only OTP
  channel) and ADR-005 (a phone-only customer receives nothing, recorded rather than faked) both
  still hold.** This story changes the transport and the chrome, never the seam.
- **Depends on** [`../csat-collection/00-overview.md`](../csat-collection/00-overview.md).
  Story 13 built `CsatSurvey`, `TicketResolutionObserver`, `CsatShareLink` and the signed
  `csat.show` / `csat.store` routes. **Its rollback invariant is this story's hardest constraint:**
  the observer runs *inside* the resolving transaction, so the invitation must be deferred with
  `DB::afterCommit` or a rolled-back resolve would email the customer anyway.
- **Depends on** Story 20 (organization-settings, WIS-20) for `App\Services\OrganizationBranding` —
  the only "brand" this repo has, and therefore what "branded template (logo)" resolves to. Both of
  its values are nullable and both are null on the Vercel deployment.
- **Depends on** Story 15 (internationalization, WIS-11) for `SetLocale` and the `lang/{en,ar}`
  catalogues.
- **Follows the shape of** [`../ai-provider-seam/22-story-ai-provider-seam.md`](../ai-provider-seam/22-story-ai-provider-seam.md)
  — not its code. Committed default that needs no account, empty keys in `.env.example`, one artisan
  command as the owner's discharge path for the criteria that need a live credential, README anchors
  named rather than a new section invented.
- **Blocks nothing.** WIS-27 is the small independent story between WIS-26 and WIS-23 in
  `.squad/pipeline.md`.

**Contracts this story establishes**, which a later story consumes rather than redefines:

- **The transport is `smtp`, and Brevo is env only.** `config/mail.php`'s stock `smtp` mailer plus
  five `.env` lines. **No `brevo` entry in the `mailers` array**, no provider SDK, no new composer
  dependency. A second provider is a different `MAIL_HOST`, not new code.
- **`MAIL_MAILER=log` is the committed default, forever.** Local development must never require an
  account, and `MAIL_MAILER=log` is also the one-line kill switch for a misbehaving relay.
- **`resources/views/mail/layout.blade.php` is the one mail layout.** Hand-written, inline styles,
  `dir`/`lang` from view data, branding degrading to a text wordmark. A third email extends it; it
  does not bring its own chrome, and Laravel's markdown mail components stay unpublished.
- **Mail is synchronous.** No `ShouldQueue`, no `Mail::queue()`. Nothing drains the `jobs` table in
  this repository, so a queued mail is a mail that is never sent. This constraint is the reason the
  CSAT invitation needs a per-request cap.
- **`config('mail.csat.max_per_request')` bounds the fan-out of a bulk resolve.** Surveys are never
  skipped; only emails past the cap are, and each skip is logged.
- **`config('mail.customer_locale')` is the locale for any mail sent outside a customer's own
  request.** A recorded compromise, not a solution — see the deferral below.
- **A transport failure is always caught and logged, never propagated.** On the portal path letting
  it escape would 500 only for identifiers that matched a real customer, i.e. an enumeration oracle.
- **`php artisan mail:test <recipient> [--kind=portal|csat|plain] [--locale=]` is the one-command
  delivery check.** It prints the mailer, the resolved from-address and the locale *before* sending,
  because an unverified `MAIL_FROM_ADDRESS` is the failure this project will hit first.

## Deliberate deferrals

Recorded here so a later story picks them up instead of this one growing:

- **`customers.locale`.** The honest fix for Decision 6. Until it exists, the CSAT invitation renders
  in one configured locale for every customer, and the portal code email rides on the customer's own
  request locale. A column, a customer-form field and a portal preference are a small story of their
  own.
- **A queue worker.** Would remove the per-request cap, the synchronous SMTP round-trip inside a
  request, and the `timeout => null` exposure in one move. It is an infrastructure decision the
  owner has not made, and `README.md:194` currently states the opposite as a design fact.
- **Delivery tracking.** Brevo webhooks, bounces, complaints, a suppression list, a send log table,
  an admin screen. None of it exists and none of it is faked.
- **Inbound email.** Mailbox polling, reply-to-ticket parsing. WIS-22 owns live channel ingestion;
  after this story the README's "no real Email send-and-receive" caveat is only half retired.
- **More recipients.** No agent notification, no password-reset mail (the `passwords` catalogue
  exists but no flow emails today), no SLA-breach mail, no digest. Two emails, deliberately.
- **`config/mail.php`'s `smtp.timeout => null`.** A hung relay can stall a request. Left stock here;
  worth an explicit value the day a real relay misbehaves.
