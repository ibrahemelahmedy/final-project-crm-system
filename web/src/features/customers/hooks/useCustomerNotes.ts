import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createNote, listNotes } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';

export function useCustomerNotes(customerId: number) {
  return useQuery({
    queryKey: customerKeys.notes(customerId),
    queryFn: () => listNotes(customerId),
  });
}

export function useCreateCustomerNote(customerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createNote(customerId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.notes(customerId) });
    },
  });
}
