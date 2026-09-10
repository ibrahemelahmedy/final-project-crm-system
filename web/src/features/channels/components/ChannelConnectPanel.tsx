import { useState } from 'react';
import '../channels.css';
import { useT, formatRelative } from '../../../i18n';
import { ChannelIcon } from './ChannelIcon';
import { ChannelConnectModal } from './ChannelConnectModal';
import { useChannelConnections } from '../hooks/useChannelConnections';
import { presentationFor, statusLabel, statusDotClass, unscopeErrorKey, type ChannelConnection } from '../model/channel';

const ACTION_KEY: Record<string, string> = {
  not_connected: 'connect.connect',
  connected: 'connect.configure',
  error: 'connect.reconnect',
};

/**
 * Story 26 (WIS-22), Task 66. Administrator-only connect/configure/test/
 * disconnect surface, replacing the old admin release notice on
 * /channels. All four async states: skeleton while loading, a retryable
 * banner on error, one row per connectable channel on success (never an
 * empty state — GET /admin/channels always returns all four
 * `Channel::connectable()` rows, connected or not, so there is nothing to be
 * "empty").
 */
export function ChannelConnectPanel() {
  const { t } = useT('channels');
  const query = useChannelConnections();
  const [openChannel, setOpenChannel] = useState<string | null>(null);

  const opening = query.data?.find((c) => c.channel === openChannel) ?? null;

  return (
    <section className="ch-connect-panel" aria-labelledby="ch-connect-panel-title">
      <h2 id="ch-connect-panel-title" className="ch-connect-panel-title">
        {t('connect.panelTitle')}
      </h2>

      {query.isPending && (
        <div className="ch-connect-list" role="status" aria-label={t('page.loadingLabel')}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ch-connect-row ch-connect-row-skeleton">
              <span className="ch-skeleton ch-skeleton-line" />
            </div>
          ))}
        </div>
      )}

      {query.isError && (
        <div className="ch-error" role="alert">
          <ChannelIcon name="info" size={15} />
          <span className="ch-error-text">{t('page.loadError')}</span>
          <button type="button" className="ch-retry" onClick={() => query.refetch()}>
            {t('page.retry')}
          </button>
        </div>
      )}

      {query.isSuccess && (
        <div className="ch-connect-list">
          {query.data.map((connection) => (
            <ChannelConnectRow key={connection.channel} connection={connection} onOpen={() => setOpenChannel(connection.channel)} />
          ))}
        </div>
      )}

      {opening && <ChannelConnectModal connection={opening} onClose={() => setOpenChannel(null)} />}
    </section>
  );
}

function ChannelConnectRow({ connection, onOpen }: { connection: ChannelConnection; onOpen: () => void }) {
  const { t } = useT('channels');
  const presentation = presentationFor(connection.channel, t);

  return (
    <div className="ch-connect-row">
      <span className={`ch-connect-row-icon ch-tint-${presentation.tint}`}>
        <ChannelIcon name={presentation.icon} size={18} />
      </span>

      <div className="ch-connect-row-main">
        <div className="ch-connect-row-heading">
          <span className="ch-connect-row-name">{presentation.label}</span>
          <span className={`ch-status-pill ch-status-pill-${statusDotClass(connection.status)}`}>
            <span className="ch-status-dot" aria-hidden="true" />
            {statusLabel(connection.status, t)}
          </span>
        </div>

        {connection.last_inbound_at && (
          <p className="ch-connect-row-audit">
            {t('card.lastInbound', { when: formatRelative(connection.last_inbound_at) })}
          </p>
        )}

        {connection.status === 'error' && connection.last_error_key && (
          <p className="ch-connect-row-audit ch-connect-row-audit-error" role="alert">
            {t(unscopeErrorKey(connection.last_error_key))}
          </p>
        )}
      </div>

      <button type="button" className="dt-btn dt-btn-outline" onClick={onOpen}>
        {t(ACTION_KEY[connection.status] ?? 'connect.connect')}
      </button>
    </div>
  );
}
