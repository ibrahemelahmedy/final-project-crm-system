import { api } from '../../../lib/api';
import type {
  AdminSummary,
  AgentSummary,
  DashboardTicket,
  EscalationTicket,
  QuickReply,
  TeamSummary,
  WorkloadRow,
} from '../model/dashboard';

// All calls go through the shared Axios instance in web/src/lib/api.ts.
// Do not create a second client.

export async function fetchAgentSummary(): Promise<AgentSummary> {
  const { data } = await api.get('/dashboard/agent/summary');
  return data;
}

export async function fetchAgentQueue(): Promise<DashboardTicket[]> {
  const { data } = await api.get('/dashboard/agent/queue');
  return data.data;
}

export async function fetchAgentSlaRisk(): Promise<DashboardTicket[]> {
  const { data } = await api.get('/dashboard/agent/sla-risk');
  return data.data;
}

export async function fetchTeamSummary(): Promise<TeamSummary> {
  const { data } = await api.get('/dashboard/team/summary');
  return data;
}

export async function fetchTeamWorkload(): Promise<WorkloadRow[]> {
  const { data } = await api.get('/dashboard/team/workload');
  return data;
}

export async function fetchTeamEscalations(): Promise<EscalationTicket[]> {
  const { data } = await api.get('/dashboard/team/escalations');
  return data.data;
}

export async function fetchAdminSummary(): Promise<AdminSummary> {
  const { data } = await api.get('/dashboard/admin/summary');
  return data;
}

/**
 * Story 10 owns the quick-replies data model and ships after this story.
 * Until then `GET /api/quick-replies` may 404; the widget renders its Empty
 * state for a 404 or an empty list, and never invents placeholder data.
 */
export async function fetchQuickReplies(): Promise<QuickReply[]> {
  try {
    const { data } = await api.get('/quick-replies');
    return Array.isArray(data) ? data : (data.data ?? []);
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { status?: number } }).response?.status === 404
  );
}
