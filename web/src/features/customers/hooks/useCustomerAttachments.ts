import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAttachment, listAttachments, uploadAttachment } from '../api/customersApi';
import { customerKeys } from '../api/queryKeys';

export function useCustomerAttachments(customerId: number) {
  return useQuery({
    queryKey: customerKeys.attachments(customerId),
    queryFn: () => listAttachments(customerId),
  });
}

export function useUploadCustomerAttachment(customerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(customerId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.attachments(customerId) });
    },
  });
}

export function useDeleteCustomerAttachment(customerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: number) => deleteAttachment(customerId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.attachments(customerId) });
    },
  });
}
