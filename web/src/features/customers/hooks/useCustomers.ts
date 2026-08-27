import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listCustomers } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';
import type { CustomerListParams } from './useCustomerListParams';

// keepPreviousData (TanStack Query v5 — the v4 keepPreviousData: true flag
// is gone) is what stops the table flashing its skeleton on every page
// change. Pair with isPlaceholderData to dim the table while a page change
// is in flight.
export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => listCustomers(params),
    placeholderData: keepPreviousData,
  });
}
