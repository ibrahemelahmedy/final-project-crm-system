import type { TicketChannel, TicketPriority, TicketStatus } from './ticket';

/**
 * Channel glyph paths, verbatim from
 * docs/design/references/2.ticket-queue/WisalTicketQueue-LightLTR.dc.html.
 */
export const CHANNEL_ICON_PATHS: Record<TicketChannel, string> = {
  email: 'M3 6h18v12H3z M3 6l9 7 9-7', // line 126
  web_form: 'M6 3h9l3 3v15H6z M9 8h6M9 12h6M9 16h4', // line 131
  chat: 'M4 5h16v10H8l-4 4z', // line 136
  whatsapp: 'M12 3a8 8 0 0 0-7 12l-1 4 4-1a8 8 0 1 0 4-15z M9 9.5c.3 2.8 2.7 5.2 5.5 5.5', // line 146
  sms: 'M6 3h12v14H9l-3 3z M9 8h6M9 11h4', // line 161
};

/**
 * Fallback label KEYS for when a value arrives without its server-rendered
 * `*_label` sibling. The resource always sends the label; these exist so a
 * partially-populated fixture still renders readable text rather than a raw
 * enum value. Story 16 (WIS-17): values are i18n keys in the `tickets`
 * namespace, not English text — callers resolve them with `t()`.
 */
export const PRIORITY_FALLBACK_LABELS: Record<TicketPriority, string> = {
  low: 'priority.low',
  normal: 'priority.normal',
  high: 'priority.high',
  urgent: 'priority.urgent',
};

export const STATUS_FALLBACK_LABELS: Record<TicketStatus, string> = {
  open: 'status.open',
  pending: 'status.pending',
  resolved: 'status.resolved',
  closed: 'status.closed',
};

export const CHANNEL_FALLBACK_LABELS: Record<TicketChannel, string> = {
  email: 'channel.email',
  whatsapp: 'channel.whatsapp',
  chat: 'channel.chat',
  sms: 'channel.sms',
  web_form: 'channel.web_form',
};

/** Maps a facet key to the i18n key used in filter chips and empty copy. */
export const FACET_LABELS = {
  status: 'facets.status',
  priority: 'facets.priority',
  channel: 'facets.channel',
  category: 'facets.category',
  assigned_to: 'facets.assigned_to',
} as const;
