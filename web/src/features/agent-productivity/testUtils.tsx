import React from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { agentUser } from './testFixtures';

// Mirrors KbHarness (Story 09) — fresh QueryClient per render, signs a role
// in through the real AuthProvider so a test can assert what that role sees.
const SignedInAs: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children }) => {
  const { login, status } = useAuth();
  React.useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user } });
    login(user.email, 'Password123!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

export const ProductivityHarness: React.FC<{ user?: User; children: React.ReactNode }> = ({
  user = agentUser,
  children,
}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SignedInAs user={user}>{children}</SignedInAs>
      </AuthProvider>
    </QueryClientProvider>
  );
};
