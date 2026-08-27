import type { TicketStatus } from '../model/ticket';
import { STATUS_FALLBACK_LABELS } from '../model/display';

type Props = { status: TicketStatus; label?: string };

/**
 * Separate from PriorityBadge on purpose — two components, two token sets.
 * See PriorityBadge and docs/design/brief.md line 217.
 *
 * CLOSED uses a darker slate than LOW priority so the two never read as the
 * same grey chip in adjacent columns.
 */
export function StatusBadge({ status, label }: Props) {
  return (
    <span className={`tq-status tq-status-${status}`}>
      {label ?? STATUS_FALLBACK_LABELS[status]}
    </span>
  );
}
