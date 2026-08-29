import { screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TicketMetaPanel } from './TicketMetaPanel';
import { makeTicket, renderWithProviders } from './testUtils';
import type { TicketSla } from '../../model/ticket';

vi.mock('../../../customers', async () => {
  const actual = await vi.importActual('../../../customers');
  return { ...actual, useCustomer: vi.fn() };
});

import { useCustomer } from '../../../customers';

const meta = {
  priorities: [{ value: 'high', label: 'High' }],
  statuses: [{ value: 'open', label: 'Open' }],
  channels: [],
  categories: [],
  agents: [],
  transitions: { open: ['pending'], pending: [], resolved: [], closed: [] },
} as never;

describe('TicketMetaPanel', () => {
  it('renders the SLA "Not configured" branch', () => {
    (useCustomer as ReturnType<typeof vi.fn>).mockReturnValue({ isPending: true });
    renderWithProviders(<TicketMetaPanel ticket={makeTicket()} meta={meta} events={[]} />);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders the SLA breached branch', () => {
    (useCustomer as ReturnType<typeof vi.fn>).mockReturnValue({ isPending: true });
    const breached: TicketSla = { due_at: null, minutes_left: -30, risk: 'breached' };
    renderWithProviders(<TicketMetaPanel ticket={makeTicket({ sla: breached })} meta={meta} events={[]} />);
    expect(screen.getByText('SLA breached')).toBeInTheDocument();
  });

  it('falls back to the ticket name and a muted line when the customer fetch fails', () => {
    (useCustomer as ReturnType<typeof vi.fn>).mockReturnValue({ isError: true });

    renderWithProviders(<TicketMetaPanel ticket={makeTicket()} meta={meta} events={[]} />);

    expect(screen.getByText('Amelia Chen')).toBeInTheDocument();
    expect(screen.getByText('Contact details unavailable')).toBeInTheDocument();
  });
});
