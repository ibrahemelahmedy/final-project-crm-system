import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BulkConfirmDialog } from './BulkConfirmDialog';

const base = {
  action: 'Close',
  count: 3,
  references: ['#4821', '#4819', '#4815'],
  report: null,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('BulkConfirmDialog', () => {
  it('names the count and the action in the confirmation', () => {
    render(<BulkConfirmDialog {...base} />);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent('Close');
    expect(heading).toHaveTextContent('3');
    expect(heading).toHaveTextContent('tickets');
  });

  it('names the assignment target when assigning', () => {
    render(<BulkConfirmDialog {...base} action="Assign" target="Sarah Ahmed" tone="primary" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Assign 3 tickets to Sarah Ahmed?');
  });

  it('uses the singular noun for one ticket', () => {
    render(<BulkConfirmDialog {...base} count={1} references={['#4821']} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Close 1 ticket?');
  });

  it('lists the affected references and truncates past five', () => {
    render(
      <BulkConfirmDialog
        {...base}
        count={8}
        references={['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8']}
      />
    );
    expect(screen.getByText(/#1, #2, #3, #4, #5 and 3 more/)).toBeInTheDocument();
  });

  it('focuses Cancel rather than the destructive confirm', () => {
    render(<BulkConfirmDialog {...base} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('reports the skipped count after a partial success', () => {
    render(<BulkConfirmDialog {...base} report={{ applied: 2, skipped: 1 }} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Applied to 2 tickets.');
    expect(status).toHaveTextContent('1 skipped — you do not have permission to change them.');
  });

  it('does not claim a skip when every row applied', () => {
    render(<BulkConfirmDialog {...base} report={{ applied: 3, skipped: 0 }} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Applied to 3 tickets.');
    expect(status).not.toHaveTextContent('skipped');
  });
});
