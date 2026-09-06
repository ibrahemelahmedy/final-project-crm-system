import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationKeys } from '../api/queryKeys';
import { createBranch, updateBranch, type SaveBranchBody } from '../api/organizationApi';

/**
 * Invalidates BOTH branches() and departments() — a department row renders
 * `branch_name` denormalised from the branch, so a renamed branch must not
 * leave a stale label.
 */
export function useSaveBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: SaveBranchBody }) =>
      id ? updateBranch(id, body) : createBranch(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationKeys.branches() });
      await queryClient.invalidateQueries({ queryKey: organizationKeys.departments() });
    },
  });
}
