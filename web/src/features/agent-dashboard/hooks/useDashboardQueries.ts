import { useQuery } from '@tanstack/react-query';
import { dashboardKeys } from '../api/queryKeys';
import {
  fetchAdminSummary,
  fetchAgentQueue,
  fetchAgentSlaRisk,
  fetchAgentSummary,
  fetchQuickReplies,
  fetchTeamEscalations,
  fetchTeamSummary,
  fetchTeamWorkload,
} from '../api/dashboardApi';

// One hook per widget. Each widget owns its own query so a slow or failing
// request only affects that widget — never the rest of the page.

export const useAgentSummary = () =>
  useQuery({ queryKey: dashboardKeys.agent.summary, queryFn: fetchAgentSummary });

export const useAgentQueue = () =>
  useQuery({ queryKey: dashboardKeys.agent.queue, queryFn: fetchAgentQueue });

export const useAgentSlaRisk = () =>
  useQuery({ queryKey: dashboardKeys.agent.slaRisk, queryFn: fetchAgentSlaRisk });

export const useQuickReplies = () =>
  useQuery({ queryKey: dashboardKeys.agent.quickReplies, queryFn: fetchQuickReplies });

export const useTeamSummary = () =>
  useQuery({ queryKey: dashboardKeys.team.summary, queryFn: fetchTeamSummary });

export const useTeamWorkload = () =>
  useQuery({ queryKey: dashboardKeys.team.workload, queryFn: fetchTeamWorkload });

export const useTeamEscalations = () =>
  useQuery({ queryKey: dashboardKeys.team.escalations, queryFn: fetchTeamEscalations });

export const useAdminSummary = () =>
  useQuery({ queryKey: dashboardKeys.admin.summary, queryFn: fetchAdminSummary });
