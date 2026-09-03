import { Fragment, useEffect, useRef } from 'react';
import type { TicketMessage } from '../../model/ticketMessage';
import { useT, formatDate } from '../../../../i18n';
import { MessageBubble } from './MessageBubble';

const DAY_LABEL_OPTIONS = {
  weekday: 'short' as const,
  month: 'short' as const,
  day: 'numeric' as const,
  year: 'numeric' as const,
};

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


export function MessageList({
  messages,
  hasNextPage,
  isFetchingNextPage,
  onLoadEarlier,
  scrollRef,
}: Props) {
  const { t } = useT('conversation');
  const liveRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (newest && lastIdRef.current !== null && newest.id !== lastIdRef.current && liveRef.current) {
      const name =
        newest.author?.name ??
        (newest.author_type === 'system' ? t('messages.systemAuthor') : t('messages.deletedAuthor'));
      liveRef.current.textContent = t('messages.newMessageFrom', { name });
    }
    lastIdRef.current = newest?.id ?? null;
  }, [messages, t]);

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
            {isFetchingNextPage ? t('messages.loading') : t('messages.loadEarlier')}
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
                  <span>{formatDate(message.created_at, DAY_LABEL_OPTIONS)}</span>
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
