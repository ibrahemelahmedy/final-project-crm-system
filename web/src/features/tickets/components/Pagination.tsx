import { useUiPreferences } from '../../../app/providers/UiPreferencesContext';
import type { Paginated, Ticket } from '../model/ticket';

type Props = {
  meta: Paginated<Ticket>['meta'];
  onPageChange: (page: number) => void;
};

// The two directional glyphs. Under RTL they SWAP — brief.md line 202 requires
// directional icons to mirror, and the RTL export fails to (line 176). A
// transform: scaleX(-1) would mirror the focus ring too, so the paths swap
// instead.
const CHEVRON_START = 'M15 6l-6 6 6 6';
const CHEVRON_END = 'M9 6l6 6-6 6';

/** 1 … current-1 current current+1 … last */
function pageWindow(current: number, last: number): (number | 'ellipsis')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages: (number | 'ellipsis')[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(last - 1, current + 1);

  if (from > 2) pages.push('ellipsis');
  for (let p = from; p <= to; p += 1) pages.push(p);
  if (to < last - 1) pages.push('ellipsis');
  pages.push(last);

  return pages;
}

export function Pagination({ meta, onPageChange }: Props) {
  const { direction } = useUiPreferences();
  const rtl = direction === 'rtl';

  const prevPath = rtl ? CHEVRON_END : CHEVRON_START;
  const nextPath = rtl ? CHEVRON_START : CHEVRON_END;

  const current = meta.current_page;
  const last = meta.last_page;

  return (
    <nav className="tq-pagination" aria-label="Ticket queue pagination">
      {/* Straight from the server's meta — a client-computed range disagrees
          with the server the moment a row is created between requests. */}
      <p className="tq-pagination-summary">
        Showing{' '}
        <span dir="ltr" className="tq-ltr">
          {meta.from ?? 0}–{meta.to ?? 0}
        </span>{' '}
        of{' '}
        <span dir="ltr" className="tq-ltr">
          {meta.total}
        </span>
      </p>

      <div className="tq-pagination-controls">
        <button
          type="button"
          className="tq-page-btn"
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          aria-label="Previous page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={prevPath} />
          </svg>
        </button>

        {pageWindow(current, last).map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`gap-${i}`} className="tq-page-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className="tq-page-btn"
              data-current={page === current ? 'true' : 'false'}
              // The current page is aria-current and stays ENABLED — a
              // disabled current page is unreachable by keyboard.
              aria-current={page === current ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              <span dir="ltr" className="tq-ltr">
                {page}
              </span>
            </button>
          )
        )}

        <button
          type="button"
          className="tq-page-btn"
          onClick={() => onPageChange(current + 1)}
          disabled={current >= last}
          aria-label="Next page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={nextPath} />
          </svg>
        </button>
      </div>
    </nav>
  );
}
