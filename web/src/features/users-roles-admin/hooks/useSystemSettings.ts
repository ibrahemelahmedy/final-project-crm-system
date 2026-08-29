import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../api/adminApi';
import { adminKeys } from '../api/queryKeys';

export function useSystemSettings() {
  return useQuery({
    queryKey: adminKeys.settings(),
    queryFn: getSettings,
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, number>) => updateSettings(values),
    onSuccess: (result) => {
      // Write the server's copy straight back — it is the authority on what
      // was actually persisted, including any value it clamped or rejected.
      queryClient.setQueryData(adminKeys.settings(), result.data);
      // A setting change writes an audit row, so the viewer is stale now.
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}
