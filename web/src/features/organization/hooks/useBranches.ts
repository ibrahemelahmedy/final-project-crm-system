import { useQuery } from '@tanstack/react-query';
import { organizationKeys } from '../api/queryKeys';
import { fetchBranches } from '../api/organizationApi';

/** The branches list. Always unpaginated — see organizationApi.ts. */
export function useBranches() {
  return useQuery({
    queryKey: organizationKeys.branches(),
    queryFn: fetchBranches,
  });
}
