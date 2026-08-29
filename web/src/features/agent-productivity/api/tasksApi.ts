import { api } from '../../../lib/api';
import type { TicketTask } from '../model/task';
import type { TaskFormValues } from '../model/taskSchema';

export async function fetchTicketTasks(ticketId: number) {
  const { data } = await api.get<{ data: TicketTask[] }>(`/tickets/${ticketId}/tasks`);
  return data.data;
}

export async function createTicketTask(ticketId: number, values: TaskFormValues) {
  const { data } = await api.post<{ data: TicketTask }>(`/tickets/${ticketId}/tasks`, values);
  return data.data;
}

export async function updateTask(taskId: number, values: Partial<TaskFormValues>) {
  const { data } = await api.patch<{ data: TicketTask }>(`/tasks/${taskId}`, values);
  return data.data;
}

export async function completeTask(taskId: number) {
  const { data } = await api.post<{ data: TicketTask }>(`/tasks/${taskId}/complete`);
  return data.data;
}

/** `GET /api/tasks?assignee=me&status=open` — the contract Story 07 consumes too. */
export async function fetchMyOpenTasks() {
  const { data } = await api.get<{ data: TicketTask[] }>('/tasks', {
    params: { assignee: 'me', status: 'open' },
  });
  return data.data;
}
