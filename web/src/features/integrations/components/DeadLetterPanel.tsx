import { useState } from 'react';
import { useT, formatRelative } from '../../../i18n';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useDeadLetters } from '../hooks/useDeadLetters';
import { useRetryDeadLetters } from '../hooks/useRetryDeadLetters';
import { unscopeKey, type Integration } from '../model/types';

type Props = { integration: Integration };

/**
 * Story 25 (WIS-24), Task 53. Rendered only when
 * integration.sync.dead_letter_count > 0 by the caller (IntegrationModal).
 */
export function DeadLetterPanel({ integration }: Props) {
  const { t } = useT('integrations');
  const [confirmRetry, setConfirmRetry] = useState(false);
  const query = useDeadLetters(integration.type, 1);
  const retry = useRetryDeadLetters();

  const onRetryAll = async () => {
    await retry.mutateAsync(integration.type);
    setConfirmRetry(false);
  };

  return (
    <div className="intg-dead-panel">
      <p className="intg-dead-banner" role="alert">
        {t('sync.deadLetters', { count: integration.sync.dead_letter_count })}
      </p>

      {query.isPending && <p>{t('sync.loading')}</p>}

      {query.isError && (
        <div className="intg-state" role="alert">
          <p className="intg-state-body">{t('error.loadBody')}</p>
          <button type="button" className="dt-btn dt-btn-primary" onClick={() => void query.refetch()}>
            {t('error.retry')}
          </button>
        </div>
      )}

      {!query.isPending && !query.isError && query.data.data.length === 0 && (
        <p className="intg-state-body">{t('sync.empty.body')}</p>
      )}

      {!query.isPending && !query.isError && query.data.data.length > 0 && (
        <ul className="intg-dead-list">
          {query.data.data.map((message) => (
            <li key={message.id} className="intg-dead-row">
              <span>{t(`sync.event.${message.event}`)}</span>
              <span className="intg-dead-event-id">{message.event_id}</span>
              <span>{t('sync.attempts', { count: message.attempts })}</span>
              <span>{message.last_status ?? '—'}</span>
              <span>{message.last_error_key ? t(unscopeKey(message.last_error_key)) : '—'}</span>
              <span>{message.failed_at ? formatRelative(message.failed_at) : '—'}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="dt-btn dt-btn-outline"
        disabled={retry.isPending}
        onClick={() => setConfirmRetry(true)}
      >
        {t('sync.retryAll')}
      </button>

      <ConfirmDialog
        open={confirmRetry}
        title={t('sync.retryAllConfirmTitle')}
        body={t('sync.retryAllConfirmBody')}
        confirmLabel={t('sync.retryAll')}
        isPending={retry.isPending}
        onConfirm={onRetryAll}
        onCancel={() => setConfirmRetry(false)}
      />
    </div>
  );
}
