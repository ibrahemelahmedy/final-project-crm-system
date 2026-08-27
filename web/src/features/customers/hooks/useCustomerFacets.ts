import { useQuery } from '@tanstack/react-query';
import { getFacets } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';
import type { CustomerListParams } from './useCustomerListParams';

// A second round trip that must not block the table — its own staleTime so
// it doesn't refetch in lockstep with every list request.
export function useCustomerFacets(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.facets(params),
    queryFn: () => getFacets(params),
    staleTime: 60_000,
  });
}
