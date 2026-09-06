import { useT, formatRelative } from '../../../i18n';
import { IntegrationIcon } from './IntegrationIcon';
import { StatusPill } from './StatusPill';
import { unscopeKey, type Integration } from '../model/types';

type Props = { integration: Integration; onOpen: (integration: Integration) => void };

const ACTION_KEY: Record<Integration['status'], string> = {
  not_connected: 'action.connect',
  connected: 'action.configure',
  error: 'action.reconnect',
};

/**
 * One integration, one card. Renders the audit strip — "Last checked" / "Last
 * check failed" (Decision 3: never "synced", nothing in this release syncs).
 */
export function IntegrationCard({ integration, onOpen }: Props) {
  const { t } = useT('integrations');

  return (
    <article className={`intg-card intg-card-${integration.status}`}>
      <div className="intg-card-head">
        <span className="intg-card-icon">
          <IntegrationIcon type={integration.type} />
        </span>
        <div className="intg-card-title-group">
          <h3 className="intg-card-title">{t(unscopeKey(integration.label_key))}</h3>
          <StatusPill status={integration.status} />
        </div>
      </div>

      <p className="intg-card-help">{t(`type.${integration.type}.help`)}</p>

      <button type="button" className="dt-btn dt-btn-primary intg-card-action" onClick={() => onOpen(integration)}>
        {t(ACTION_KEY[integration.status])}
      </button>

      {integration.status === 'connected' && integration.last_checked_at && (
        <p className="intg-card-audit">
          {t('audit.lastChecked', { when: formatRelative(integration.last_checked_at) })}
        </p>
      )}

      {integration.status === 'error' && (
        <p className="intg-card-audit intg-card-audit-error">{t('audit.lastCheckFailed')}</p>
      )}
    </article>
  );
}
