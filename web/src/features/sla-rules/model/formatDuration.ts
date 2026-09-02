/**
 * The single duration formatter — the card and the form both use it, so the
 * value in the form always matches the value on the card.
 *
 * Largest whole unit only: `90` renders `90 minutes`, not `1 hour 30 minutes`,
 * because the design's fact column is one line at 16px/700 and a two-part
 * value wraps at the card's 36px gap.
 *
 * There is no "business day" — no working-hours or holiday model exists in
 * this project, so `7200` renders `5 days`, and the countdown that ticks
 * beside it counts the same wall-clock minutes.
 *
 * 15 → "15 minutes" · 60 → "1 hour" · 240 → "4 hours" · 1440 → "1 day" · 7200 → "5 days"
 */
export type DurationUnit = 'minutes' | 'hours' | 'days';

export function splitDuration(minutes: number): { value: number; unit: DurationUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' };
  return { value: minutes, unit: 'minutes' };
}

export function toMinutes(value: number, unit: DurationUnit): number {
  if (unit === 'days') return value * 1440;
  if (unit === 'hours') return value * 60;
  return value;
}

/**
 * Story 16 (WIS-17): `t` is required, not optional. An optional translator
 * with an English fallback was exactly the shape that kept
 * `value === 1 ? '' : 's'` — untranslatable, Arabic-incapable pluralization —
 * alive inside an already-"migrated" feature. Every real call site has a
 * `sla`-namespace `t` available; tests get one from the real i18next instance
 * via `i18n.getFixedT('en', 'sla')`, so they exercise the actual catalogue
 * rather than a second hand-written English table.
 *
 * @param t Translator for the `sla` namespace, so the unit words localise.
 */
export function formatDuration(
  minutes: number,
  t: (key: string, opts: { count: number }) => string,
): string {
  const { value, unit } = splitDuration(minutes);
  return t(`duration.${unit}`, { count: value });
}
