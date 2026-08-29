// TypeScript mirror of TicketTaskResource.

export type TaskStatus = 'open' | 'completed' | 'cancelled';
export type DueState = 'overdue' | 'due_soon' | 'upcoming' | 'none';

export type TaskUser = { id: number; name: string; initials: string };

export type TicketTask = {
  id: number;
  ticket_id: number;
  title: string;
  due_at: string | null;
  due_state: DueState;
  assignee: TaskUser | null;
  creator: TaskUser | null;
  status: TaskStatus;
  status_label: string;
  completed_by: TaskUser | null;
  completed_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};
