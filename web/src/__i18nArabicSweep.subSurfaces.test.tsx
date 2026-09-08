import React from 'react';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from './i18n/instance';
import { AuthProvider, useAuth, type User } from './features/auth/AuthContext';
import { api } from './lib/api';
import { CustomerProfilePage } from './features/customers/pages/CustomerProfilePage';
import * as customersApi from './features/customers/api/customersApi';
import type { Customer } from './features/customers/model/customer';
import { AuditLogPage } from './features/users-roles-admin/pages/AuditLogPage';
import { SystemSettingsPage } from './features/users-roles-admin/pages/SystemSettingsPage';
import * as adminApi from './features/users-roles-admin/api/adminApi';
import { QuickRepliesPage } from './features/agent-productivity/pages/QuickRepliesPage';
import { ProductivityHarness } from './features/agent-productivity/testUtils';
import * as quickRepliesApi from './features/agent-productivity/api/quickRepliesApi';
import { TicketTasksPanel } from './features/agent-productivity/components/TicketTasksPanel';
import * as tasksApi from './features/agent-productivity/api/tasksApi';
import * as mentionsApi from './features/agent-productivity/api/mentionsApi';

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual('./lib/api');
  return { ...actual, api: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } };
});
vi.mock('./features/customers/api/customersApi');
vi.mock('./features/users-roles-admin/api/adminApi');
vi.mock('./features/agent-productivity/api/quickRepliesApi');
vi.mock('./features/agent-productivity/api/tasksApi');
vi.mock('./features/agent-productivity/api/mentionsApi');

afterEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

function sweep(body: string, chrome: string[]) {
  const hits = chrome.filter((s) => body.includes(s));
  expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
}

describe('CustomerProfilePage (+ AttachmentsPanel, NotesPanel, InteractionHistory) — Arabic sweep', () => {
  const customer: Customer = {
    id: 1, name: 'Amelia Chen', email: 'amelia.chen@northwind.io', phone: null,
    company: 'Northwind Retail', tier: 'enterprise', tier_label: 'Enterprise',
    initials: 'AC', open_tickets_count: 0, last_contact_at: null,
    created_at: '2023-03-14T00:00:00.000000Z', updated_at: '2023-03-14T00:00:00.000000Z',
  };
  const agentUser: User = {
    id: 1, name: 'Sarah Ahmed', email: 'agent@wisal.test', role: 'agent',
    role_label: 'Agent', home_route: '/dashboard', is_active: true,
  };
  const SignedInAs: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { login, status } = useAuth();
    React.useEffect(() => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user: agentUser } });
      login(agentUser.email, 'Password123!');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (status !== 'authenticated') return null;
    return <>{children}</>;
  };

  it('renders no English chrome under ar (empty notes/attachments/tickets)', async () => {
    await i18n.changeLanguage('ar');
    (customersApi.getCustomer as ReturnType<typeof vi.fn>).mockResolvedValue(customer);
    (customersApi.listAttachments as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
    (customersApi.listNotes as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
    (customersApi.listCustomerTickets as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/customers/1']}>
          <AuthProvider>
            <SignedInAs>
              <Routes>
                <Route path="/customers/:customerId" element={<CustomerProfilePage />} />
              </Routes>
            </SignedInAs>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    sweep(document.body.textContent ?? '', [
      'Interaction history', 'No tickets yet.', 'Contact details', 'Email', 'Phone', 'Company',
      'Notes', 'Add a note', 'No notes yet.', 'Attachments', 'Drag files here', 'No attachments yet.',
      'Edit', 'Back to customers',
    ]);
  });

  it('opens the edit modal — no English chrome under ar', async () => {
    await i18n.changeLanguage('ar');
    (customersApi.getCustomer as ReturnType<typeof vi.fn>).mockResolvedValue(customer);
    (customersApi.listAttachments as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
    (customersApi.listNotes as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });
    (customersApi.listCustomerTickets as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/customers/1']}>
          <AuthProvider>
            <SignedInAs>
              <Routes>
                <Route path="/customers/:customerId" element={<CustomerProfilePage />} />
              </Routes>
            </SignedInAs>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect(document.querySelector('.dt-btn-primary')).toBeTruthy());
    const editBtn = document.querySelector('.dt-btn-primary') as HTMLElement;
    fireEvent.click(editBtn);
    await waitFor(() => expect(document.querySelector('.modal-card')).toBeTruthy());
    // The tier RADIO OPTIONS (chrome, translated) are asserted directly by
    // selector rather than via the body-text sweep, because the server's
    // `tier_label` echo ("Enterprise") legitimately renders in English
    // elsewhere on the same page (Decision 2: server labels are data, not
    // client chrome) and would collide with the chrome string "Enterprise".
    const tierOption = document.querySelector('.tier-option-enterprise') as HTMLElement;
    expect(tierOption.textContent).not.toContain('Enterprise');
    expect(tierOption.textContent?.trim()).toBe('مؤسسي');
    sweep(document.body.textContent ?? '', [
      'Edit Customer', 'Add Customer', 'Name', 'Email', 'Company', 'Phone', 'Tier',
      'Customer since', 'Delete Customer', 'Cancel', 'Save Changes', 'Standard', 'Premium',
    ]);
  });
});

describe('AuditLogPage — Arabic sweep', () => {
  it('renders no English chrome under ar (empty)', async () => {
    await i18n.changeLanguage('ar');
    (adminApi.listAuditLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } });
    (adminApi.getAuditLogFacets as ReturnType<typeof vi.fn>).mockResolvedValue({ events: [], actors: [], total: 0 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    sweep(document.body.textContent ?? '', [
      'Audit Log', 'Every sensitive action', 'Back to Users', 'Actor', 'Action', 'From', 'To',
      'Clear filters', 'No entries match these filters', 'No audit entries yet', 'Anyone',
    ]);
  });
});

describe('SystemSettingsPage — Arabic sweep', () => {
  it('renders no English chrome under ar (empty)', async () => {
    await i18n.changeLanguage('ar');
    (adminApi.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SystemSettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    sweep(document.body.textContent ?? '', [
      'System Settings', 'Every change is validated', 'Back to Users', 'No configurable settings.',
    ]);
  });
});

describe('Quick Reply edit modal — Arabic sweep', () => {
  it('opens New quick reply — no English chrome under ar', async () => {
    await i18n.changeLanguage('ar');
    (quickRepliesApi.fetchQuickReplies as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [], meta: { current_page: 1, last_page: 1, per_page: 10, from: null, to: null, total: 0 },
      links: { first: null, last: null, prev: null, next: null },
    });
    render(
      <MemoryRouter initialEntries={['/quick-replies']}>
        <ProductivityHarness>
          <QuickRepliesPage />
        </ProductivityHarness>
      </MemoryRouter>
    );
    const newBtn = await screen.findByRole('button', { name: /رد سريع جديد|New quick reply/ });
    fireEvent.click(newBtn);
    await waitFor(() => expect(document.querySelector('.modal-card')).toBeTruthy());
    sweep(document.body.textContent ?? '', [
      'New quick reply', 'Edit quick reply', 'Title', 'Category', 'Body', 'AVAILABLE PLACEHOLDERS',
      'Cancel', 'Save changes', 'Billing', 'Account', 'Technical', 'General',
    ]);
  });
});

describe('TicketTasksPanel (+ AddTaskForm) — Arabic sweep', () => {
  it('renders empty state and the add-task form with no English chrome under ar', async () => {
    await i18n.changeLanguage('ar');
    (tasksApi.fetchTicketTasks as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (mentionsApi.fetchMentionableUsers as ReturnType<typeof vi.fn>)?.mockResolvedValue?.([]);
    render(
      <ProductivityHarness>
        <TicketTasksPanel ticketId={1} />
      </ProductivityHarness>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(10));
    const addBtn = document.querySelector('.tasks-panel-head button') as HTMLElement;
    fireEvent.click(addBtn);
    await waitFor(() => expect(document.querySelector('.add-task-form')).toBeTruthy());
    sweep(document.body.textContent ?? '', [
      'TASKS', 'Add task', 'No tasks yet', 'Add a task to track', 'New task', 'Task',
      'Due date & time', 'Assignee', 'Cancel', 'Save task',
    ]);
  });
});
