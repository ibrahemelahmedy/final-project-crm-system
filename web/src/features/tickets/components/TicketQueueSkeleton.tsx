import { COLUMNS } from '../model/columns';

/**
 * From WisalTicketQueue-LoadingState.dc.html lines 79–105, with one deliberate
 * correction: the export draws a SEVEN-column grid while the real table has
 * nine. A skeleton whose columns do not line up with the table that replaces it
 * produces the exact layout shift a skeleton exists to prevent, so this reuses
 * the real nine-column grid and keeps only the export's bar widths and spacing.
 */

const BAR_WIDTHS = ['16px', '15px', '44px', '80%', '70%', '60px', '70px', '80px', '50px'];

export function TicketQueueSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="tq-skeleton" role="status" aria-busy="true">
      <span className="tq-sr-only">Loading tickets</span>

      <div className="tq-sk-head">
        <span className="tq-sk tq-sk-title" />
        <span className="tq-sk tq-sk-subtitle" />
      </div>

      <div className="tq-sk-chips">
        {[110, 100, 120, 100].map((w, i) => (
          <span key={i} className="tq-sk tq-sk-chip" style={{ inlineSize: `${w}px` }} />
        ))}
      </div>

      <div className="tq-sk-card">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="tq-row tq-sk-row">
            {COLUMNS.map((col, c) => (
              <div key={col.id} className={`tq-cell tq-cell-${col.id}`}>
                <span
                  className={`tq-sk ${col.id === 'priority' || col.id === 'status' ? 'tq-sk-pill' : 'tq-sk-bar'}`}
                  style={{ inlineSize: BAR_WIDTHS[c] }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
