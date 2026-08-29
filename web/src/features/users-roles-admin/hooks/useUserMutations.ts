import { useMutation, useQueryClient } from '@tanstack/react-query';
import { activateUser, deactivateUser, inviteUser, updateUser } from '../api/adminApi';
import { adminKeys } from '../api/queryKeys';
import type { InviteUserFormValues } from '../model/userSchema';

// Every mutation invalidates adminKeys.all — the list, the facets, and the
// audit log all shift when a user changes, and three separate invalidations
// is three chances to forget one.
function useAdminMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

export function useInviteUser() {
  return useAdminMutation((values: InviteUserFormValues) => inviteUser(values));
}

export function useUpdateUser(id: number) {
  return useAdminMutation((values: InviteUserFormValues) => updateUser(id, values));
}

// Deactivation, not deletion — there is no useDeleteUser, because the API
// exposes no route to delete a user.
export function useDeactivateUser() {
  return useAdminMutation((id: number) => deactivateUser(id));
}

export function useActivateUser() {
  return useAdminMutation((id: number) => activateUser(id));
}
