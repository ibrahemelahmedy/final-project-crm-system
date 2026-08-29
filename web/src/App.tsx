import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './features/auth/AuthContext';
import { RequireAuth } from './features/auth/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { UiPreferencesProvider } from './app/providers/UiPreferencesContext';
import { I18nextProvider, i18n } from './i18n';
import { LocaleSync } from './app/providers/LocaleSync';
import { AppLayout } from './app/layouts/AppLayout';
import { PagePlaceholder } from './app/components/PagePlaceholder';
import { CustomersPage, CustomerProfilePage } from './features/customers';
import { TicketQueuePage, TicketDetailPage } from './features/tickets';
import {
  AgentDashboardPage,
  TeamDashboardPage,
  AdminDashboardPage,
} from './features/agent-dashboard';
import {
  KnowledgeBaseIndexPage,
  ArticleReaderPage,
  ArticleEditorPage,
} from './features/knowledge-base';
import { UsersPage, AuditLogPage, SystemSettingsPage } from './features/users-roles-admin';
import { ReportsPage } from './features/reports';
import { ChannelsPage } from './features/channels';
import { NotificationsPage } from './features/notifications';
import { CsatResponsePage } from './features/csat';
import { QuickRepliesPage } from './features/agent-productivity';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <AuthProvider>
            <LocaleSync />
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Story 13. The public CSAT feedback page — OUTSIDE RequireAuth
                  and AppLayout, and declared before the `*` catch-all so it is
                  never redirected to /dashboard. Authenticates into nothing;
                  access is the signed link in the query string. */}
              <Route path="/feedback/:uuid" element={<CsatResponsePage />} />

              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<AgentDashboardPage />} />
                <Route
                  path="/dashboard/team"
                  element={
                    <RequireAuth roles={['team_lead', 'administrator']}>
                      <TeamDashboardPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/admin"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <AdminDashboardPage />
                    </RequireAuth>
                  }
                />
                <Route path="/tickets" element={<TicketQueuePage />} />
                <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:customerId" element={<CustomerProfilePage />} />
                {/* Story 09. /new and /:slug/edit are declared BEFORE
                    /:slug, or the dynamic segment swallows "new". The role
                    guard here is UX only — KbArticlePolicy is the boundary. */}
                <Route path="/knowledge-base" element={<KnowledgeBaseIndexPage />} />
                <Route
                  path="/knowledge-base/new"
                  element={
                    <RequireAuth roles={['team_lead', 'administrator']}>
                      <ArticleEditorPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/knowledge-base/:slug/edit"
                  element={
                    <RequireAuth roles={['team_lead', 'administrator']}>
                      <ArticleEditorPage />
                    </RequireAuth>
                  }
                />
                <Route path="/knowledge-base/:slug" element={<ArticleReaderPage />} />
                {/* Story 11. Reached through the header bell panel's "View
                    all notifications" link, not the sidebar — no navItems.tsx
                    change. No role restriction: every authenticated user has
                    their own notifications. */}
                <Route path="/notifications" element={<NotificationsPage />} />
                {/* Story 14. Replaces the Story 02 placeholder — the nav
                    manifest entry is unchanged. Read-only for every role. */}
                <Route path="/channels" element={<ChannelsPage />} />
                {/* Story 12. Guard is UX only — the API returns 403 for an Agent. */}
                <Route
                  path="/reports"
                  element={
                    <RequireAuth roles={['team_lead', 'administrator']}>
                      <ReportsPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/sla-rules"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <PagePlaceholder titleKey="common:nav.slaRules" />
                    </RequireAuth>
                  }
                />
                {/* Story 10. Read is open to every authenticated user server-side
                    (QuickReplyPolicy); this role guard is UX only, matching the
                    /sla-rules and /users pattern — the write actions inside the
                    page still 403 for anyone but a Team Lead/Administrator if this
                    guard were ever bypassed. */}
                <Route
                  path="/quick-replies"
                  element={
                    <RequireAuth roles={['team_lead', 'administrator']}>
                      <QuickRepliesPage />
                    </RequireAuth>
                  }
                />
                {/*
                  Story 08. The route tree and the administrator guard are
                  Story 02's; swapping this element and adding the two siblings
                  inside the SAME guard is the sanctioned replacement.
                */}
                <Route
                  path="/users"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <UsersPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/users/audit-log"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <AuditLogPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/users/settings"
                  element={
                    <RequireAuth roles={['administrator']}>
                      <SystemSettingsPage />
                    </RequireAuth>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </BrowserRouter>
        </I18nextProvider>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}
