import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { PeriodSelector } from './PeriodSelector';

function Harness() {
  const [params] = useSearchParams();
  return (
    <>
      <PeriodSelector />
      <output data-testid="period">{params.get('period') ?? '(none)'}</output>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>
  );
}

describe('PeriodSelector', () => {
  it('writes the chosen period to the URL search param', async () => {
    renderAt('/channels');
    await userEvent.click(screen.getByRole('button', { name: 'Last 90 days' }));
    expect(screen.getByTestId('period')).toHaveTextContent('90d');
  });

  it('preselects the period from ?period= on load', () => {
    renderAt('/channels?period=90d');
    expect(screen.getByRole('button', { name: 'Last 90 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('falls back to 30d for an unrecognised param without issuing a request', () => {
    renderAt('/channels?period=nonsense');
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
