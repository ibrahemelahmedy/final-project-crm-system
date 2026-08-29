import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { completeTask, createTicketTask, fetchTicketTasks, updateTask } from '../api/tasksApi';
import { productivityKeys } from '../api/queryKeys';
import type { TaskFormValues } from '../model/taskSchema';

export function useTicketTasks(ticketId: number) {
  return useQuery({
    queryKey: productivityKeys.tasks.forTicket(ticketId),
    queryFn: () => fetchTicketTasks(ticketId),
  });
}

export function useCreateTicketTask(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: TaskFormValues) => createTicketTask(ticketId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productivityKeys.tasks.forTicket(ticketId) });
      queryClient.invalidateQueries({ queryKey: productivityKeys.tasks.all });
    },
  });
}

export function useCompleteTask(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => completeTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productivityKeys.tasks.forTicket(ticketId) });
      queryClient.invalidateQueries({ queryKey: productivityKeys.tasks.all });
    },
  });
}

export function useUpdateTask(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<TaskFormValues> }) => updateTask(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productivityKeys.tasks.forTicket(ticketId) });
      queryClient.invalidateQueries({ queryKey: productivityKeys.tasks.all });
    },
  });
}
