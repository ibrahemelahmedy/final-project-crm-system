import { api } from '../../../lib/api';
import type {
  BulkResult,
  Paginated,
  Ticket,
  TicketEvent,
  TicketMeta,
  TicketStatus,
} from '../model/ticket';
import type { TicketFilters } from '../model/ticketFilters';
import { DEFAULT_FILTERS } from '../model/ticketFilters';
import type { NewTicketValues } from '../model/newTicketSchema';

/**
 * Turns the filter object into Laravel-friendly params. Empty arrays, an empty
 * `q`, and default page/per_page are omitted entirely — a URL full of
 * `?status[]=&page=1` is noise, not a shareable view.
 */
export function toQuery(filters: TicketFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  if (filters.status.length) params.status = filters.status;
  if (filters.priority.length) params.priority = filters.priority;
  if (filters.channel.length) params.channel = filters.channel;
  if (filters.category.length) params.category = filters.category;
  if (filters.assigned_to.length) params.assigned_to = filters.assigned_to;

  const q = filters.q.trim();
  if (q) params.q = q;

  if (filters.sort !== DEFAULT_FILTERS.sort) params.sort = filters.sort;
  if (filters.page !== DEFAULT_FILTERS.page) params.page = filters.page;
  if (filters.per_page !== DEFAULT_FILTERS.per_page) params.per_page = filters.per_page;

  return params;
}

/**
 * `indexes: null` is required. Axios 1.19's default emits `status[0]=open`,
 * which Laravel's $request->array('status') reads as a keyed map rather than a
 * list.
 */
const LIST_SERIALIZER = { indexes: null } as const;

export async function fetchTickets(filters: TicketFilters): Promise<Paginated<Ticket>> {
  const { data } = await api.get('/tickets', {
    params: toQuery(filters),
    paramsSerializer: LIST_SERIALIZER,
  });
  return data;
}

export async function fetchTicket(id: number): Promise<Ticket> {
  const { data } = await api.get(`/tickets/${id}`);
  return data.data;
}

export async function fetchTicketMeta(): Promise<TicketMeta> {
  const { data } = await api.get('/tickets/meta');
  return data;
}

export async function createTicket(values: NewTicketValues): Promise<Ticket> {
  const { data } = await api.post('/tickets', values);
  return data.data;
}

export async function updateTicket(
  id: number,
  patch: Partial<{ status: TicketStatus; priority: string; category: string; assigned_to: number | null }>
): Promise<Ticket> {
  const { data } = await api.patch(`/tickets/${id}`, patch);
  return data.data;
}

export type BulkPayload = {
  ids: number[];
  action: 'assign' | 'status';
  assigned_to?: number | null;
  status?: TicketStatus;
};

export async function bulkTickets(payload: BulkPayload): Promise<BulkResult> {
  const { data } = await api.post('/tickets/bulk', payload);
  return data;
}

export async function fetchTicketEvents(id: number): Promise<{ data: TicketEvent[] }> {
  const { data } = await api.get(`/tickets/${id}/events`);
  return data;
}
