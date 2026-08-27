import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkAction, createCustomer, deleteCustomer, updateCustomer, type BulkPayload } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';
import type { CustomerFormValues } from '../model/customerSchema';

// Mutations invalidate customerKeys.all — the list, the facets, and the
// detail all shift when a customer changes; three separate invalidations
// is three chances to forget one.
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerFormValues) => createCustomer(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useUpdateCustomer(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerFormValues) => updateCustomer(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

export function useBulkCustomerAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkPayload) => bulkAction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}
