import { useQuery } from '@tanstack/react-query';
import { listCustomerTickets } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';

export function useCustomerTickets(customerId: number, page = 1) {
  return useQuery({
    queryKey: customerKeys.tickets(customerId, page),
    queryFn: () => listCustomerTickets(customerId, page),
  });
}
