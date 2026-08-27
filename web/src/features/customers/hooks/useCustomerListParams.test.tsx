import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useCustomerListParams } from './useCustomerListParams';

const Probe: React.FC<{ onReady: (api: ReturnType<typeof useCustomerListParams>) => void }> = ({ onReady }) => {
  const api = useCustomerListParams();
  const location = useLocation();
  onReady(api);
  return <span data-testid="search">{location.search}</span>;
};

function renderHookIn(initialPath: string) {
  let latest: ReturnType<typeof useCustomerListParams> | null = null;
  const utils = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Probe onReady={(api) => (latest = api)} />
    </MemoryRouter>
  );
  return { ...utils, get api() { return latest!; } };
}

describe('useCustomerListParams', () => {
  it('does not write defaults into the URL', () => {
    const { getByTestId } = renderHookIn('/customers');
    expect(getByTestId('search').textContent).toBe('');
  });

  it('resets page to 1 when a filter changes', () => {
    const { api, getByTestId } = renderHookIn('/customers?page=3');
    act(() => api[1]({ company: ['Acme'] }));
    expect(getByTestId('search').textContent).not.toContain('page=3');
  });

  it('round-trips array filters as company[]', () => {
    const { api, getByTestId } = renderHookIn('/customers');
    act(() => api[1]({ company: ['Acme', 'Globex'] }));
    const search = getByTestId('search').textContent ?? '';
    expect(search).toContain('company%5B%5D=Acme');
    expect(search).toContain('company%5B%5D=Globex');
  });

  it('falls back to the default sort for an unknown sort key', () => {
    const { api } = renderHookIn('/customers?sort=password');
    expect(api[0].sort).toBe('name');
  });
});
