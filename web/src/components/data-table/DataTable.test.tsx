import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from './DataTable';
import type { ColumnDef } from './types';

type Row = { id: number; name: string };

const rows: Row[] = [
  { id: 1, name: 'Amelia Chen' },
  { id: 2, name: 'Marcus Webb' },
  { id: 3, name: 'Priya Nair' },
];

function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'name', header: 'CUSTOMER', width: '2fr', sortKey: 'name', cell: (r) => r.name, locked: true },
    { id: 'other', header: 'OTHER', width: '1fr', cell: () => 'x' },
  ];
}

describe('DataTable', () => {
  it('renders one row per record with the table roles', () => {
    render(
      <DataTable
        rows={rows}
        columns={makeColumns()}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        selectedIds={[]}
        onSelectionChange={() => {}}
        sort={null}
        onSortChange={() => {}}
        caption="Customers"
      />
    );
    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1); // + header row
    expect(screen.getAllByRole('columnheader')).toHaveLength(3); // select + 2 columns
  });

  it('sets aria-sort on the sorted column only', () => {
    render(
      <DataTable
        rows={rows}
        columns={makeColumns()}
        getRowId={(r) => r.id}
        selectedIds={[]}
        onSelectionChange={() => {}}
        sort={{ key: 'name', dir: 'asc' }}
        onSortChange={() => {}}
        caption="Customers"
      />
    );
    const headers = screen.getAllByRole('columnheader');
    const nonNone = headers.filter((h) => h.getAttribute('aria-sort') && h.getAttribute('aria-sort') !== 'none');
    expect(nonNone).toHaveLength(1);
    expect(nonNone[0]).toHaveAttribute('aria-sort', 'ascending');
  });

  it('puts the header checkbox in an indeterminate state for a partial selection', () => {
    render(
      <DataTable
        rows={rows}
        columns={makeColumns()}
        getRowId={(r) => r.id}
        selectedIds={[1]}
        onSelectionChange={() => {}}
        sort={null}
        onSortChange={() => {}}
        caption="Customers"
      />
    );
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].indeterminate).toBe(true);
  });

  it('does not activate the row when the checkbox is clicked', () => {
    const onRowActivate = vi.fn();
    render(
      <DataTable
        rows={rows}
        columns={makeColumns()}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        selectedIds={[]}
        onSelectionChange={() => {}}
        sort={null}
        onSortChange={() => {}}
        onRowActivate={onRowActivate}
        caption="Customers"
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Select Amelia Chen' });
    fireEvent.click(checkbox);
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it('activates a row on Enter', () => {
    const onRowActivate = vi.fn();
    render(
      <DataTable
        rows={rows}
        columns={makeColumns()}
        getRowId={(r) => r.id}
        getRowLabel={(r) => r.name}
        selectedIds={[]}
        onSelectionChange={() => {}}
        sort={null}
        onSortChange={() => {}}
        onRowActivate={onRowActivate}
        caption="Customers"
      />
    );
    const bodyRows = screen.getAllByRole('row').slice(1);
    fireEvent.keyDown(bodyRows[0], { key: 'Enter' });
    expect(onRowActivate).toHaveBeenCalledWith(rows[0]);
  });

  it('renders the columns in the order given', () => {
    const reordered: ColumnDef<Row>[] = [
      { id: 'other', header: 'OTHER', width: '1fr', cell: () => 'x' },
      { id: 'name', header: 'CUSTOMER', width: '2fr', sortKey: 'name', cell: (r) => r.name },
    ];
    render(
      <DataTable
        rows={rows}
        columns={reordered}
        getRowId={(r) => r.id}
        selectedIds={[]}
        onSelectionChange={() => {}}
        sort={null}
        onSortChange={() => {}}
        caption="Customers"
      />
    );
    const headers = screen.getAllByRole('columnheader').slice(1); // drop select header
    expect(headers[0]).toHaveTextContent('OTHER');
    expect(headers[1]).toHaveTextContent('CUSTOMER');
  });
});
