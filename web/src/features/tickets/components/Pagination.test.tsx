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

  it('renders the range as one interpolated sentence, not reassembled fragments', () => {
    // Story 16 (WIS-17): "Showing … of …" is a single interpolated key so it
    // reads correctly in Arabic; the numerals are a digit run the bidi
    // algorithm keeps LTR on their own.
    const { container } = renderPagination(makeMeta());
    expect(container.querySelector('.tq-pagination-summary')?.textContent).toMatch(
      /Showing\s*1–10\s*of\s*132/
    );
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
    // The prev/next buttons bracket the numbered page buttons; identify them by
    // position so the assertion is locale-agnostic (their labels translate).
    const chevronPaths = (container: HTMLElement) => {
      const btns = container.querySelectorAll('.tq-pagination-controls > .tq-page-btn');
      return {
        prev: btns[0].querySelector('path')?.getAttribute('d'),
        next: btns[btns.length - 1].querySelector('path')?.getAttribute('d'),
      };
    };

    const ltr = renderPagination(makeMeta({ current_page: 5 }));
    expect(chevronPaths(ltr.container)).toEqual({ prev: PREV_LTR, next: NEXT_LTR });
    ltr.unmount();

    const rtl = renderPagination(makeMeta({ current_page: 5 }), { rtl: true });
    // The PATHS swap — a transform: scaleX(-1) would mirror the focus ring too.
    expect(chevronPaths(rtl.container)).toEqual({ prev: NEXT_LTR, next: PREV_LTR });
  });
});
