import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/** A fresh QueryClient per render — a shared one leaks a cached count/list
 * from one test into the next. Polling is disabled so a test controls
 * exactly when a fetch happens. */
export const NotificationsHarness: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false, refetchOnWindowFocus: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};
