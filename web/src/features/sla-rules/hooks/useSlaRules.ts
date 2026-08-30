import { useQuery } from '@tanstack/react-query';
import { slaRuleKeys } from '../api/queryKeys';
import { fetchSlaRules } from '../api/slaRulesApi';

/** The rules list. Four rows maximum, so it is unpaginated by design. */
export function useSlaRules() {
  return useQuery({
    queryKey: slaRuleKeys.list(),
    queryFn: fetchSlaRules,
  });
}
