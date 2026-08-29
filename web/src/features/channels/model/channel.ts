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

// ---- Period ---------------------------------------------------------------

export const CHANNEL_PERIODS = ['7d', '30d', '90d'] as const;
export type ChannelPeriod = (typeof CHANNEL_PERIODS)[number];
export const DEFAULT_CHANNEL_PERIOD: ChannelPeriod = '30d';

export const PERIOD_LABELS: Record<ChannelPeriod, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

export function isChannelPeriod(value: string | null): value is ChannelPeriod {
  return value === '7d' || value === '30d' || value === '90d';
}

// ---- Status pill --------------------------------------------------------
//
// There is deliberately NO `connected` entry and no uptime/health field —
// nothing in this release can produce one, so a future bug cannot render a
// fabricated healthy state.
export const STATUS_LABELS: Record<string, string> = {
  not_connected: 'Not connected',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? 'Not connected';
}

// ---- Per-channel presentation (decorative copy only) --------------------

export type ChannelIconName = 'email' | 'whatsapp' | 'chat' | 'sms' | 'web_form' | 'generic';

export type ChannelPresentation = {
  label: string;
  helpLine: string;
  icon: ChannelIconName;
  tint: 'indigo' | 'green' | 'violet' | 'amber' | 'emerald' | 'slate';
};

export const CHANNEL_PRESENTATION: Record<string, ChannelPresentation> = {
  email: {
    label: 'Email',
    helpLine: 'Tickets arrive via email once an inbox is configured.',
    icon: 'email',
    tint: 'indigo',
  },
  whatsapp: {
    label: 'WhatsApp',
    helpLine: 'Requires a WhatsApp Business API account.',
    icon: 'whatsapp',
    tint: 'green',
  },
  chat: {
    label: 'Live chat',
    helpLine: 'Embed a chat widget on your site or app.',
    icon: 'chat',
    tint: 'violet',
  },
  sms: {
    label: 'SMS',
    helpLine: 'Requires an SMS provider (e.g. Twilio) to be configured.',
    icon: 'sms',
    tint: 'amber',
  },
  web_form: {
    label: 'Web forms',
    helpLine: 'Embed a contact form to collect tickets from your website.',
    icon: 'web_form',
    tint: 'emerald',
  },
};

/** The five channels this release ships help copy for — derived from the map,
 *  never a second hand-maintained list. Used only to render the channel list
 *  while the API request is in flight or has failed. */
export const KNOWN_CHANNEL_VALUES = Object.keys(CHANNEL_PRESENTATION);

function humanize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Presentation for a channel value. An unknown value (a sixth enum case
 *  added without touching this story) gets a generic, never-undefined line. */
export function presentationFor(value: string): ChannelPresentation {
  return (
    CHANNEL_PRESENTATION[value] ?? {
      label: humanize(value),
      helpLine: 'Connect this channel to start collecting tickets from it.',
      icon: 'generic',
      tint: 'slate',
    }
  );
}
