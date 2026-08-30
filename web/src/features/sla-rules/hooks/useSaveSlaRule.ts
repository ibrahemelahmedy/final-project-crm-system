import { useMutation, useQueryClient } from '@tanstack/react-query';
import { slaRuleKeys } from '../api/queryKeys';
import { ticketKeys } from '../../tickets/api/queryKeys';
import { createSlaRule, updateSlaRule } from '../api/slaRulesApi';
import type { SlaRuleInput } from '../model/slaRuleSchema';

/**
 * One mutation for both create and edit — the only difference is whether an
 * id is present.
 *
 * On success it invalidates slaRuleKeys.all AND ticketKeys.all: a rule change
 * alters the ON BREACH copy on this screen, and it changes the targets every
 * FUTURE ticket receives.
 */
export function useSaveSlaRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: SlaRuleInput }) =>
      id ? updateSlaRule(id, values) : createSlaRule(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: slaRuleKeys.all });
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
}
