import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardWidget } from './DashboardWidget';
import { widgetState } from '../model/widgetState';

describe('DashboardWidget shared shell', () => {
  it('renders the loading state with an accessible busy indication', () => {
    render(<DashboardWidget title="My Queue" state="loading" />);
    const section = screen.getByRole('status');
    expect(section).toBeInTheDocument();
    expect(screen.getByText(/loading my queue/i)).toBeInTheDocument();
  });

  it('renders the error state with a retry control', () => {
    const onRetry = vi.fn();
    render(
      <DashboardWidget title="My Queue" state="error" errorMessage="boom" onRetry={onRetry} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    screen.getByRole('button', { name: /try again/i }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the empty state with its message and action', () => {
    render(
      <DashboardWidget
        title="My Queue"
        state="empty"
        emptyMessage="No tickets assigned to you yet"
        emptyAction={<a href="/tickets">Browse queue</a>}
      />
    );
    expect(screen.getByText('No tickets assigned to you yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse queue' })).toBeInTheDocument();
  });

  it('renders children only in the ready state', () => {
    const { rerender } = render(
      <DashboardWidget title="My Queue" state="empty" emptyMessage="empty">
        <p>real content</p>
      </DashboardWidget>
    );
    expect(screen.queryByText('real content')).not.toBeInTheDocument();
    rerender(
      <DashboardWidget title="My Queue" state="ready">
        <p>real content</p>
      </DashboardWidget>
    );
    expect(screen.getByText('real content')).toBeInTheDocument();
  });

  it('widgetState maps a query result to the four states', () => {
    const empty = (d: unknown) => Array.isArray(d) && d.length === 0;
    expect(widgetState({ isPending: true, isError: false, data: undefined }, empty)).toBe('loading');
    expect(widgetState({ isPending: false, isError: true, data: undefined }, empty)).toBe('error');
    expect(widgetState({ isPending: false, isError: false, data: [] }, empty)).toBe('empty');
    expect(widgetState({ isPending: false, isError: false, data: [1] }, empty)).toBe('ready');
  });
});
