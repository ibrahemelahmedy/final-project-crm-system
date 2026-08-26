import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { RequireAuth } from './features/auth/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';

const DashboardStub: React.FC<{ title: string }> = ({ title }) => {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>{title}</h1>
      <p>
        Welcome back, <strong>{user?.name}</strong> ({user?.role_label})
      </p>
      <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
        <button
          onClick={() => logout()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#DC2626',
            color: '#FFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardStub title="Agent Dashboard" />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/team"
              element={
                <RequireAuth roles={['team_lead', 'administrator']}>
                  <DashboardStub title="Team Lead Dashboard" />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/admin"
              element={
                <RequireAuth roles={['administrator']}>
                  <DashboardStub title="Admin Dashboard" />
                </RequireAuth>
              }
            />
            <Route
              path="/tickets"
              element={
                <RequireAuth>
                  <DashboardStub title="Tickets List" />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
