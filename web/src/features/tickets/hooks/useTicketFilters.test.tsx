import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useTicketFilters } from './useTicketFilters';

type Api = ReturnType<typeof useTicketFilters>;

/**
 * The hook's API is exposed through a ref the test writes to inside an effect,
 * rather than assigning a module-level variable during render — a render-time
 * side effect is exactly what this hook is meant to avoid.
 */
const held: { current: Api | null } = { current: null };

function Probe() {
  const api = useTicketFilters();
  const location = useLocation();

  useEffect(() => {
    held.current = api;
  });

  return (
    <div>
      <span data-testid="search">{location.search}</span>
      <span data-testid="filters">{JSON.stringify(api.filters)}</span>
      <span data-testid="active">{api.activeCount}</span>
    </div>
  );
}

const api = () => held.current as Api;

function renderAt(path: string) {
  held.current = null;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>
  );
}

const filters = () => JSON.parse(screen.getByTestId('filters').textContent as string);
const search = () => screen.getByTestId('search').textContent as string;

describe('useTicketFilters', () => {
  it('reads the initial filters from the URL', () => {
    renderAt('/tickets?priority=high&priority=urgent&status=open&q=login&page=2');

    expect(filters().priority).toEqual(['high', 'urgent']);
    expect(filters().status).toEqual(['open']);
    expect(filters().q).toBe('login');
    expect(filters().page).toBe(2);
  });

  it('does not write defaults into the URL', () => {
    renderAt('/tickets');
    expect(search()).toBe('');
  });

  it('writes a facet change back to the URL', () => {
    renderAt('/tickets');

    act(() => api().setFilters({ priority: ['high', 'urgent'] }));

    expect(search()).toBe('?priority=high&priority=urgent');
    expect(filters().priority).toEqual(['high', 'urgent']);
  });

  it('resets the page to 1 when a facet changes', () => {
    renderAt('/tickets?page=5');
    expect(filters().page).toBe(5);

    act(() => api().setFilters({ status: ['open'] }));

    expect(filters().page).toBe(1);
    expect(search()).not.toContain('page=');
  });

  it('keeps the page when the pagination control asks it to', () => {
    renderAt('/tickets?status=open');

    act(() => api().setFilters({ page: 3 }, { keepPage: true }));

    expect(filters().page).toBe(3);
    expect(filters().status).toEqual(['open']);
  });

  it('survives a remount with the same URL', () => {
    const url = '/tickets?priority=high&status=open&q=vpn&per_page=50';
    const first = renderAt(url);
    const before = filters();
    first.unmount();

    renderAt(url);
    expect(filters()).toEqual(before);
  });

  it('clears every facet but keeps per_page on clearFilters', () => {
    renderAt('/tickets?priority=high&status=open&q=vpn&per_page=50');

    act(() => api().clearFilters());

    expect(filters().priority).toEqual([]);
    expect(filters().status).toEqual([]);
    expect(filters().q).toBe('');
    expect(filters().per_page).toBe(50);
    expect(search()).toBe('?per_page=50');
  });

  it('counts active facets for the empty state', () => {
    renderAt('/tickets?priority=high&q=vpn');
    expect(screen.getByTestId('active').textContent).toBe('2');
  });
});
