import { api } from '../../../lib/api';
import type { Paginated } from '../model/paginated';
import type { QuickReply, TicketQuickReply } from '../model/quickReply';
import type { QuickReplyFormValues } from '../model/quickReplySchema';

export type QuickReplyListParams = {
  category?: string;
  status?: string;
  page?: number;
};

export async function fetchQuickReplies(params: QuickReplyListParams) {
  const { data } = await api.get<Paginated<QuickReply>>('/quick-replies', { params });
  return data;
}

export async function createQuickReply(values: QuickReplyFormValues) {
  const { data } = await api.post<{ data: QuickReply }>('/quick-replies', values);
  return data.data;
}

export async function updateQuickReply(id: number, values: Partial<QuickReplyFormValues>) {
  const { data } = await api.patch<{ data: QuickReply }>(`/quick-replies/${id}`, values);
  return data.data;
}

export async function archiveQuickReply(id: number) {
  const { data } = await api.post<{ data: QuickReply }>(`/quick-replies/${id}/archive`);
  return data.data;
}

/** The picker's data source — ACTIVE templates only, pre-rendered for this ticket. */
export async function fetchTicketQuickReplies(ticketId: number) {
  const { data } = await api.get<{ data: TicketQuickReply[] }>(`/tickets/${ticketId}/quick-replies`);
  return data.data;
}
