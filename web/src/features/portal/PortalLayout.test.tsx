import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { PortalLayout } from './PortalLayout';
import { renderPortal } from './testUtils';
import { api } from '../../lib/api';

/**
 * AC8 — the portal renders inside its OWN minimal chrome: wordmark + language
 * and theme toggles, and nothing from the staff App Shell. AC9 — the toggle
 * flips direction without a `/user/preferences` PATCH.
 */
describe('PortalLayout', () => {
  const patchSpy = vi.spyOn(api, 'patch');

  beforeEach(() => {
    patchSpy.mockClear();
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    document.documentElement.dir = 'ltr';
  });

  afterEach(() => {
    document.documentElement.dir = 'ltr';
  });

  const renderLayout = () =>
    renderPortal(
      <Routes>
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<div data-testid="child" />} />
        </Route>
      </Routes>,
      { route: '/portal' }
    );

  it('shows the wordmark and exactly two header controls', () => {
    renderLayout();
    expect(screen.getByText('Wisal')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('has no App Shell chrome — no search, bell, avatar, or nav links', () => {
    renderLayout();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/staff/i)).not.toBeInTheDocument();
  });

  it('renders its routed child through the Outlet', () => {
    renderLayout();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('flips to RTL via the language toggle and issues no /user/preferences PATCH', async () => {
    const user = userEvent.setup();
    const { container } = renderLayout();

    const langButton = screen.getAllByRole('button')[0];
    await user.click(langButton);

    expect(container.querySelector('.portal-root')).toHaveAttribute('dir', 'rtl');
    expect(patchSpy).not.toHaveBeenCalled();
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('wisal-lang');
    } catch {
      /* ignore */
    }
    expect(stored).toBe('ar');
  });

  it('keeps the digit toggles left-to-right inside an RTL page', () => {
    const { container } = renderLayout();
    expect(container.querySelector('.portal-header-toggles')).toHaveAttribute('dir', 'ltr');
  });
});
