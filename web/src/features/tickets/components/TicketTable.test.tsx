import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { TicketTable } from './TicketTable';
import { useRowSelection } from '../hooks/useRowSelection';
import { parseTicketFilters, type TicketFilters } from '../model/ticketFilters';
import type { Ticket } from '../model/ticket';

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 4821,
    reference: '#4821',
    subject: 'Unable to reset password via email link',
    description: null,
    status: 'open',
    status_label: 'Open',
    priority: 'high',
    priority_label: 'High',
    category: 'account',
    category_label: 'Account',
    channel: 'email',
    channel_label: 'Email',
    customer: { id: 12, name: 'Amelia Chen' },
    assignee: { id: 3, name: 'Sarah Ahmed', initials: 'SA' },
    created_by: { id: 3, name: 'Sarah Ahmed' },
    sla: { due_at: null, minutes_left: null, risk: null },
    resolved_at: null,
    closed_at: null,
    created_at: '2026-08-26T09:12:00.000000Z',
    updated_at: '2026-08-26T11:40:00.000000Z',
    ...overrides,
  };
}

const noop = () => {};

function renderTable(props: Partial<React.ComponentProps<typeof TicketTable>> = {}) {
  const tickets = props.tickets ?? [makeTicket()];
  return render(
    <MemoryRouter>
      <TicketTable
        tickets={tickets}
        sort="-created_at"
        onSortChange={noop}
        selected={[]}
        onToggle={noop}
        onToggleAll={noop}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('TicketTable', () => {
  it('renders one row per ticket with the reference, subject, customer, priority, status and assignee', () => {
    renderTable({
      tickets: [makeTicket(), makeTicket({ id: 4819, reference: '#4819', subject: 'VPN drops' })],
    });

    // 1 header row + 2 body rows
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('#4821')).toBeInTheDocument();
    expect(screen.getByText('Unable to reset password via email link')).toBeInTheDocument();
    expect(screen.getAllByText('Amelia Chen')).toHaveLength(2);
    expect(screen.getAllByText('High')).toHaveLength(2);
    expect(screen.getAllByText('Open')).toHaveLength(2);
    expect(screen.getAllByText('Sarah Ahmed')).toHaveLength(2);
  });

  it('renders the priority and status as separate labelled badges', () => {
    renderTable();

    // Both texts present — colour is never the only signal.
    const priority = screen.getByText('High');
    const status = screen.getByText('Open');
    expect(priority).toBeInTheDocument();
    expect(status).toBeInTheDocument();
    // And they are genuinely two elements with two class families.
    expect(priority.className).toContain('tq-prio');
    expect(status.className).toContain('tq-status');
    expect(priority).not.toBe(status);
  });

  it('renders a dash and an SLA-not-configured label while risk is null', () => {
    renderTable();
    const sla = screen.getByLabelText('SLA not configured');
    expect(sla).toHaveTextContent('—');
  });

  it('marks the active sort column with aria-sort', () => {
    renderTable({ sort: '-priority' });

    const headers = screen.getAllByRole('columnheader');
    const sorted = headers.filter(
      (h) => h.getAttribute('aria-sort') && h.getAttribute('aria-sort') !== 'none'
    );

    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toHaveAttribute('aria-sort', 'descending');
    expect(sorted[0]).toHaveTextContent('Priority');
  });

  it('does not put aria-sort on an unsortable column', () => {
    renderTable();
    const subject = screen
      .getAllByRole('columnheader')
      .find((h) => h.textContent?.includes('Subject'));
    expect(subject).toBeDefined();
    expect(subject).not.toHaveAttribute('aria-sort');
  });

  it('sets the select-all checkbox to indeterminate for a partial selection', () => {
    renderTable({
      tickets: [makeTicket(), makeTicket({ id: 4819, reference: '#4819' })],
      selected: [4821],
    });

    const selectAll = screen.getByLabelText('Select all tickets on this page') as HTMLInputElement;
    // indeterminate is a DOM PROPERTY with no attribute — read the property.
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);
  });

  it('checks the select-all box when every row is selected', () => {
    renderTable({ tickets: [makeTicket()], selected: [4821] });
    const selectAll = screen.getByLabelText('Select all tickets on this page') as HTMLInputElement;
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
  });

  it('calls onSortChange with the column key when a sortable header is clicked', () => {
    const onSortChange = vi.fn();
    renderTable({ onSortChange });

    fireEvent.click(screen.getByRole('button', { name: /Priority/i }));
    expect(onSortChange).toHaveBeenCalledWith('priority');
  });
});

// A harness that drives the real useRowSelection hook, so the clearing rule is
// tested rather than restated.
function SelectionHarness({ filters }: { filters: TicketFilters }) {
  const { selected, toggle } = useRowSelection(filters);
  return (
    <div>
      <span data-testid="selected">{selected.join(',')}</span>
      <button type="button" onClick={() => toggle(4821)}>
        pick
      </button>
    </div>
  );
}

describe('useRowSelection', () => {
  it('clears the selection when the filters change', () => {
    function Wrapper() {
      const [filters, setFilters] = useState(parseTicketFilters({}));
      return (
        <>
          <SelectionHarness filters={filters} />
          <button type="button" onClick={() => setFilters(parseTicketFilters({ status: ['open'] }))}>
            filter
          </button>
        </>
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByText('pick'));
    expect(screen.getByTestId('selected').textContent).toBe('4821');

    fireEvent.click(screen.getByText('filter'));
    expect(screen.getByTestId('selected').textContent).toBe('');
  });

  it('does not clear the selection when an equal filters object is re-created', () => {
    function Wrapper() {
      const [, force] = useState(0);
      // A fresh object with identical contents — a background refetch shape.
      const filters = parseTicketFilters({});
      return (
        <>
          <SelectionHarness filters={filters} />
          <button type="button" onClick={() => force((n) => n + 1)}>
            rerender
          </button>
        </>
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByText('pick'));
    expect(screen.getByTestId('selected').textContent).toBe('4821');

    fireEvent.click(screen.getByText('rerender'));
    // Keys on the SERIALISED filters, so an identical-but-new object is a no-op.
    expect(screen.getByTestId('selected').textContent).toBe('4821');
  });
});
