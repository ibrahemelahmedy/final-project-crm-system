import type { ReactNode } from 'react';

/**
 * The card shell every Reports widget renders inside. Card chrome (title) is
 * NOT wrapped in `dir="ltr"` — it follows the document direction and mirrors.
 * Only the plot area (via ChartFrame) stays LTR.
 *
 * A block whose `available` flag is false renders `empty` here — an explicit
 * Empty state, never a `0%` that reads like a measurement.
 */
export function ReportCard({
  title,
  available,
  emptyMessage,
  children,
}: {
  title: string;
  available: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  return (
    <section className="rp-card">
      <h2 className="rp-card-title">{title}</h2>
      {available ? (
        children
      ) : (
        <div className="rp-empty">
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
