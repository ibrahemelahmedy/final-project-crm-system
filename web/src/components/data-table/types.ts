import type React from 'react';

// Frozen surface — Story 09 (Knowledge Base) consumes this unchanged.
// Do not rename these fields; adding new optional fields is fine.
export type ColumnDef<T> = {
  id: string; // stable key; also the localStorage identity
  header: string; // e.g. 'CUSTOMER'
  width: string; // a grid track: '2fr' | '90px'
  sortKey?: string; // omit => not sortable (EMAIL and TIER omit it)
  align?: 'start' | 'end';
  cell: (row: T) => React.ReactNode;
  /** Never hidden by the column menu — the identity column. */
  locked?: boolean;
};

export type SortState = { key: string; dir: 'asc' | 'desc' } | null;

export type DataTableProps<T> = {
  rows: T[];
  columns: ColumnDef<T>[]; // already ordered and filtered by the caller
  getRowId: (row: T) => number;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  sort: SortState;
  onSortChange: (key: string) => void;
  onRowActivate?: (row: T) => void; // row click / Enter => navigate
  caption: string; // screen-reader table caption
  getRowLabel?: (row: T) => string;
};
