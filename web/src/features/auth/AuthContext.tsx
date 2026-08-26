import React, { createContext, useContext, useState } from 'react';
import { api, setAccessToken } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'team_lead' | 'administrator';
  role_label: string;
  home_route: string;
  is_active: boolean;
};

export type AuthContextType = {
  user: User | null;
  status: 'anonymous' | 'authenticated';
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string): Promise<User> => {
    const response = await api.post('/login', { email, password });
    const { token, user: userData } = response.data;
    setAccessToken(token);
    setUser(userData);
    return userData;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/logout');
    } catch {
      // 401 or network error on logout is treated as success to avoid orphaned state
    } finally {
      setAccessToken(null);
      setUser(null);
      queryClient.clear(); // Clear React Query cache to prevent cross-user data leakage
    }
  };

  const status = user ? 'authenticated' : 'anonymous';

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
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
