import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { retryDeadLetters } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/** Story 25 (WIS-24). Requeues dead messages; the scheduled drain delivers them, not this call. */
export function useRetryDeadLetters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: IntegrationTypeValue) => retryDeadLetters(type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
}
