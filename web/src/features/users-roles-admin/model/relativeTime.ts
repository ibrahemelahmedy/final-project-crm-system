// The design's LAST ACTIVE column shows relative text: "Just now", "12m ago",
// "1h ago", "2d ago", "14d ago" (WisalUsers-LightLTR.dc.html).
//
// Intl.RelativeTimeFormat, never a hand-rolled string table — Story 15
// switches the locale and a hard-coded "ago" cannot follow it. The bucket
// thresholds match the design's own examples.

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' });

export function formatLastActive(iso: string | null, now: Date = new Date()): string {
  // A never-signed-in invitee. "Never" is a real state, not a blank cell —
  // an empty cell reads as a rendering bug.
  if (!iso) return 'Never';

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Never';

  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);

  // A clock skew between server and browser can put last_login_at slightly in
  // the future; that is "Just now", not "in 4 seconds".
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');

  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, 'day');

  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, 'month');

  return rtf.format(-Math.floor(months / 12), 'year');
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Absolute timestamp for the audit log's WHEN column and the row title. */
export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}
