import type { ReactNode } from 'react';
import type { TicketMessage } from '../../model/ticketMessage';
import { Avatar } from './Avatar';
import { MessageMeta } from './MessageMeta';

function bubbleClass(message: TicketMessage): string {
  // Story 10: an internal note is visually distinct from every channel
  // bubble — never fragmented into a second feed, but never mistaken for a
  // customer-visible message either (brief.md's anti-fragmentation rule).
  if (message.visibility === 'internal') return 'thread-bubble thread-bubble--note';
  if (message.author_type === 'agent') return 'thread-bubble thread-bubble--out';
  if (message.author_type === 'system') return 'thread-bubble thread-bubble--system';
  if (message.channel === 'whatsapp') return 'thread-bubble thread-bubble--wa';
  return 'thread-bubble thread-bubble--in';
}

/** Renders "@Name" runs as mention chips — body is still never parsed as HTML. */
function renderBody(body: string, mentionNames: string[]): ReactNode {
  if (mentionNames.length === 0) return body;

  const pattern = new RegExp(`(@(?:${mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g');
  const parts = body.split(pattern);

  return parts.map((part, i) =>
    mentionNames.some((n) => part === `@${n}`) ? (
      <span key={i} className="mention-chip">
        {part}
      </span>
    ) : (
      part
    )
  );
}

/**
 * Alignment follows `author_type === 'agent'`, NOT `is_mine` — another agent's
 * reply is still an outbound message. The tail corner uses logical radius
 * properties so it mirrors under RTL from one declaration.
 * `body` renders as plain text (`white-space: pre-wrap`) — never HTML.
 */
export function MessageBubble({ message }: { message: TicketMessage }) {
  const outbound = message.author_type === 'agent';
  const isNote = message.visibility === 'internal';
  const initials =
    message.author?.initials ?? (message.author_type === 'system' ? 'S' : '?');
  const mentionNames = message.mentions?.map((m) => m.name) ?? [];

  return (
    <li className={`thread-row${outbound ? ' thread-row--out' : ''}`}>
      <Avatar
        initials={initials}
        authorType={message.author_type}
        channel={message.channel}
      />
      <div className="thread-body">
        {isNote && <span className="note-badge">Internal note</span>}
        <MessageMeta message={message} />
        <div className={bubbleClass(message)}>{renderBody(message.body, mentionNames)}</div>
      </div>
    </li>
  );
}
