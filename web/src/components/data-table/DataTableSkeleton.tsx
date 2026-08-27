import type { ColumnDef } from './types';

// Port of WisalCustomers-LoadingState.dc.html lines 90-97: real header
// labels (no sort chevrons), six rows at the real row height so the table
// does not jump when data lands.
export function DataTableSkeleton<T>({
  columns,
  rows = 6,
}: {
  columns: ColumnDef<T>[];
  rows?: number;
}) {
  const gridTemplate = ['32px', ...columns.map((c) => c.width)].join(' ');

  return (
    <div role="table" aria-busy="true" aria-label="Loading" className="dt-table">
      <div role="row" className="dt-row dt-header-row" style={{ gridTemplateColumns: gridTemplate }}>
        <div role="columnheader" className="dt-cell dt-select-cell" />
        {columns.map((col) => (
          <div key={col.id} role="columnheader" className="dt-cell dt-header-cell">
            <span>{col.header}</span>
          </div>
        ))}
      </div>

      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          role="row"
          className="dt-row dt-body-row dt-skeleton-row"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div role="cell" className="dt-cell dt-select-cell">
            <span className="sk" style={{ width: 16, height: 16, borderRadius: 4 }} />
          </div>
          <div role="cell" className="dt-cell dt-skeleton-name-cell">
            <span className="sk" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <span className="sk" style={{ width: 140, height: 14 }} />
          </div>
          <div role="cell" className="dt-cell">
            <span className="sk" style={{ width: 100, height: 14 }} />
          </div>
          <div role="cell" className="dt-cell">
            <span className="sk" style={{ width: 20, height: 14 }} />
          </div>
          <div role="cell" className="dt-cell">
            <span className="sk" style={{ width: 70, height: 14 }} />
          </div>
          <div role="cell" className="dt-cell">
            <span className="sk" style={{ width: 60, height: 18, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
