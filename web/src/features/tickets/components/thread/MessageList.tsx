import { Fragment, useEffect, useRef } from 'react';
import type { TicketMessage } from '../../model/ticketMessage';
import { MessageBubble } from './MessageBubble';

type Props = {
  messages: TicketMessage[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadEarlier: () => void;
  scrollRef: React.Ref<HTMLDivElement>;
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function MessageList({
  messages,
  hasNextPage,
  isFetchingNextPage,
  onLoadEarlier,
  scrollRef,
}: Props) {
  const liveRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (newest && lastIdRef.current !== null && newest.id !== lastIdRef.current && liveRef.current) {
      liveRef.current.textContent = `New message from ${
        newest.author?.name ?? (newest.author_type === 'system' ? 'System' : 'a deleted user')
      }`;
    }
    lastIdRef.current = newest?.id ?? null;
  }, [messages]);

  return (
    <div className="thread-scroll" ref={scrollRef}>
      {hasNextPage && (
        <div className="thread-load-earlier">
          <button
            type="button"
            className="tq-btn-outline"
            onClick={onLoadEarlier}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
          </button>
        </div>
      )}

      <ol className="thread-list" role="list" aria-busy={isFetchingNextPage || undefined}>
        {messages.map((message, i) => {
          const prev = messages[i - 1];
          const showDay = !prev || dayKey(prev.created_at) !== dayKey(message.created_at);
          return (
            <Fragment key={message.id}>
              {showDay && (
                <li className="thread-day" aria-hidden="true">
                  <span>{dayLabel(message.created_at)}</span>
                </li>
              )}
              <MessageBubble message={message} />
            </Fragment>
          );
        })}
      </ol>

      <div className="tq-sr-only" aria-live="polite" ref={liveRef} />
    </div>
  );
}
