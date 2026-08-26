import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { api, getAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return {
    ...actual,
    api: {
      post: vi.fn(),
    },
  };
});

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides login and logout functionality while managing in-memory token state', async () => {
    const mockUser = {
      id: 1,
      name: 'Sarah Ahmed',
      email: 'agent@wisal.test',
      role: 'agent' as const,
      role_label: 'Agent',
      home_route: '/dashboard',
      is_active: true,
    };

    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        token: 'test-token-123',
        user: mockUser,
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();

    // Perform login
    await act(async () => {
      await result.current.login('agent@wisal.test', 'Password123!');
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.user).toEqual(mockUser);
    expect(getAccessToken()).toBe('test-token-123');

    // The token must live in memory only — never in localStorage or
    // sessionStorage — see docs/decisions/ADR-004-authentication.md.
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    // Perform logout
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    const clearSpy = vi.spyOn(queryClient, 'clear');

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('clears local auth state even when POST /api/logout returns 401', async () => {
    // Login first
    const mockUser = {
      id: 2,
      name: 'Lead User',
      email: 'lead@wisal.test',
      role: 'team_lead' as const,
      role_label: 'Team Lead',
      home_route: '/dashboard/team',
      is_active: true,
    };

    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { token: 'stale-token', user: mockUser },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('lead@wisal.test', 'Password123!');
    });

    expect(result.current.status).toBe('authenticated');

    // Server returns 401 (token already expired or revoked) — must still clear local state
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { status: 401 },
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});
