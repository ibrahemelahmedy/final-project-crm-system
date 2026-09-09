import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { saveSyncConfig, type SyncConfigBody } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/** Story 25 (WIS-24). Invalidates integrationKeys.all — refetches the card (dead_letter_count) too. */
export function useSaveSyncConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, body }: { type: IntegrationTypeValue; body: SyncConfigBody }) => saveSyncConfig(type, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    },
  });
}
