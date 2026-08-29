import type { TicketChannel } from '../../model/ticket';
import { ChannelIcon } from '../ChannelIcon';

/**
 * Read-only indicator — no chevron, no picker (Product rules). Replies always
 * go on the ticket's original channel; the server copies `$ticket->channel`.
 */
export function ComposerChannelBadge({
  channel,
  label,
}: {
  channel: TicketChannel;
  label: string;
}) {
  return (
    <span
      className={`composer-channel${channel === 'whatsapp' ? ' composer-channel--wa' : ''}`}
      title="Replies are sent on the ticket's original channel"
    >
      <ChannelIcon channel={channel} label={label} size={13} />
      Reply via {label}
    </span>
  );
}
