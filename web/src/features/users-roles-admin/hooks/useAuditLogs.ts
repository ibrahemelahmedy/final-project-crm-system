import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getAuditLogFacets, listAuditLogs } from '../api/adminApi';
import { adminKeys } from '../api/queryKeys';
import type { AuditLogParams } from './useAuditLogParams';

export function useAuditLogs(params: AuditLogParams) {
  return useQuery({
    queryKey: adminKeys.auditLogs(params),
    queryFn: () => listAuditLogs(params),
    placeholderData: keepPreviousData,
  });
}

export function useAuditLogFacets() {
  return useQuery({
    queryKey: adminKeys.auditLogFacets(),
    queryFn: getAuditLogFacets,
  });
}
