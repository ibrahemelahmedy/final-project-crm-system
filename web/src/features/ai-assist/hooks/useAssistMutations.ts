import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dismissSuggestion, generateSuggestion, generateSummary } from '../api/assistApi';
import { assistKeys } from '../api/queryKeys';
import type { TicketAssist } from '../model/assist';

/**
 * Writes the fresh artefact straight into the assistKeys.detail cache on
 * success — so the card flips to `ready` without waiting on a refetch — then
 * invalidates on settle as the safety net (e.g. a 503 leaves the cache
 * unchanged, but a background refetch still confirms nothing was written).
 */
export function useGenerateSummary(ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generateSummary(ticketId),
    onSuccess: (summary) => {
      queryClient.setQueryData<TicketAssist | undefined>(assistKeys.detail(ticketId), (prev) =>
        prev ? { ...prev, summary } : prev
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assistKeys.detail(ticketId) });
    },
  });
}

export function useGenerateSuggestion(ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generateSuggestion(ticketId),
    onSuccess: (suggestion) => {
      queryClient.setQueryData<TicketAssist | undefined>(assistKeys.detail(ticketId), (prev) =>
        prev ? { ...prev, suggestion } : prev
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assistKeys.detail(ticketId) });
    },
  });
}

export function useDismissSuggestion(ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => dismissSuggestion(ticketId),
    onSuccess: () => {
      queryClient.setQueryData<TicketAssist | undefined>(assistKeys.detail(ticketId), (prev) =>
        prev && prev.suggestion ? { ...prev, suggestion: { ...prev.suggestion, dismissed: true } } : prev
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assistKeys.detail(ticketId) });
    },
  });
}
