import { Link } from 'react-router-dom';
import { useT } from '../../../../i18n';

export function ThreadSkeleton() {
  const { t } = useT('conversation');
  return (
    <div className="thread-card" aria-busy="true" aria-label={t('states.loadingConversation')}>
      <div className="thread-topbar">
        <div className="sk" style={{ blockSize: 16, inlineSize: 140 }} />
      </div>
      <div className="thread-split">
        <div className="thread-col">
          <div className="thread-scroll">
            <div className="thread-skeleton">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`sk thread-skeleton-bubble${i % 2 ? ' thread-skeleton-bubble--out' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="meta-panel">
          <div className="sk" style={{ blockSize: 120 }} />
        </div>
      </div>
    </div>
  );
}

export function ThreadEmpty() {
  const { t } = useT('conversation');
  return (
    <div className="thread-empty">
      <div className="thread-empty-icon" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16v10H8l-4 4z" />
        </svg>
      </div>
      <h2 className="thread-empty-title">{t('states.noMessagesTitle')}</h2>
      <p className="thread-empty-body">{t('states.noMessagesBody')}</p>
    </div>
  );
}

export function ThreadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useT('conversation');
  return (
    <div className="thread-empty" role="alert">
      <h2 className="thread-empty-title">{t('states.errorTitle')}</h2>
      <p className="thread-empty-body">{t('states.errorBody')}</p>
      <button type="button" className="tq-btn-primary" onClick={onRetry}>
        {t('common:table.tryAgain')}
      </button>
    </div>
  );
}

export function ThreadForbidden({ id, role }: { id: number; role?: string }) {
  const { t } = useT('conversation');
  const body =
    role === 'agent'
      ? t('states.forbiddenAgentBody', { id })
      : t('states.forbiddenGenericBody');
  return (
    <div className="thread-empty" role="alert">
      <h2 className="thread-empty-title">{t('states.forbiddenTitle')}</h2>
      <p className="thread-empty-body">{body}</p>
      <Link to="/tickets" className="tq-btn-primary">
        {t('states.backToTickets')}
      </Link>
    </div>
  );
}
