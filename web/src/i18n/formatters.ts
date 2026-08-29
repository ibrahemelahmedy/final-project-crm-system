import i18n from './instance';

/**
 * Story 15 (WIS-11), decision 2: ALL locale formatting is client-side, via the
 * JS `Intl` API. The API returns ISO-8601 UTC timestamps and raw numbers and
 * never a pre-formatted string.
 *
 * Components import these four functions and never call `Intl` or
 * `toLocaleString` directly — that is what makes locale-awareness auditable
 * (see i18n/noHardcodedStrings and the Verification Steps grep).
 *
 * Decision 3: Arabic uses WESTERN (Latin) digits — `numberingSystem: 'latn'`
 * is passed explicitly on every formatter, because the design exports render
 * Latin digits and Eastern Arabic numerals break table alignment built against
 * Latin digit widths.
 */

/** The active locale, taken from the i18next instance so a caller cannot pass the wrong one. */
function activeLocale(): string {
  const lng = i18n.resolvedLanguage || i18n.language || 'en';
  return lng.startsWith('ar') ? 'ar' : 'en';
}

const LATN = { numberingSystem: 'latn' } as const;

export function formatDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...LATN,
    ...options,
  }).format(date);
}

export function formatDateTime(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...LATN,
    ...options,
  }).format(date);
}

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'seconds' },
  { amount: 60, unit: 'minutes' },
  { amount: 24, unit: 'hours' },
  { amount: 7, unit: 'days' },
  { amount: 4.34524, unit: 'weeks' },
  { amount: 12, unit: 'months' },
  { amount: Number.POSITIVE_INFINITY, unit: 'years' },
];

export function formatRelative(value: string | number | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  // RelativeTimeFormat has no numberingSystem option; Arabic relative phrases
  // ("منذ 3 أيام") carry Latin digits in the `latn`-tagged runtimes we target.
  const rtf = new Intl.RelativeTimeFormat(activeLocale() === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
  let duration = (date.getTime() - now.getTime()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), 'years');
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(activeLocale(), { ...LATN, ...options }).format(value);
}
