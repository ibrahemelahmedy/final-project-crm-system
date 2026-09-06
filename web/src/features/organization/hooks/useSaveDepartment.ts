import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationKeys } from '../api/queryKeys';
import { createDepartment, updateDepartment, type SaveDepartmentBody } from '../api/organizationApi';

export function useSaveDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: SaveDepartmentBody }) =>
      id ? updateDepartment(id, body) : createDepartment(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: organizationKeys.departments() });
    },
  });
}
