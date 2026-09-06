import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, i18n } from '../../i18n';
import { UiPreferencesProvider } from '../../app/providers/UiPreferencesContext';
import type { PortalMessage, PortalPaginated, PortalTicket } from './model/portal';

/**
 * Story 17 (WIS-16). Shared render harness and fixtures for the portal tests.
 * Test-only: never imported by the app, and excluded from the i18n literal
 * check by name (`testUtils.tsx`).
 */

export function renderPortal(
  ui: ReactNode,
  { path, route, dir }: { path?: string; route?: string; dir?: 'ltr' | 'rtl' } = {}
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  if (dir) document.documentElement.dir = dir;

  return render(
    <QueryClientProvider client={client}>
      <UiPreferencesProvider>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={[route ?? path ?? '/portal']}>
            {path ? (
              <Routes>
                <Route path={path} element={ui} />
                <Route path="*" element={<div data-testid="elsewhere" />} />
              </Routes>
            ) : (
              ui
            )}
          </MemoryRouter>
        </I18nextProvider>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}

export function ticket(overrides: Partial<PortalTicket> = {}): PortalTicket {
  return {
    id: 42,
    subject: 'Payment not going through',
    status: 'open',
    status_label: 'Open',
    category: 'billing',
    category_label: 'Billing',
    channel: 'web_form',
    channel_label: 'Web form',
    created_at: '2026-08-01T09:00:00Z',
    last_activity_at: '2026-08-02T09:00:00Z',
    resolved_at: null,
    closed_at: null,
    message_count: 2,
    feedback_url: null,
    ...overrides,
  };
}

export function message(overrides: Partial<PortalMessage> = {}): PortalMessage {
  return {
    id: 1,
    author_type: 'customer',
    author_name: 'Dana Ruiz',
    body: 'My card keeps getting declined.',
    created_at: '2026-08-01T09:00:00Z',
    ...overrides,
  };
}

export function page<T>(data: T[], overrides: Partial<PortalPaginated<T>['meta']> = {}): PortalPaginated<T> {
  return {
    data,
    meta: { current_page: 1, last_page: 1, total: data.length, per_page: 20, ...overrides },
  };
}

/** A promise that never settles — the "still loading" state. */
export const pending = <T,>(): Promise<T> => new Promise<T>(() => {});
