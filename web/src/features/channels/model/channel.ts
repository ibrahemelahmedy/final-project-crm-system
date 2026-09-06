// The Channels overview model — Story 14 (WIS-15).
// Mirrors App\Http\Resources\ChannelOverviewResource on the API.
//
// The channel LIST always comes from the API (`data`), which iterates
// App\Enums\Channel. This file holds only the DECORATIVE per-channel copy
// (help line + icon), keyed by the API's `value`, plus a generic fallback for
// an enum value this map has not been told about. It can therefore never
// disagree with the backend about *which* channels exist — only about the
// help line for one it doesn't recognise.

export type ChannelStatus = 'not_connected';

export type ChannelOverviewItem = {
  value: string;
  label_key: string;
  status: string;
  ticket_count: number;
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
// There is deliberately NO `connected` entry and no uptime/health field —
// nothing in this release can produce one, so a future bug cannot render a
// fabricated healthy state.
const STATUS_LABEL_KEYS: Record<string, string> = {
  not_connected: 'status.notConnected',
};

export function statusLabel(status: string, t: T): string {
  return t(STATUS_LABEL_KEYS[status] ?? 'status.notConnected');
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
