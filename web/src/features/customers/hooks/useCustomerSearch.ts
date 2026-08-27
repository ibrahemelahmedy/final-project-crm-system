import { useQuery } from '@tanstack/react-query';
import { listCustomers } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';
import type { CustomerListParams } from './useCustomerListParams';

const SEARCH_PARAMS: Omit<CustomerListParams, 'q'> = {
  company: [],
  tier: [],
  sort: 'name',
  dir: 'asc',
  page: 1,
  per_page: 10,
};

// A lightweight typeahead used by Story 04's New Ticket modal to pick a
// customer (WisalModals-LightLTR.dc.html lines 59-74). Exported from the
// feature's barrel — Story 04 imports it, not a deeper path.
export function useCustomerSearch(term: string) {
  const params: CustomerListParams = { ...SEARCH_PARAMS, q: term };
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => listCustomers(params),
    enabled: term.trim().length > 0,
  });
}
