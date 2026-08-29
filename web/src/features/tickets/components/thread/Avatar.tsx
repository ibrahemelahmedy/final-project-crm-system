import type { MessageAuthorType } from '../../model/ticketMessage';
import type { TicketChannel } from '../../model/ticket';

type Props = {
  initials: string;
  authorType: MessageAuthorType;
  channel: TicketChannel;
  size?: number;
};

/**
 * Always the author's initials — never the channel glyph (Product rules). The
 * tint varies by channel so the export's colour cue survives.
 * `aria-hidden` — the name is already in the meta line beside it.
 */
export function Avatar({ initials, authorType, channel, size = 32 }: Props) {
  const tint =
    channel === 'whatsapp'
      ? 'thread-avatar--wa'
      : authorType === 'agent'
        ? 'thread-avatar--agent'
        : 'thread-avatar--default';

  return (
    <span
      className={`thread-avatar ${tint}`}
      style={{ inlineSize: size, blockSize: size }}
      aria-hidden="true"
    >
      {initials || '—'}
    </span>
  );
}
