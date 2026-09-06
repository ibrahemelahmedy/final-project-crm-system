import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useT, formatDate, formatRelative } from '../../../i18n';
import { usePortalRequestDetail, useReplyToPortalRequest } from '../hooks/usePortalRequests';
import { RequestStatusBadge } from '../components/RequestStatusBadge';
import { MessageBubble } from '../components/MessageBubble';
import { PortalEmpty, PortalError, PortalSkeleton } from '../components/PortalStates';

/**
 * Story 17 (WIS-16) — one request's public thread plus the reply composer.
 * Undesigned screen (Decision 3).
 *
 * The thread is PUBLIC messages only, and that is enforced server-side by
 * PortalRequestController::show()'s publicOnly() scope — this page never
 * filters, so there is no second place for an internal note to leak from.
 * Bodies render as plain text (MessageBubble, dir="auto", pre-wrap) and never
 * through dangerouslySetInnerHTML: ticket_messages.body is unsanitized input.
 */
export const PortalRequestDetailPage: React.FC = () => {
  const { t } = useT('portal');
  const { ticketId } = useParams<{ ticketId: string }>();
  const query = usePortalRequestDetail(ticketId);
  const reply = useReplyToPortalRequest(ticketId ?? '');
  const [body, setBody] = useState('');

  const notFound = (query.error as AxiosError | undefined)?.response?.status === 404;

  const onReply = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed === '') return;
    reply.mutate(trimmed, { onSuccess: () => setBody('') });
  };

  if (query.isPending) {
    return (
      <div className="portal-card portal-wide">
        <PortalSkeleton rows={4} label={t('detail.loading')} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="portal-card portal-wide">
        {notFound ? (
          <PortalEmpty
            message={t('detail.notFound')}
            action={
              <Link to="/portal/requests" className="portal-link">
                {t('nav.requests')}
              </Link>
            }
          />
        ) : (
          <PortalError message={t('detail.error')} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }

  const { ticket, messages } = query.data;
  const isClosed = ticket.status === 'closed';

  return (
    <div className="portal-card portal-wide">
      <p className="portal-footer-note" style={{ textAlign: 'start' }}>
        <Link to="/portal/requests" className="portal-link">
          {t('ui.back')}
        </Link>
      </p>

      <div className="portal-page-head">
        <h1 className="portal-heading" dir="auto">
          {ticket.subject}
        </h1>
        <RequestStatusBadge status={ticket.status} label={ticket.status_label} />
      </div>

      <p className="portal-hint">
        {t('detail.openedOn', { date: formatDate(ticket.created_at) })}
        {' · '}
        {t('detail.lastActivity', { time: formatRelative(ticket.last_activity_at) })}
        {ticket.resolved_at && (
          <>
            {' · '}
            {t('detail.resolvedOn', { date: formatDate(ticket.resolved_at) })}
          </>
        )}
      </p>

      {/* AC7's implementation half, per Decision 2: the portal LINKS to Story
          13's existing signed survey page. It does not re-implement a survey,
          and the emailed link keeps working unchanged. */}
      {ticket.feedback_url && (
        <p className="portal-feedback-cta">
          <a href={ticket.feedback_url} className="portal-link fv">
            {t('detail.rateExperience')}
          </a>
        </p>
      )}

      {messages.length === 0 ? (
        <PortalEmpty message={t('detail.threadEmpty')} />
      ) : (
        <div className="portal-thread">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      )}

      {isClosed ? (
        <p className="portal-hint" role="status">
          {t('detail.closedNotice')}
        </p>
      ) : (
        <form className="portal-form" onSubmit={onReply} noValidate>
          <div className="portal-field">
            <label htmlFor="reply-body" className="portal-label">
              {t('detail.replyLabel')}
            </label>
            <textarea
              id="reply-body"
              className="portal-textarea fv"
              maxLength={5000}
              rows={4}
              dir="auto"
              placeholder={t('detail.replyPlaceholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={reply.isPending}
            />
            {reply.isError && (
              <span className="portal-alert-error" role="alert">
                {t('detail.replyError')}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="portal-btn fv"
            disabled={reply.isPending || body.trim() === ''}
            aria-busy={reply.isPending}
          >
            {reply.isPending ? t('detail.replying') : t('detail.reply')}
          </button>
        </form>
      )}
    </div>
  );
};
