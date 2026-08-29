import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TicketMessage } from '../../model/ticketMessage';
import type { Ticket } from '../../model/ticket';

export function makeMessage(overrides: Partial<TicketMessage> = {}): TicketMessage {
  return {
    id: 1,
    ticket_id: 4821,
    author_type: 'customer',
    author: { id: 12, name: 'Amelia Chen', initials: 'AC' },
    is_mine: false,
    channel: 'email',
    channel_label: 'Email',
    body: 'Hello there',
    visibility: 'public',
    created_at: '2026-08-22T08:02:00.000000Z',
    ...overrides,
  };
}

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 4821,
    reference: '#4821',
    subject: 'Cannot access email integration',
    description: null,
    status: 'open',
    status_label: 'Open',
    priority: 'high',
    priority_label: 'High',
    category: 'technical',
    category_label: 'Technical',
    channel: 'whatsapp',
    channel_label: 'WhatsApp',
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

export function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}
