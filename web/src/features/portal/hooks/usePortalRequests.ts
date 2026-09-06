import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPortalRequest,
  fetchPortalRequest,
  fetchPortalRequests,
  replyToPortalRequest,
  type NewPortalRequestInput,
} from '../api/portalApi';
import { portalKeys } from '../model/portalKeys';

export function usePortalRequestsList(scope: 'open' | 'past', page: number) {
  return useQuery({
    queryKey: [...portalKeys.requests(scope), page],
    queryFn: () => fetchPortalRequests(scope, page),
  });
}

export function usePortalRequestDetail(ticketId: string | undefined) {
  return useQuery({
    queryKey: portalKeys.request(ticketId ?? ''),
    queryFn: () => fetchPortalRequest(ticketId as string),
    enabled: !!ticketId,
  });
}

export function useCreatePortalRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPortalRequestInput) => createPortalRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.all }),
  });
}

export function useReplyToPortalRequest(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => replyToPortalRequest(ticketId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.all }),
  });
}
