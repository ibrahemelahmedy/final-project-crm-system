import type { DueState, TicketTask } from './task';

// Matches the `10.WisalTicketTasks` artboard's exact label shapes:
// "Overdue · yesterday" · "Due soon · in 2 hours" · "In 2 days · Aug 27" ·
// "Completed · Aug 24". `due_state` itself is server-computed (never
// re-derived here) — this module only turns it into the display string.

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function relativeDay(date: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (dayDiff === 0) return 'today';
  if (dayDiff === -1) return 'yesterday';
  if (dayDiff === 1) return 'tomorrow';
  return rtf.format(dayDiff, 'day');
}

function relativeHours(date: Date, now: Date): string {
  const hours = Math.round((date.getTime() - now.getTime()) / 3_600_000);
  if (hours <= 0) return 'now';
  return rtf.format(hours, 'hour');
}

export function dueStateLabel(task: Pick<TicketTask, 'due_state' | 'due_at' | 'completed_at'>, now = new Date()): string {
  const state: DueState = task.due_state;

  if (state === 'none') {
    if (task.completed_at) {
      return `Completed · ${dateFmt.format(new Date(task.completed_at))}`;
    }
    return 'No due date';
  }

  if (!task.due_at) return 'No due date';
  const due = new Date(task.due_at);

  if (state === 'overdue') {
    return `Overdue · ${relativeDay(due, now)}`;
  }

  if (state === 'due_soon') {
    return `Due soon · ${relativeHours(due, now)}`;
  }

  // upcoming
  return `${capitalize(relativeDay(due, now))} · ${dateFmt.format(due)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
