import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { disconnectIntegration } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/** Deletes the stored configuration and secret outright. */
export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: IntegrationTypeValue) => disconnectIntegration(type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
}
