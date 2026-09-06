import { useQuery } from '@tanstack/react-query';
import { integrationKeys } from '../api/queryKeys';
import { fetchIntegrations } from '../api/integrationsApi';

/** The five-card list. Always all five types — unpaginated by design. */
export function useIntegrations() {
  return useQuery({
    queryKey: integrationKeys.list(),
    queryFn: fetchIntegrations,
  });
}
