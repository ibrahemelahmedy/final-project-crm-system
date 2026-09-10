// The Channels overview model — Story 14 (WIS-15).
// Mirrors App\Http\Resources\ChannelOverviewResource on the API.
//
// The channel LIST always comes from the API (`data`), which iterates
// App\Enums\Channel. This file holds only the DECORATIVE per-channel copy
// (help line + icon), keyed by the API's `value`, plus a generic fallback for
// an enum value this map has not been told about. It can therefore never
// disagree with the backend about *which* channels exist — only about the
// help line for one it doesn't recognise.

export type ChannelStatus = 'not_connected' | 'connected' | 'error';

// Story 26 (WIS-22). Mirrors the nested `connection` object
// ChannelOverviewResource now returns per channel — null when the channel has
// no channel_connections row. `last_error_key` is an i18n key, resolved with
// t(), never a raw message. `connectable` says whether an Administrator may
// configure this channel at all (false for `web_form`, which is never a
// provider).
export type ChannelConnectionSummary = {
  provider: ChannelProviderValue | null;
  last_inbound_at: string | null;
  inbound_24h: number;
  last_error_key: string | null;
  connectable: boolean;
};

export type ChannelOverviewItem = {
  value: string;
  label_key: string;
  status: ChannelStatus;
  ticket_count: number;
  connection: ChannelConnectionSummary | null;
};

// Story 26 (WIS-22). Mirrors App\Enums\ChannelProvider's values. Not
// declared as a closed literal union — a value this SPA doesn't recognise
// still round-trips through ChannelConnection.provider without a type error,
// the same "the API is the source of truth for the list" posture Task 63
// applies to statuses.
export type ChannelProviderValue = string;

// Story 26 (WIS-22). One provider serves exactly one channel
// (App\Enums\ChannelProvider::channel() is a fixed match, and
// SaveChannelConnectionRequest rejects any other pairing). There is no
// endpoint that enumerates this — it never varies — so unlike the channel
// list itself this one mapping is intentionally local, the same way
// CHANNEL_PRESENTATION_KEYS below is local decorative data keyed by the
// API's own channel value. It is never used to offer a CHOICE of provider;
// only to know which single provider a not-yet-connected channel will save
// as.
export const PROVIDER_FOR_CHANNEL: Record<string, ChannelProviderValue> = {
  email: 'email_webhook',
  whatsapp: 'whatsapp_cloud',
  sms: 'twilio_sms',
  chat: 'wisal_chat',
};

// Story 26 (WIS-22). Mirrors App\Http\Resources\ChannelConnectionResource
// exactly. There is NO `secret` field, by design — the plaintext never
// leaves the server in any form but `secret_last_four` (the
// integrations/model/types.ts convention).
export type ChannelConnection = {
  channel: string;
  label_key: string;
  provider: ChannelProviderValue | null;
  status: ChannelStatus;
  secret_last_four: string | null;
  config: {
    phone_number_id?: string;
    from_number?: string;
    account_sid?: string;
    inbound_address?: string;
    allowed_origins?: string[];
    site_key?: string;
  };
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_error_key: string | null;
  last_error_at: string | null;
};

export type ChannelOverviewMeta = {
  period: string;
  from: string;
  to: string;
  total_tickets: number;
  has_tickets: boolean;
};

export type ChannelOverview = {
  data: ChannelOverviewItem[];
  meta: ChannelOverviewMeta;
};

type T = (key: string, opts?: Record<string, unknown>) => string;

// ---- Period ---------------------------------------------------------------

export const CHANNEL_PERIODS = ['7d', '30d', '90d'] as const;
export type ChannelPeriod = (typeof CHANNEL_PERIODS)[number];
export const DEFAULT_CHANNEL_PERIOD: ChannelPeriod = '30d';

const PERIOD_LABEL_KEYS: Record<ChannelPeriod, string> = {
  '7d': 'period.last7',
  '30d': 'period.last30',
  '90d': 'period.last90',
};

export function periodLabel(period: ChannelPeriod, t: T): string {
  return t(PERIOD_LABEL_KEYS[period]);
}

export function isChannelPeriod(value: string | null): value is ChannelPeriod {
  return value === '7d' || value === '30d' || value === '90d';
}

// ---- Status pill --------------------------------------------------------
//
// Story 26 (WIS-22) adds `connected` and `error`. This is now safe to render
// a real healthy state from: the value is SOURCED FROM a channel_connections
// row (App\Http\Resources\ChannelOverviewResource), and the absent row still
// yields `not_connected` from the backend itself — the honest default is
// unchanged, only the ceiling on what can be reported is raised. Nothing
// here can fabricate a `connected` status on its own.
const STATUS_LABEL_KEYS: Record<string, string> = {
  not_connected: 'status.notConnected',
  connected: 'status.connected',
  error: 'status.error',
};

export function statusLabel(status: string, t: T): string {
  return t(STATUS_LABEL_KEYS[status] ?? 'status.notConnected');
}

/** A distinct CSS class per state — colour is never the only signal
 *  (docs/design/brief.md). An unrecognised value renders as not_connected's
 *  class rather than an undefined/empty class. */
export function statusDotClass(status: string): string {
  return status === 'connected' || status === 'error' ? status : 'not_connected';
}

// ---- Error keys -----------------------------------------------------------
//
// Story 26 (WIS-22). `last_error_key` and a test's `error_key` arrive as
// FULLY-QUALIFIED dotted keys, exactly like ChannelOverviewResource's own
// `label_key` convention — most are `channels.error.*`, and four
// (`integrations.error.scheme|blocked_host|unreachable|server_error`) are
// inherited from OutboundUrlGuard / HttpIntegrationTester, because the same
// guard is bound at send time for whatsapp_cloud / twilio_sms (Decision 9).
// Every `t()` call in this feature is namespace-pinned to 'channels' (useT),
// so the leading segment must be stripped before either prefix is passed to
// t() — otherwise i18next looks for a nested "channels"/"integrations" key
// INSIDE the channels namespace, which does not exist, and silently falls
// back to a humanised key. Both prefixes collapse onto the SAME flat
// `error.*` catalogue entry — the two source vocabularies never collide.
export function unscopeErrorKey(key: string): string {
  return key.replace(/^channels\.|^integrations\./, '');
}

// ---- Per-channel presentation (decorative copy only) --------------------

export type ChannelIconName = 'email' | 'whatsapp' | 'chat' | 'sms' | 'web_form' | 'generic';

export type ChannelPresentation = {
  label: string;
  helpLine: string;
  icon: ChannelIconName;
  tint: 'indigo' | 'green' | 'violet' | 'amber' | 'emerald' | 'slate';
};

const CHANNEL_PRESENTATION_KEYS: Record<
  string,
  { labelKey: string; helpLineKey: string; icon: ChannelIconName; tint: ChannelPresentation['tint'] }
> = {
  email: { labelKey: 'presentation.email.label', helpLineKey: 'presentation.email.helpLine', icon: 'email', tint: 'indigo' },
  whatsapp: { labelKey: 'presentation.whatsapp.label', helpLineKey: 'presentation.whatsapp.helpLine', icon: 'whatsapp', tint: 'green' },
  chat: { labelKey: 'presentation.chat.label', helpLineKey: 'presentation.chat.helpLine', icon: 'chat', tint: 'violet' },
  sms: { labelKey: 'presentation.sms.label', helpLineKey: 'presentation.sms.helpLine', icon: 'sms', tint: 'amber' },
  web_form: { labelKey: 'presentation.web_form.label', helpLineKey: 'presentation.web_form.helpLine', icon: 'web_form', tint: 'emerald' },
};

/** The five channels this release ships help copy for — derived from the map,
 *  never a second hand-maintained list. Used only to render the channel list
 *  while the API request is in flight or has failed. */
export const KNOWN_CHANNEL_VALUES = Object.keys(CHANNEL_PRESENTATION_KEYS);

function humanize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Presentation for a channel value. An unknown value (a sixth enum case
 *  added without touching this story) gets a generic, never-undefined line. */
export function presentationFor(value: string, t: T): ChannelPresentation {
  const known = CHANNEL_PRESENTATION_KEYS[value];
  if (known) {
    return { label: t(known.labelKey), helpLine: t(known.helpLineKey), icon: known.icon, tint: known.tint };
  }
  return {
    label: humanize(value),
    helpLine: t('presentation.genericHelpLine'),
    icon: 'generic',
    tint: 'slate',
  };
}
