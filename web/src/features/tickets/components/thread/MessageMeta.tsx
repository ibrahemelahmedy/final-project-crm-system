import type { TicketMessage } from '../../model/ticketMessage';
import { formatDateTime } from '../../../../i18n';
import { ChannelIcon } from '../ChannelIcon';

const ABSOLUTE_TIME_OPTIONS = {
  day: 'numeric' as const,
  month: 'short' as const,
  year: 'numeric' as const,
  hour: 'numeric' as const,
  minute: '2-digit' as const,
};

const SHORT_TIME_OPTIONS = {
  month: 'short' as const,
  day: 'numeric' as const,
  hour: 'numeric' as const,
  minute: '2-digit' as const,
};

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
      <span className="thread-meta-time" title={formatDateTime(message.created_at, ABSOLUTE_TIME_OPTIONS)}>
        {author_type !== 'system' && `${channel_label} · `}
        <span dir="ltr" style={{ display: 'inline-block' }}>
          {formatDateTime(message.created_at, SHORT_TIME_OPTIONS)}
        </span>
      </span>
    </div>
  );
}
