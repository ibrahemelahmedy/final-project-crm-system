// WisalNotifications-LightLTR.dc.html's row timestamps: "12 min ago", "35 min
// ago", "1 hr ago", "3 hr ago", switching to an absolute date ("Aug 24") past
// a threshold. A dedicated formatter, not users-roles-admin's
// `formatLastActive` — that one never falls back to an absolute date, and its
// wording ("12m ago") doesn't match this artboard's ("12 min ago").

const ABSOLUTE_FALLBACK_HOURS = 24;

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < ABSOLUTE_FALLBACK_HOURS) return `${hours} hr ago`;

  return dateFormatter.format(then);
}
