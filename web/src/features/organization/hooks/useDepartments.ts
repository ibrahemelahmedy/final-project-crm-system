import { useQuery } from '@tanstack/react-query';
import { organizationKeys } from '../api/queryKeys';
import { fetchDepartments } from '../api/organizationApi';

export function useDepartments() {
  return useQuery({
    queryKey: organizationKeys.departments(),
    queryFn: fetchDepartments,
  });
}
