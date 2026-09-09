import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { runSyncNow } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/** Story 25 (WIS-24), Decision 12. The synchronous, hard-capped manual run. */
export function useRunSyncNow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: IntegrationTypeValue) => runSyncNow(type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
}
