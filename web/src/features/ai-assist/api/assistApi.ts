import { api } from '../../../lib/api';
import type { AssistArtifact, TicketAssist } from '../model/assist';

export async function fetchTicketAssist(ticketId: number): Promise<TicketAssist> {
  const { data } = await api.get(`/tickets/${ticketId}/ai-assist`);
  return data;
}

export async function generateSummary(ticketId: number): Promise<AssistArtifact> {
  const { data } = await api.post(`/tickets/${ticketId}/ai-assist/summary`);
  return data;
}

export async function generateSuggestion(ticketId: number): Promise<AssistArtifact> {
  const { data } = await api.post(`/tickets/${ticketId}/ai-assist/reply`);
  return data;
}

export async function dismissSuggestion(ticketId: number): Promise<void> {
  await api.delete(`/tickets/${ticketId}/ai-assist/reply`);
}
