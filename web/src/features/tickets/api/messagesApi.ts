import { api } from '../../../lib/api';
import type { CursorPaginated, TicketMessage } from '../model/ticketMessage';

export async function fetchMessages(ticketId: number, cursor?: string | null) {
  const { data } = await api.get<CursorPaginated<TicketMessage>>(
    `/tickets/${ticketId}/messages`,
    { params: cursor ? { cursor } : undefined }
  );
  return data;
}

export type SendMessageOptions = {
  visibility?: 'public' | 'internal';
  mentions?: number[];
};

export async function sendMessage(ticketId: number, body: string, options: SendMessageOptions = {}) {
  const { data } = await api.post<{ data: TicketMessage }>(`/tickets/${ticketId}/messages`, {
    body,
    ...(options.visibility ? { visibility: options.visibility } : {}),
    ...(options.mentions && options.mentions.length ? { mentions: options.mentions } : {}),
  });
  return data.data;
}
