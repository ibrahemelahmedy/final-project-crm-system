import type { User } from '../auth/AuthContext';
import type { TicketQuickReply, QuickReply } from './model/quickReply';
import type { TicketTask } from './model/task';

export const agentUser: User = {
  id: 1,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
};

export function makeTicketQuickReply(overrides: Partial<TicketQuickReply> = {}): TicketQuickReply {
  return {
    id: 1,
    title: 'Refund processing timeline',
    category: 'Billing',
    body_template: 'Hi {{customer.first_name}}, refunds take 5-7 business days.',
    body_rendered: 'Hi Nadia, refunds take 5-7 business days.',
    ...overrides,
  };
}

export function makeQuickReply(overrides: Partial<QuickReply> = {}): QuickReply {
  return {
    id: 1,
    title: 'Password reset instructions',
    body: 'Hi {{customer.first_name}}, to reset your password…',
    preview: 'Hi {{customer.first_name}}, to reset your password…',
    category: 'account',
    status: 'active',
    status_label: 'Active',
    created_by: 'Sarah A.',
    updated_by: 'Sarah A.',
    created_at: '2026-08-20T00:00:00.000000Z',
    updated_at: '2026-08-20T00:00:00.000000Z',
    ...overrides,
  };
}

export function makeTask(overrides: Partial<TicketTask> = {}): TicketTask {
  return {
    id: 1,
    ticket_id: 4821,
    title: 'Call customer back',
    due_at: '2026-08-27T10:00:00.000000Z',
    due_state: 'upcoming',
    assignee: { id: 1, name: 'Sarah Ahmed', initials: 'SA' },
    creator: { id: 1, name: 'Sarah Ahmed', initials: 'SA' },
    status: 'open',
    status_label: 'Open',
    completed_by: null,
    completed_at: null,
    cancel_reason: null,
    created_at: '2026-08-20T00:00:00.000000Z',
    ...overrides,
  };
}
