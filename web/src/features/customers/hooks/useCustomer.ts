import { useQuery } from '@tanstack/react-query';
import { getCustomer } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';

export function useCustomer(id: number) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => getCustomer(id),
  });
}
