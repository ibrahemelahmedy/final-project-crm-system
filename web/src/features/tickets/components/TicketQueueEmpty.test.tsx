import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TicketQueueEmpty } from './TicketQueueEmpty';

describe('TicketQueueEmpty', () => {
  it('offers Clear filters when filters are active', () => {
    render(
      <TicketQueueEmpty
        activeCount={2}
        activeLabels={['"Priority"', '"Status"']}
        onClearFilters={vi.fn()}
        onNewTicket={vi.fn()}
      />
    );

    expect(screen.getByText('No tickets match your filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    // The body names the facets that caused the emptiness.
    expect(screen.getByText(/"Priority" or "Status"/)).toBeInTheDocument();
  });

  it('offers New ticket when no filters are active', () => {
    render(
      <TicketQueueEmpty
        activeCount={0}
        activeLabels={[]}
        onClearFilters={vi.fn()}
        onNewTicket={vi.fn()}
      />
    );

    expect(screen.getByText('No tickets yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New ticket' })).toBeInTheDocument();
    // "Clear filters" with nothing to clear reads as a bug.
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});
