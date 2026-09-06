import { formatDate, formatRelative } from '../../../i18n';

// WisalNotifications-LightLTR.dc.html's row timestamps: relative for the
// first day, switching to an absolute date ("Aug 24") past a threshold.
// Story 16 (WIS-17): the relative portion now comes from the shared
// `formatRelative` — the same one every other migrated feature uses — rather
// than a second hand-rolled "N min ago" table that cannot follow a language
// switch.

const ABSOLUTE_FALLBACK_HOURS = 24;

export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const hours = Math.round((now.getTime() - then.getTime()) / 3_600_000);
  if (hours < ABSOLUTE_FALLBACK_HOURS) return formatRelative(then, now);

  return formatDate(then, { day: 'numeric', month: 'short' });
}
