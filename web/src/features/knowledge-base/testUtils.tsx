import React from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { agentUser } from './testFixtures';

// The provider harness every Knowledge Base test renders through. Fixtures
// live in testFixtures.ts — this module exports only components, which is what
// the react-refresh lint rule wants of a .tsx.

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

/**
 * Wraps children in the providers every KB screen needs. `user` signs a role
 * in, so a test can assert what an Agent sees versus an editor.
 *
 * A FRESH QueryClient per render — a shared one would leak a cached article
 * from one test into the next.
 */
export const KbHarness: React.FC<{ user?: User; children: React.ReactNode }> = ({
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
