import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AgentPerformanceCard } from './AgentPerformanceCard';
import type { AgentsBlock } from '../model/report';

const block: AgentsBlock = {
  available: true,
  items: [
    { user_id: 1, name: 'Sarah Ahmed', deactivated: false, resolved: 11, avg_response_minutes: 11 },
    { user_id: 2, name: 'Tom Becker', deactivated: true, resolved: 4, avg_response_minutes: 95 },
  ],
};

describe('AgentPerformanceCard', () => {
  it('renders the three artboard columns in order', () => {
    render(<AgentPerformanceCard block={block} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Agent', 'Resolved', 'Avg. Response']);
    expect(screen.getByText('11m')).toBeInTheDocument();
  });

  it('keeps a deactivated agent row and marks it', () => {
    render(<AgentPerformanceCard block={block} />);
    const row = screen.getByText('Tom Becker').closest('tr')!;
    expect(within(row).getByText(/deactivated/)).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();
  });

  it('shows the Empty state when unavailable and renders no table', () => {
    render(<AgentPerformanceCard block={{ available: false, items: [] }} />);
    expect(screen.getByText('No agent resolved a ticket in this date range.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
