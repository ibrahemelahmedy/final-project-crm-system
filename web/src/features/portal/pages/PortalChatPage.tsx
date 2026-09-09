import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../../../i18n';
import { usePortalChat } from '../hooks/usePortalChat';
import { ChatBubble } from '../components/ChatBubble';
import { ChatComposer } from '../components/ChatComposer';
import { ChatNotice } from '../components/ChatNotice';
import { PortalSkeleton, PortalEmpty, PortalError } from '../components/PortalStates';

/**
 * Story 24 (WIS-23), Task 23. The customer chatbot screen. Ships all four
 * async states from PortalStates.
 */
export const PortalChatPage: React.FC = () => {
  const { t } = useT('portal');
  const navigate = useNavigate();
  const { query, send, escalate, replyState, setReplyState } = usePortalChat();

  const escalatedTicketId = escalate.data?.ticket.id;
  useEffect(() => {
    if (escalatedTicketId) navigate(`/portal/requests/${escalatedTicketId}`);
  }, [escalatedTicketId, navigate]);

  if (query.isLoading) {
    return (
      <div className="portal-card portal-wide">
        <PortalSkeleton rows={4} />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="portal-card portal-wide">
        <PortalError onRetry={() => query.refetch()} />
      </div>
    );
  }

  const view = query.data;
  const conversation = view.conversation;
  const active = !view.enabled
    ? false
    : conversation
      ? conversation.state === 'active'
      : true;
  const composerDisabled =
    !active || replyState === 'ended' || replyState === 'rate_limited';

  return (
    <div className="portal-card portal-wide">
      <p className="portal-footer-note" style={{ textAlign: 'start' }}>
        <Link to="/portal/requests" className="portal-link">
          {t('chat.backToRequests')}
        </Link>
      </p>

      <div className="portal-page-head">
        <h1 className="portal-heading">{t('chat.title')}</h1>
      </div>
      <p className="portal-hint">{t('chat.intro')}</p>

      {!view.enabled && <p className="portal-hint">{t('chat.unavailable')}</p>}

      <div className="portal-thread">
        {view.messages.length === 0 ? (
          <PortalEmpty message={t('chat.empty')} />
        ) : (
          view.messages.map((m) => <ChatBubble key={m.id} message={m} />)
        )}
      </div>

      {conversation && (
        <p className="portal-hint" role="status">
          {t('chat.remaining', { count: conversation.messages_remaining })}
        </p>
      )}

      <ChatNotice
        state={replyState}
        escalating={escalate.isPending}
        onEscalate={() => escalate.mutate()}
      />

      {escalate.isError && <PortalError message={t('chat.escalateEmpty')} />}

      <ChatComposer
        disabled={composerDisabled || !view.enabled}
        sending={send.isPending}
        onSend={(body) => {
          setReplyState(null);
          send.mutate(body);
        }}
      />
    </div>
  );
};
