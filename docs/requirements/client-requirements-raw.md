# Client Requirements — Raw Capture

**Status: unreconciled.** This is a verbatim capture of the client's stated
requirements, exactly as given, with no filtering, no prioritization, and no
attempt yet to fit it to an MVP. It exists so nothing the client asked for is
ever lost or forgotten — reconciliation with actual build scope is a separate,
later decision, recorded in `scope.md` and a dedicated ADR once made.

**Critical flag.** This describes a **Customer Support / Helpdesk CRM**
(comparable to Zendesk, Freshdesk, Intercom) — ticket-centric, built around
agents resolving customer issues against SLAs. This is a different product
shape from the **Sales CRM** (comparable to Pipedrive, HubSpot) assumed in
`brief.md` and already reflected in the built App Shell navigation
(Companies/Contacts/Leads/Opportunities). The two are not compatible without
a real reconciliation decision — see "Conflict with prior work" below.

Source: provided by the project owner, 2026-08-22, described as "بعض
الريكويرد الأساسية التي يطلبها العميل" (some of the core requirements the
client is asking for).

---

## Customer Support CRM — Core Features

### 1. Customer Management
- Customer profiles
- Contact details
- Interaction history
- Notes and attachments

### 2. Ticket Management
- Create and track tickets
- Categories and priorities
- Assign tickets to agents
- Status and escalation
- Ticket history

### 3. Communication Channels
- Email
- WhatsApp
- Live chat
- SMS
- Web forms

### 4. Agent Dashboard
- Assigned tickets
- Customer information
- Tasks and reminders
- Quick replies
- Team collaboration

### 5. SLA & Automation
- Response and resolution targets
- Automatic assignment
- Escalation rules
- Alerts and notifications

### 6. Knowledge Base
- FAQs
- Help articles
- Solutions and guides
- Search

### 7. AI Features
- Ticket summaries
- Suggested replies
- Automatic categorization
- Suggested solutions
- AI chatbot

### 8. Customer Portal
- Submit tickets
- Track requests
- View history
- Access FAQs
- Submit feedback

### 9. Reports & Management
- Ticket reports
- SLA performance
- Agent performance
- Customer satisfaction
- Management dashboards

### 10. Security & Administration
- Users and roles
- Permissions
- Audit logs
- System configuration

### 11. Integrations
- APIs
- ERP
- Email, SMS & WhatsApp
- External systems

### 12. Platform
- Arabic & English
- Web and mobile friendly
- Multi-department
- Multi-branch
- Custom branding

---

## Conflict with prior work

| Already built, assuming Sales CRM | This requirement implies |
|---|---|
| App Shell nav: Companies, Contacts, Leads, Opportunities, Activities, Audit Log, Users | Nav should center on: Tickets, Customers, Knowledge Base, Channels/Inbox, SLA Rules, Reports, Agents, Customer Portal |
| Core entity: **Opportunity** with a sales-stage pipeline | Core entity: **Ticket** with a status/escalation lifecycle — a different state machine entirely |
| `brief.md` competitive analysis: Pipedrive, Attio, HubSpot, Salesforce | Should instead have analyzed: Zendesk, Freshdesk, Intercom, Zoho Desk |
| `docs/decisions/ADR-004-authentication.md`: two user roles internal to the sales org | This requirement adds a **public-facing Customer Portal** — a third audience (unauthenticated or lightly-authenticated end customers), a materially different security surface (P1/P5 in the constitution) |

None of the prior work is wasted at the *infrastructure* level — PostgreSQL
choice (ADR-003), the Laravel/React stack (ADR-001), the layered architecture
(ADR-002), i18n/RTL approach, and the design tokens in `brief.md` all still
apply regardless of which product this becomes. What breaks is the **domain
model and navigation** — those were designed around the wrong entity.

## Scale reality check

This list spans 12 feature areas including five communication channels, five
AI capabilities, ERP integration, and multi-branch/multi-department support.
Taken as a literal, complete build target, this is the scope of a funded
product team working for months, not a single-developer assessment project.
Treating every line here as an MVP requirement would repeat the exact mistake
already flagged once in this project: chasing breadth over the demonstrable
depth the assessment actually rewards (`rubric-traceability.md` — Planning
weighted at 20, double any single engineering criterion; the Quality gate
requires depth, not coverage).

This is not a reason to discard any of it — it is why this capture exists
unfiltered. The prioritization decision (what is MVP, what is
phase 2, what is explicitly out of scope) is made deliberately next, with the
project owner, not inferred here.
