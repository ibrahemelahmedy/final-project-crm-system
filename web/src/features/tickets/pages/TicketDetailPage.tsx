import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArticlePickerPanel } from '../../knowledge-base';
import { TicketCsatPanel } from '../../csat';
import { QuickReplyPicker } from '../../agent-productivity';
import { useAuth } from '../../auth/AuthContext';
import { useTicketDetail } from '../hooks/useTicketDetail';
import { useTicketMessages, flattenChronological } from '../hooks/useTicketMessages';
import { useTicketEvents } from '../hooks/useTicketEvents';
import { useSendReply } from '../hooks/useSendReply';
import { useTicketMeta } from '../hooks/useTicketMeta';
import { useThreadScrollAnchor } from '../hooks/useThreadScrollAnchor';
import { httpStatus } from '../model/apiError';
import { ThreadTopBar } from '../components/thread/ThreadTopBar';
import { MessageList } from '../components/thread/MessageList';
import { ReplyComposer } from '../components/thread/ReplyComposer';
import { TicketMetaPanel } from '../components/thread/TicketMetaPanel';
import {
  ThreadEmpty,
  ThreadError,
  ThreadForbidden,
  ThreadSkeleton,
} from '../components/thread/ThreadStates';

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const id = Number(ticketId);
  const { user } = useAuth();

  const detail = useTicketDetail(id);
  const messages = useTicketMessages(id);
  const events = useTicketEvents(id);
  const meta = useTicketMeta();
  const sendReply = useSendReply(id);

  const flat = useMemo(
    () => flattenChronological(messages.data?.pages),
    [messages.data]
  );

  const { ref, scrollToBottom } = useThreadScrollAnchor({
    count: flat.length,
    prepending: messages.isFetchingNextPage,
  });

  // Story 09's Knowledge Base picker, mounted through the two extension points
  // Story 05 already exposes on ReplyComposer — `onInsertAtCaret` hands us the
  // composer's own caret-insert function, `toolbarSlot` gives the trigger a
  // home. The composer's internals are untouched.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const insertAtCaretRef = useRef<((text: string) => void) | null>(null);

  const captureInsert = useCallback((insert: (text: string) => void) => {
    insertAtCaretRef.current = insert;
  }, []);

  if (detail.isPending) return <ThreadSkeleton />;

  if (detail.isError) {
    const status = httpStatus(detail.error);
    if (status === 403 || status === 404) {
      return <ThreadForbidden id={id} role={user?.role} />;
    }
    return (
      <div className="thread-card">
        <ThreadError onRetry={() => detail.refetch()} />
      </div>
    );
  }

  const ticket = detail.data;

  if (messages.isError) {
    return (
      <div className="thread-card">
        <ThreadTopBar id={ticket.id} subject={ticket.subject} />
        <ThreadError onRetry={() => messages.refetch()} />
      </div>
    );
  }

  return (
    <div className="thread-card">
      <ThreadTopBar id={ticket.id} subject={ticket.subject} />
      <div className="thread-split">
        <div className="thread-col">
          {messages.isPending ? (
            <div className="thread-scroll" />
          ) : flat.length === 0 ? (
            <div className="thread-scroll">
              <ThreadEmpty />
            </div>
          ) : (
            <MessageList
              messages={flat}
              hasNextPage={messages.hasNextPage}
              isFetchingNextPage={messages.isFetchingNextPage}
              onLoadEarlier={() => messages.fetchNextPage()}
              scrollRef={ref}
            />
          )}
          <ReplyComposer
            ticket={ticket}
            isSending={sendReply.isPending}
            onInsertAtCaret={captureInsert}
            toolbarSlot={
              <div className="composer-kb-slot">
                <button
                  type="button"
                  className="tq-btn-outline fv"
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((open) => !open)}
                >
                  Insert KB article
                </button>
                {pickerOpen && (
                  <ArticlePickerPanel
                    autoFocus
                    heading="Insert a Knowledge Base article"
                    onClose={() => setPickerOpen(false)}
                    onInsert={(markdown) => insertAtCaretRef.current?.(markdown)}
                  />
                )}
                <button
                  type="button"
                  className="tq-btn-outline fv"
                  aria-expanded={quickReplyOpen}
                  onClick={() => setQuickReplyOpen((open) => !open)}
                >
                  Insert quick reply
                </button>
                {quickReplyOpen && (
                  <QuickReplyPicker
                    ticketId={ticket.id}
                    onClose={() => setQuickReplyOpen(false)}
                    onInsert={(body) => insertAtCaretRef.current?.(body)}
                  />
                )}
              </div>
            }
            onSend={async (body) => {
              await sendReply.mutateAsync({ body, options: { visibility: 'public' } });
              scrollToBottom();
            }}
            onSendNote={async (body, mentions) => {
              await sendReply.mutateAsync({ body, options: { visibility: 'internal', mentions } });
            }}
          />
        </div>
        <TicketMetaPanel
          ticket={ticket}
          meta={meta.data}
          events={events.data?.data ?? []}
          extraSlot={<TicketCsatPanel ticketId={ticket.id} ticketStatus={ticket.status} />}
        />
      </div>
    </div>
  );
}
