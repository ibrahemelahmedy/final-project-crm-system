import { useEffect, useRef } from 'react';
import { COLUMNS, type SortKey } from '../model/columns';

type Props = {
  sort: string;
  onSortChange: (key: SortKey) => void;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
};

function SortGlyph({ state }: { state: 'ascending' | 'descending' | 'none' }) {
  if (state === 'none') {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 9l3-3 3 3 M7 15l3 3 3-3" />
      </svg>
    );
  }
  // A single chevron in the active direction — the glyph SHAPE changes, so
  // sort direction is never carried by colour alone.
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={state === 'ascending' ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'} />
    </svg>
  );
}

export function TicketTableHeader({ sort, onSortChange, allSelected, someSelected, onToggleAll }: Props) {
  const selectAllRef = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property with no HTML attribute and no React
  // prop — setting checked={undefined} does not produce it.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const activeKey = sort.startsWith('-') ? sort.slice(1) : sort;
  const activeDir: 'ascending' | 'descending' = sort.startsWith('-') ? 'descending' : 'ascending';

  return (
    <thead className="tq-thead">
      <tr className="tq-row tq-head-row">
        {COLUMNS.map((col) => {
          const isActive = col.sortKey === activeKey;
          // aria-sort belongs on the <th>, not on the button inside it.
          const ariaSort = col.sortKey ? (isActive ? activeDir : 'none') : undefined;

          return (
            <th key={col.id} scope="col" className={`tq-cell tq-cell-${col.id}`} aria-sort={ariaSort}>
              {col.id === 'select' ? (
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="tq-checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Select all tickets on this page"
                />
              ) : col.sortKey ? (
                <button
                  type="button"
                  className="tq-sort-btn"
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => onSortChange(col.sortKey as SortKey)}
                >
                  {col.label}
                  <SortGlyph state={isActive ? activeDir : 'none'} />
                </button>
              ) : (
                <span className={col.hiddenLabel ? 'tq-sr-only' : undefined}>{col.label}</span>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
