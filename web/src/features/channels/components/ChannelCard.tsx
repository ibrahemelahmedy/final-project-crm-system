import '../channels.css';
import { presentationFor, statusLabel, statusDotClass, unscopeErrorKey, type ChannelOverviewItem } from '../model/channel';
import { ChannelIcon } from './ChannelIcon';
import { useT, formatNumber, formatRelative } from '../../../i18n';

/** How the count slot should read for this card. `empty` and `unavailable`
 *  both avoid rendering a literal `0` that looks like a measurement. */
export type CountState =
  | { kind: 'count'; value: number }
  | { kind: 'empty' }
  | { kind: 'unavailable' };

export function ChannelCard({
  item,
  count,
}: {
  item: ChannelOverviewItem;
  count: CountState;
}) {
  const { t } = useT('channels');
  const presentation = presentationFor(item.value, t);
  const connection = item.connection;

  return (
    <div className="ch-card">
      <span className={`ch-card-icon ch-tint-${presentation.tint}`}>
        <ChannelIcon name={presentation.icon} size={20} />
      </span>

      <div className="ch-card-main">
        <div className="ch-card-heading">
          <span className="ch-card-name">{presentation.label}</span>
          {/* A distinct dot class per state — colour is never the only
              signal (docs/design/brief.md). */}
          <span className={`ch-badge ch-badge-${statusDotClass(item.status)}`}>
            <span className="ch-badge-dot" aria-hidden="true" />
            {statusLabel(item.status, t)}
          </span>
        </div>
        <p className="ch-card-help">{presentation.helpLine}</p>

        {connection && connection.last_inbound_at && (
          <p className="ch-card-audit">
            {t('card.lastInbound', { when: formatRelative(connection.last_inbound_at) })}
            {' · '}
            {t('card.inbound24h', { count: connection.inbound_24h })}
          </p>
        )}

        {item.status === 'error' && connection?.last_error_key && (
          <p className="ch-card-audit ch-card-audit-error" role="alert">
            {t(unscopeErrorKey(connection.last_error_key))}
          </p>
        )}
      </div>

      <div className="ch-card-count">
        {count.kind === 'count' && (
          <>
            <span className="ch-card-count-value">{formatNumber(count.value)}</span>
            <span className="ch-card-count-unit">{t('card.tickets')}</span>
          </>
        )}
        {count.kind === 'empty' && (
          <span className="ch-card-count-note">{t('card.empty')}</span>
        )}
        {count.kind === 'unavailable' && (
          <span className="ch-card-count-note">{t('card.unavailable')}</span>
        )}
      </div>
    </div>
  );
}
