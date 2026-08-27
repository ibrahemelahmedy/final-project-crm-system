import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UiPreferencesProvider } from '../../../app/providers/UiPreferencesContext';
import { Pagination } from './Pagination';
import type { Paginated, Ticket } from '../model/ticket';

function makeMeta(overrides: Partial<Paginated<Ticket>['meta']> = {}): Paginated<Ticket>['meta'] {
  return { current_page: 1, last_page: 14, per_page: 10, from: 1, to: 10, total: 132, ...overrides };
}

function renderPagination(
  meta: Paginated<Ticket>['meta'],
  { rtl = false }: { rtl?: boolean } = {}
) {
  // UiPreferencesContext derives direction from the saved language.
  if (rtl) localStorage.setItem('wisal-lang', 'ar');
  return render(
    <UiPreferencesProvider>
      <Pagination meta={meta} onPageChange={vi.fn()} />
    </UiPreferencesProvider>
  );
}

const PREV_LTR = 'M15 6l-6 6 6 6';
const NEXT_LTR = 'M9 6l6 6-6 6';

describe('Pagination', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = 'ltr';
  });

  it('renders the server-provided range and total', () => {
    // 1-10 of 132 comes from meta, never recomputed from data.length.
    const { container } = renderPagination(makeMeta());
    expect(container.querySelector('.tq-pagination-summary')?.textContent).toContain('1–10');
    expect(container.querySelector('.tq-pagination-summary')?.textContent).toContain('132');
  });

  it('wraps the numerals so they do not reverse under rtl', () => {
    const { container } = renderPagination(makeMeta());
    const ltrSpans = container.querySelectorAll('.tq-pagination-summary [dir="ltr"]');
    expect(ltrSpans.length).toBeGreaterThanOrEqual(2);
  });

  it('marks the current page with aria-current and leaves it enabled', () => {
    renderPagination(makeMeta({ current_page: 3, from: 21, to: 30 }));

    const current = screen.getByRole('button', { name: '3' });
    expect(current).toHaveAttribute('aria-current', 'page');
    // A disabled current page is unreachable by keyboard.
    expect(current).not.toBeDisabled();
  });

  it('disables previous on page one and next on the last page', () => {
    const first = renderPagination(makeMeta({ current_page: 1 }));
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
    first.unmount();

    renderPagination(makeMeta({ current_page: 14, from: 131, to: 132 }));
    expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('swaps the chevron paths under rtl', () => {
    const ltr = renderPagination(makeMeta({ current_page: 5 }));
    const prevLtr = screen
      .getByRole('button', { name: 'Previous page' })
      .querySelector('path')
      ?.getAttribute('d');
    const nextLtr = screen
      .getByRole('button', { name: 'Next page' })
      .querySelector('path')
      ?.getAttribute('d');

    expect(prevLtr).toBe(PREV_LTR);
    expect(nextLtr).toBe(NEXT_LTR);
    ltr.unmount();

    renderPagination(makeMeta({ current_page: 5 }), { rtl: true });
    const prevRtl = screen
      .getByRole('button', { name: 'Previous page' })
      .querySelector('path')
      ?.getAttribute('d');
    const nextRtl = screen
      .getByRole('button', { name: 'Next page' })
      .querySelector('path')
      ?.getAttribute('d');

    // The PATHS swap — a transform: scaleX(-1) would mirror the focus ring too.
    expect(prevRtl).toBe(NEXT_LTR);
    expect(nextRtl).toBe(PREV_LTR);
  });
});
