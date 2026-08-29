import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'team_lead' | 'administrator';
  role_label: string;
  home_route: string;
  is_active: boolean;
  // Added by Story 08's UserResource. Optional here because Story 01's login
  // response is the same resource and older cached payloads may predate them.
  department?: string | null;
  initials?: string;
  last_login_at?: string | null;
  // Added by Story 15's UserResource — the persisted per-user language.
  locale?: 'en' | 'ar';
};

export type AuthContextType = {
  user: User | null;
  status: 'anonymous' | 'authenticated';
  /** Set when the session ended involuntarily — e.g. the account was deactivated. */
  sessionEndedReason: string | null;
  clearSessionEndedReason: () => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [sessionEndedReason, setSessionEndedReason] = useState<string | null>(null);

  const clearAuthState = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    queryClient.clear(); // Clear React Query cache to prevent cross-user data leakage
  }, []);

  // Story 08: deactivating a signed-in user revokes all their tokens, so their
  // next request 401s from whatever screen they are on. Clear the auth state
  // here and RequireAuth routes them to /login — the alternative is a
  // half-broken screen whose every request fails.
  useEffect(() => {
    setUnauthorizedHandler((message) => {
      clearAuthState();
      setSessionEndedReason(message ?? 'Your session has ended. Sign in again.');
    });

    return () => setUnauthorizedHandler(null);
  }, [clearAuthState]);

  const login = async (email: string, password: string): Promise<User> => {
    const response = await api.post('/login', { email, password });
    const { token, user: userData } = response.data;
    setAccessToken(token);
    setUser(userData);
    setSessionEndedReason(null);
    return userData;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/logout');
    } catch {
      // 401 or network error on logout is treated as success to avoid orphaned state
    } finally {
      clearAuthState();
      setSessionEndedReason(null);
    }
  };

  const status = user ? 'authenticated' : 'anonymous';

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        sessionEndedReason,
        clearSessionEndedReason: () => setSessionEndedReason(null),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
