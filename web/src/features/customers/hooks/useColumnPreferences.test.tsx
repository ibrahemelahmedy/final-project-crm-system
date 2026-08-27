import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useColumnPreferences } from './useColumnPreferences';
import type { ColumnDef } from '../../../components/data-table/types';

type Row = { id: number };

const columns: ColumnDef<Row>[] = [
  { id: 'name', header: 'NAME', width: '2fr', locked: true, cell: () => null },
  { id: 'email', header: 'EMAIL', width: '1fr', cell: () => null },
  { id: 'company', header: 'COMPANY', width: '1fr', cell: () => null },
];

const Probe: React.FC<{ userId: number; onReady: (api: ReturnType<typeof useColumnPreferences<Row>>) => void }> = ({
  userId,
  onReady,
}) => {
  const api = useColumnPreferences(userId, columns);
  onReady(api);
  return null;
};

function renderHook(userId = 1) {
  let latest: ReturnType<typeof useColumnPreferences<Row>> | null = null;
  render(<Probe userId={userId} onReady={(api) => (latest = api)} />);
  return { get api() { return latest!; } };
}

beforeEach(() => {
  localStorage.clear();
});

describe('useColumnPreferences', () => {
  it('persists a visibility toggle and reads it back', () => {
    const { api } = renderHook(1);
    act(() => api.toggleHidden('email'));
    expect(JSON.parse(localStorage.getItem('wisal-customers-columns:1')!).hidden).toContain('email');

    const { api: second } = renderHook(1);
    expect(second.hidden).toContain('email');
  });

  it('writes nothing to localStorage on mount', () => {
    renderHook(1);
    expect(localStorage.length).toBe(0);
  });

  it('drops an unknown column id and appends a new one', () => {
    localStorage.setItem(
      'wisal-customers-columns:1',
      JSON.stringify({ order: ['name', 'ghost', 'email'], hidden: [] })
    );
    const { api } = renderHook(1);
    expect(api.allColumns.map((c) => c.id)).toEqual(['name', 'email', 'company']);
  });

  it('survives a throwing localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const hook = renderHook(1);
    expect(() => act(() => hook.api.toggleHidden('email'))).not.toThrow();
    expect(hook.api.hidden).toContain('email'); // in-memory state still updates
    spy.mockRestore();
  });

  it('refuses to hide the locked column', () => {
    const hook = renderHook(1);
    act(() => hook.api.toggleHidden('name'));
    expect(hook.api.hidden).not.toContain('name');
  });
});
