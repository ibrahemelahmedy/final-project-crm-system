import { formatDate, formatRelative } from '../../../i18n';
import type { DueState, TicketTask } from './task';

// Matches the `10.WisalTicketTasks` artboard's label shapes:
// "Overdue · yesterday" · "Due soon · in 2 hours" · "In 2 days · Aug 27" ·
// "Completed · Aug 24". `due_state` itself is server-computed (never
// re-derived here) — this module only turns it into the display string.
//
// Story 16 (WIS-17): `t` is required, not optional (see
// sla-rules/model/formatDuration.ts) — the frames are keys in the
// `productivity` namespace, and the relative/absolute portions come from the
// shared i18n formatters so they follow a language switch.

export function dueStateLabel(
  task: Pick<TicketTask, 'due_state' | 'due_at' | 'completed_at'>,
  t: (key: string, opts?: Record<string, unknown>) => string,
  now: Date = new Date()
): string {
  const state: DueState = task.due_state;

  if (state === 'none') {
    if (task.completed_at) {
      return t('dueState.completed', { date: formatDate(task.completed_at) });
    }
    return t('dueState.none');
  }

  if (!task.due_at) return t('dueState.none');
  const due = new Date(task.due_at);

  if (state === 'overdue') {
    return t('dueState.overdue', { relative: formatRelative(due, now) });
  }

  if (state === 'due_soon') {
    return t('dueState.dueSoon', { relative: formatRelative(due, now) });
  }

  // upcoming
  return t('dueState.upcoming', { relative: formatRelative(due, now), date: formatDate(due) });
}
