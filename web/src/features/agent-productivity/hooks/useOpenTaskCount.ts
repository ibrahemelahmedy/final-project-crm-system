import { useTicketTasks } from './useTicketTasks';

/**
 * Small extra export beyond the plan's four named ones — needed so Story 05's
 * TicketMetaPanel can show the "N open task(s) on this ticket will be
 * cancelled" warning BEFORE the close PATCH fires (the plan's "warn, then
 * auto-cancel" decision). It reads the same ticket-tasks query
 * TicketTasksPanel already caches, so this costs no extra request once the
 * panel has mounted.
 */
export function useOpenTaskCount(ticketId: number): number {
  const { data } = useTicketTasks(ticketId);
  return data?.filter((t) => t.status === 'open').length ?? 0;
}
