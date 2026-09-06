import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { saveIntegration, type SaveIntegrationBody } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/**
 * Saves a connect/reconfigure. Invalidates integrationKeys.all ONLY — unlike
 * SLA rules' useSaveSlaRule, nothing here changes a ticket.
 */
export function useSaveIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, body }: { type: IntegrationTypeValue; body: SaveIntegrationBody }) =>
      saveIntegration(type, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
}
