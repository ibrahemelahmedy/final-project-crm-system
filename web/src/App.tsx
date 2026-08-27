import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './features/auth/AuthContext';
import { RequireAuth } from './features/auth/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { UiPreferencesProvider } from './app/providers/UiPreferencesContext';
import { AppLayout } from './app/layouts/AppLayout';
import { PagePlaceholder } from './app/components/PagePlaceholder';
import { CustomersPage, CustomerProfilePage } from './features/customers';
import { TicketQueuePage } from './features/tickets';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<PagePlaceholder title="Dashboard" />} />
                <Route
                  path="/dashboard/team"
                  element={
                    <RequireAuth roles={['team_lead', 'administrator']}>
                      <PagePlaceholder title="Team Dashboard" />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/admin"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <PagePlaceholder title="Admin Dashboard" />
                    </RequireAuth>
                  }
                />
                <Route path="/tickets" element={<TicketQueuePage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:customerId" element={<CustomerProfilePage />} />
                <Route path="/knowledge-base" element={<PagePlaceholder title="Knowledge Base" />} />
                <Route path="/channels" element={<PagePlaceholder title="Channels" />} />
                <Route path="/reports" element={<PagePlaceholder title="Reports" />} />
                <Route
                  path="/sla-rules"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <PagePlaceholder title="SLA Rules" />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <PagePlaceholder title="Users" />
                    </RequireAuth>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </BrowserRouter>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}
