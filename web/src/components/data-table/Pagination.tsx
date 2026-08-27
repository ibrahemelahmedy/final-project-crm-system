import React from 'react';

function pageWindow(current: number, last: number): (number | 'ellipsis')[] {
  const pages = new Set<number>([1, last, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis');
    result.push(p);
    prev = p;
  }
  return result;
}

// Port of WisalCustomers-LightLTR.dc.html lines 123-134.
export const Pagination: React.FC<{
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, lastPage, total, perPage, onPageChange }) => {
  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);

  return (
    <div className="dt-pagination">
      <span className="dt-pagination-summary">
        Showing{' '}
        <span dir="ltr">
          {from}–{to}
        </span>{' '}
        of <span dir="ltr">{total}</span>
      </span>
      <div className="dt-pagination-controls">
        <button
          type="button"
          className="dt-page-btn dt-page-chevron fv"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {pageWindow(currentPage, lastPage).map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="dt-page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="dt-page-btn fv"
              aria-current={p === currentPage ? 'page' : undefined}
              data-active={p === currentPage}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className="dt-page-btn dt-page-chevron dt-page-chevron-next fv"
          aria-label="Next page"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
};
