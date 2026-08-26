import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth, type User } from '../../features/auth/AuthContext';
import { UiPreferencesProvider } from '../providers/UiPreferencesContext';
import { AppLayout } from './AppLayout';
import { api } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return {
    ...actual,
    api: { post: vi.fn() },
  };
});

const user: User = {
  id: 1,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
};

const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { login, status } = useAuth();
  useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user } });
    login(user.email, 'Password123!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

function renderShell() {
  return render(
    <UiPreferencesProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <SignedIn>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<div data-testid="page-placeholder">Dashboard</div>} />
                <Route path="/tickets" element={<div data-testid="page-placeholder">Tickets</div>} />
              </Route>
            </Routes>
          </SignedIn>
        </AuthProvider>
      </MemoryRouter>
    </UiPreferencesProvider>
  );
}

describe('AppLayout drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  it('opens and closes the drawer from the toggle', async () => {
    renderShell();
    await screen.findByTestId('page-placeholder');

    const toggle = screen.getByRole('button', { name: /Open navigation/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: /Main/i })).toHaveAttribute('data-open', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the drawer when a nav item is selected', async () => {
    renderShell();
    await screen.findByTestId('page-placeholder');

    fireEvent.click(screen.getByRole('button', { name: /Open navigation/i }));
    expect(screen.getByRole('navigation', { name: /Main/i })).toHaveAttribute('data-open', 'true');

    fireEvent.click(screen.getByRole('link', { name: /Tickets/i }));

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /Main/i })).toHaveAttribute('data-open', 'false');
    });
  });

  it('closes the drawer on a backdrop click', async () => {
    renderShell();
    await screen.findByTestId('page-placeholder');

    fireEvent.click(screen.getByRole('button', { name: /Open navigation/i }));
    expect(screen.getByRole('navigation', { name: /Main/i })).toHaveAttribute('data-open', 'true');

    // The backdrop has no accessible role — it's a plain overlay — so query
    // it by its class rather than by role.
    const backdrop = document.querySelector('.shell-drawer-backdrop');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /Main/i })).toHaveAttribute('data-open', 'false');
    });
  });

  it('closes the drawer on Escape and returns focus to the toggle', async () => {
    renderShell();
    await screen.findByTestId('page-placeholder');

    const toggle = screen.getByRole('button', { name: /Open navigation/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
    expect(toggle).toHaveFocus();
  });

  it('releases the body scroll lock on unmount', async () => {
    const { unmount } = renderShell();
    await screen.findByTestId('page-placeholder');

    fireEvent.click(screen.getByRole('button', { name: /Open navigation/i }));
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
