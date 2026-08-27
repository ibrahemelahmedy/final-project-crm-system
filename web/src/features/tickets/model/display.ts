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
 * Fallback labels for when a value arrives without its server-rendered
 * `*_label` sibling. The resource always sends the label; these exist so a
 * partially-populated fixture still renders readable text rather than a raw
 * enum value.
 */
export const PRIORITY_FALLBACK_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const STATUS_FALLBACK_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const CHANNEL_FALLBACK_LABELS: Record<TicketChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  chat: 'Live chat',
  sms: 'SMS',
  web_form: 'Web form',
};

/** Maps a facet key to the human label used in filter chips and empty copy. */
export const FACET_LABELS = {
  status: 'Status',
  priority: 'Priority',
  channel: 'Channel',
  category: 'Category',
  assigned_to: 'Agent',
} as const;

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/**
 * Relative time via Intl.RelativeTimeFormat, not a date library and not a
 * hand-rolled unit table with hard-coded English. Story 15 switches the locale
 * and this follows it.
 *
 * The PHP `intl` extension being unavailable on this machine is a BACKEND
 * constraint (ADR-004) and does not affect the browser's Intl.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const diff = then.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return rtf.format(Math.round(diff / 1000), 'second');
}

/** The full timestamp, used as a `title` so the exact value is always reachable. */
export function formatAbsoluteTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
