import { useQuery } from '@tanstack/react-query';
import { fetchMyOpenTasks } from '../api/tasksApi';
import { productivityKeys } from '../api/queryKeys';

/**
 * The exported hook Story 07's Agent Dashboard consumes — see the plan's
 * "Frontend public surface" contract. `GET /api/tasks?assignee=me&status=open`.
 */
export function useMyOpenTasks() {
  return useQuery({
    queryKey: productivityKeys.tasks.mine('open'),
    queryFn: fetchMyOpenTasks,
  });
}
