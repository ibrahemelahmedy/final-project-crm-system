import { useQuery } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { fetchDeadLetters } from '../api/integrationsApi';
import type { IntegrationTypeValue } from '../model/types';

/** Story 25 (WIS-24). Dead outbox messages for one integration. */
export function useDeadLetters(type: IntegrationTypeValue, page: number) {
  return useQuery({
    queryKey: integrationKeys.deadLetters(type, page),
    queryFn: () => fetchDeadLetters(type, page),
  });
}
