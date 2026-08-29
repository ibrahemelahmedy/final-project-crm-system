import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditLogPage } from './AuditLogPage';
import * as adminApi from '../api/adminApi';
import type { AuditLogEntry, AuditLogFacets, Paginated } from '../model/adminUser';

vi.mock('../api/adminApi');

const makeEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 1,
  event: 'user.deactivated',
  event_label: 'User deactivated',
  actor: { id: 99, name: 'System Admin', email: 'admin@wisal.test' },
  target: { type: 'user', id: 7, label: 'Tom Becker' },
  ip_address: '127.0.0.1',
  context: { target_type: 'user', target_id: 7, target_label: 'Tom Becker' },
  created_at: '2026-08-28T10:15:00.000000Z',
  ...overrides,
});

const facets: AuditLogFacets = {
  events: [
    { value: 'user.created', label: 'User created', count: 4 },
    { value: 'user.deactivated', label: 'User deactivated', count: 2 },
    { value: 'setting.changed', label: 'Setting changed', count: 1 },
  ],
  actors: [
    { value: 99, label: 'System Admin', email: 'admin@wisal.test' },
    { value: 42, label: 'Kenji Matsuda', email: 'kenji.m@wisal.io' },
  ],
  total: 7,
};

function makePage(
  data: AuditLogEntry[],
  overrides: Partial<Paginated<AuditLogEntry>['meta']> = {}
): Paginated<AuditLogEntry> {
  return {
    data,
    meta: { current_page: 1, last_page: 1, per_page: 25, total: data.length, ...overrides },
  };
}

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
};

function renderPage(initialEntries: string[] = ['/users/audit-log']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path="/users/audit-log"
            element={
              <>
                <AuditLogPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.getAuditLogFacets).mockResolvedValue(facets);
});

describe('AuditLogPage', () => {
  it('renders actor, action, target, and timestamp for each entry', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(makePage([makeEntry()]));

    renderPage();

    await screen.findByText('System Admin');
    expect(screen.getByText('User deactivated')).toBeInTheDocument();
    expect(screen.getByText('Tom Becker')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
    // A real formatted timestamp, not a raw ISO string.
    expect(screen.queryByText('2026-08-28T10:15:00.000000Z')).not.toBeInTheDocument();
  });

  it('presents NO edit or delete control anywhere on the page', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(
      makePage([makeEntry(), makeEntry({ id: 2, event: 'user.created', event_label: 'User created' })])
    );

    renderPage();

    await screen.findByText('User deactivated');

    // No control of any kind offering to change or remove an entry — the log
    // is append-only, and the UI must not imply otherwise.
    for (const pattern of [/edit/i, /delete/i, /remove/i, /save/i, /update/i, /revert/i, /undo/i]) {
      expect(screen.queryByRole('button', { name: pattern })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: pattern })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: pattern })).not.toBeInTheDocument();
    }

    // Nor any editable field bound to an entry.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
    // The only form controls present are the filters (chips + the two dates).
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('maps the actor filter to a URL param', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(makePage([makeEntry()]));

    renderPage();

    await screen.findByText('User deactivated');

    fireEvent.click(screen.getByRole('button', { name: /^Actor:/ }));
    const listbox = screen.getByRole('listbox', { name: 'Actor' });
    fireEvent.click(within(listbox).getByLabelText('Kenji Matsuda'));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('actor_id=42'));
  });

  it('maps the action filter to a URL param', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(makePage([makeEntry()]));

    renderPage();

    await screen.findByText('User deactivated');

    fireEvent.click(screen.getByRole('button', { name: /^Action:/ }));
    const listbox = screen.getByRole('listbox', { name: 'Action' });
    fireEvent.click(within(listbox).getByLabelText(/Setting changed/));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toContain('event%5B%5D=setting.changed')
    );
  });

  it('maps the date range to URL params', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(makePage([makeEntry()]));

    renderPage();

    await screen.findByText('User deactivated');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('from=2026-08-01'));

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-28' } });
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('to=2026-08-28'));
  });

  it('reads every filter back out of the URL on a fresh mount', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(makePage([makeEntry()]));

    renderPage(['/users/audit-log?actor_id=42&event[]=user.created&from=2026-08-01&to=2026-08-28&page=2']);

    await screen.findByText('User deactivated');

    expect(vi.mocked(adminApi.listAuditLogs)).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: 42,
        event: ['user.created'],
        from: '2026-08-01',
        to: '2026-08-28',
        page: 2,
      })
    );
  });

  it('renders the Empty state for a filter combination with no matches', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(makePage([]));

    renderPage(['/users/audit-log?actor_id=42&event[]=setting.changed']);

    await screen.findByText('No entries match these filters');
    // Two exist while filtered — the toolbar's and the Empty state's.
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(2);
  });

  it('renders the unfiltered Empty state distinctly', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(makePage([]));

    renderPage();

    await screen.findByText('No audit entries yet');
  });

  it('renders the Loading and Error states', async () => {
    vi.mocked(adminApi.listAuditLogs).mockReturnValue(new Promise(() => {}));
    const { container, unmount } = renderPage();
    await waitFor(() => expect(container.querySelector('.sk')).toBeTruthy());
    unmount();

    vi.mocked(adminApi.listAuditLogs).mockRejectedValue(new Error('boom'));
    renderPage();
    await screen.findByRole('button', { name: /retry|try again/i });
  });

  it('paginates server-side from the response meta', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(
      makePage([makeEntry()], { current_page: 2, last_page: 5, per_page: 25, total: 120 })
    );

    renderPage(['/users/audit-log?page=2']);

    await screen.findByText('User deactivated');

    const summary = document.querySelector('.dt-pagination-summary');
    expect(summary?.textContent?.replace(/\s+/g, ' ')).toContain('Showing 26–50 of 120');
  });

  it('renders the retained email as the actor when the actor no longer exists', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(
      makePage([
        makeEntry({
          actor: { id: null, name: 'ghost@wisal.io', email: 'ghost@wisal.io' },
        }),
      ])
    );

    renderPage();

    await screen.findByText('ghost@wisal.io');
    expect(screen.getByText('(no longer a user)')).toBeInTheDocument();
  });

  it('renders an em dash for an entry with no target', async () => {
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(
      makePage([
        makeEntry({
          event: 'login.failed',
          event_label: 'Failed sign-in',
          target: { type: null, id: null, label: null },
        }),
      ])
    );

    renderPage();

    await screen.findByText('Failed sign-in');
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
