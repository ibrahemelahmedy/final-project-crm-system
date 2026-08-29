import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChartFrame } from './ChartFrame';
import { ReportCard } from './ReportCard';

/**
 * The RTL decision is enforced by ChartFrame, not by trusting Recharts:
 * the plot wrapper carries dir="ltr" in BOTH document directions, while the
 * card heading follows the document direction.
 */
describe('ChartFrame', () => {
  it.each(['ltr', 'rtl'] as const)('keeps the plot area LTR while the page is %s', (dir) => {
    render(
      <div dir={dir}>
        <ReportCard title="Ticket Volume Over Time" available emptyMessage="">
          <ChartFrame label="plot">
            <div>chart</div>
          </ChartFrame>
        </ReportCard>
      </div>
    );

    const frame = screen.getByRole('img', { name: 'plot' });
    expect(frame).toHaveAttribute('dir', 'ltr');

    // The heading does not force a direction — it inherits the document's.
    const heading = screen.getByRole('heading', { name: 'Ticket Volume Over Time' });
    expect(heading).not.toHaveAttribute('dir');
  });
});
