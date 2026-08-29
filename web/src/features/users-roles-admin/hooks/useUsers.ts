import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getUserFacets, listUsers } from '../api/adminApi';
import { adminKeys } from '../api/queryKeys';
import type { UserListParams } from './useUserListParams';

// keepPreviousData (TanStack Query v5) is what stops the table flashing its
// skeleton on every page change. Pair with isPlaceholderData to dim the table
// while a page change is in flight — same as Story 03's list.
export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });
}

// Unfiltered on purpose: the chips must keep offering every role and
// department, or picking one makes it the only value you can ever pick again.
export function useUserFacets() {
  return useQuery({
    queryKey: adminKeys.userFacets(),
    queryFn: getUserFacets,
  });
}
