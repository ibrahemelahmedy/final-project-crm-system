import type { TicketMessage } from '../../model/ticketMessage';
import { formatAbsoluteTime } from '../../model/display';
import { ChannelIcon } from '../ChannelIcon';

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function MessageMeta({ message }: { message: TicketMessage }) {
  const { author_type, author, is_mine, channel, channel_label } = message;

  let name: string;
  let muted = false;
  if (author_type === 'system') {
    name = 'System';
  } else if (author) {
    name = author.name + (is_mine ? ' (You)' : '');
  } else {
    name = author_type === 'agent' ? 'Deleted user' : 'Deleted customer';
    muted = true;
  }

  return (
    <div className="thread-meta">
      <span className={`thread-meta-author${muted ? ' thread-meta-author--muted' : ''}`}>
        {name}
      </span>
      {author_type !== 'system' && (
        <span className="thread-meta-glyph">
          <ChannelIcon channel={channel} label={channel_label} size={13} />
        </span>
      )}
      <span className="thread-meta-time" title={formatAbsoluteTime(message.created_at)}>
        {author_type !== 'system' && `${channel_label} · `}
        <span dir="ltr" style={{ display: 'inline-block' }}>
          {shortTime(message.created_at)}
        </span>
      </span>
    </div>
  );
}
