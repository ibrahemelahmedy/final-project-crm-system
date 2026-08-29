import { api } from '../../../lib/api';
import type { MentionableUser } from '../model/mentionableUser';

export async function fetchMentionableUsers(ticketId: number) {
  const { data } = await api.get<{ data: MentionableUser[] }>(`/tickets/${ticketId}/mentionable-users`);
  return data.data;
}
