import type { TicketPriority } from '../model/ticket';
import { PRIORITY_FALLBACK_LABELS } from '../model/display';

type Props = { priority: TicketPriority; label?: string };

/**
 * Deliberately a separate component from StatusBadge, with its own token set.
 * docs/design/brief.md line 217 forbids conflating priority and status; a
 * single <Badge kind="..."> is how they get conflated six months later.
 *
 * The label renders as TEXT — colour is never the only signal (brief.md 196).
 */
export function PriorityBadge({ priority, label }: Props) {
  return (
    <span className={`tq-prio tq-prio-${priority}`}>
      {label ?? PRIORITY_FALLBACK_LABELS[priority]}
    </span>
  );
}
