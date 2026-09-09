import { useQuery } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { fetchSyncRuns } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/** Story 25 (WIS-24). Paginated run history for one integration. */
export function useSyncRuns(type: IntegrationTypeValue, page: number) {
  return useQuery({
    queryKey: integrationKeys.syncRuns(type, page),
    queryFn: () => fetchSyncRuns(type, page),
  });
}
