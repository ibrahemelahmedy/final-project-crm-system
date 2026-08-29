import type { ReactNode } from 'react';

/**
 * Charting-library decision (Story 12): **Recharts**.
 *  - It renders SVG, so series colours are `var(--…)` tokens from index.css and
 *    both light/dark themes work from the existing token set — no second palette.
 *  - React-first component API, compatible with React 19 as used here.
 *  - Axis orientation, tick order and legend placement are explicit props,
 *    which is what makes the RTL decision below enforceable. Chart.js was
 *    rejected: no CSS-custom-property theming, no per-axis direction control.
 *
 * RTL decision (deliberate, not left to the library): the **plot area stays
 * LTR in both document directions** — a time axis reads left-to-right and
 * numeric axes stay LTR even inside an RTL page, matching how Arabic-language
 * interfaces conventionally present numeric charts. Every chart is wrapped by
 * THIS component, so `dir="ltr"` is applied in exactly one place. Everything
 * around the plot — card titles, legends, tables, the range picker — follows
 * the document direction and mirrors normally.
 *
 * Series colours live in ./chartTheme.ts.
 */
export function ChartFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rp-chart-frame" dir="ltr" role="img" aria-label={label}>
      {children}
    </div>
  );
}
