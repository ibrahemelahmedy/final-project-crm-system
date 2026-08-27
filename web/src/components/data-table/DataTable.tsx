import React, { useEffect, useRef } from 'react';
import type { ColumnDef, DataTableProps } from './types';

// Sort chevron — export line 74 (WisalCustomers-LightLTR.dc.html).
const SortChevron: React.FC<{ dir: 'asc' | 'desc' | 'none' }> = ({ dir }) => {
  if (dir === 'none') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--table-sort-idle)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 9l3-3 3 3 M7 15l3 3 3-3" />
      </svg>
    );
  }
  // Colour is never the only signal (brief.md line 196) — the glyph itself
  // changes shape between ascending and descending.
  const d = dir === 'asc' ? 'M7 13l5-5 5 5' : 'M7 11l5 5 5-5';
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-main)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
};

// One accessible checkbox. `indeterminate` is a DOM property, not an
// attribute — it is set imperatively via a ref, or it silently does nothing.
const Checkbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  'aria-label': string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ checked, indeterminate = false, onChange, onClick, ...rest }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="dt-checkbox fv"
      checked={checked}
      onChange={onChange}
      onClick={onClick}
      {...rest}
    />
  );
};

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  selectedIds,
  onSelectionChange,
  sort,
  onSortChange,
  onRowActivate,
  caption,
  getRowLabel,
}: DataTableProps<T>) {
  // ONE grid-template-columns definition — this is what makes RTL mirroring
  // free. A second, RTL-specific track list must never be added anywhere.
  const gridTemplate = ['32px', ...columns.map((c) => c.width)].join(' ');

  const selectedSet = new Set(selectedIds);
  const pageIds = rows.map(getRowId);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const someSelected = !allSelected && pageIds.some((id) => selectedSet.has(id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !pageIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...pageIds])]);
    }
  };

  const toggleRow = (id: number) => {
    if (selectedSet.has(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const ariaSortFor = (col: ColumnDef<T>): React.AriaAttributes['aria-sort'] => {
    if (!col.sortKey) return undefined;
    if (!sort || sort.key !== col.sortKey) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div role="table" aria-label={caption} className="dt-table">
      <div role="row" className="dt-row dt-header-row" style={{ gridTemplateColumns: gridTemplate }}>
        <div role="columnheader" className="dt-cell dt-select-cell">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleAll}
            aria-label="Select all rows on this page"
          />
        </div>
        {columns.map((col) => (
          <div
            key={col.id}
            role="columnheader"
            aria-sort={ariaSortFor(col)}
            className="dt-cell dt-header-cell"
            style={{ textAlign: col.align === 'end' ? 'end' : 'start' }}
          >
            {col.sortKey ? (
              <button
                type="button"
                className="dt-sort-btn fv"
                onClick={() => onSortChange(col.sortKey!)}
              >
                {col.header}
                <SortChevron dir={sort && sort.key === col.sortKey ? sort.dir : 'none'} />
              </button>
            ) : (
              <span>{col.header}</span>
            )}
          </div>
        ))}
      </div>

      {rows.map((row, i) => {
        const id = getRowId(row);
        const selected = selectedSet.has(id);
        const label = getRowLabel ? getRowLabel(row) : `row ${id}`;
        return (
          <div
            key={id}
            role="row"
            className="dt-row dt-body-row fv"
            data-selected={selected}
            style={{
              gridTemplateColumns: gridTemplate,
              background: selected
                ? 'var(--table-row-selected)'
                : i % 2 === 1
                  ? 'var(--table-row-alt)'
                  : undefined,
            }}
            tabIndex={0}
            onClick={() => onRowActivate?.(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRowActivate?.(row);
            }}
          >
            <div role="cell" className="dt-cell dt-select-cell">
              <Checkbox
                checked={selected}
                onChange={() => toggleRow(id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${label}`}
              />
            </div>
            {columns.map((col) => (
              <div
                key={col.id}
                role="cell"
                className="dt-cell"
                style={{ textAlign: col.align === 'end' ? 'end' : 'start' }}
              >
                {col.cell(row)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
