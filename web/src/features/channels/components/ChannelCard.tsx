import { presentationFor, statusLabel, type ChannelOverviewItem } from '../model/channel';
import { ChannelIcon } from './ChannelIcon';

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
  const presentation = presentationFor(item.value);

  return (
    <div className="ch-card">
      <span className={`ch-card-icon ch-tint-${presentation.tint}`}>
        <ChannelIcon name={presentation.icon} size={20} />
      </span>

      <div className="ch-card-main">
        <div className="ch-card-heading">
          <span className="ch-card-name">{presentation.label}</span>
          <span className="ch-badge">
            <ChannelIcon name="info" size={11} />
            {statusLabel(item.status)}
          </span>
        </div>
        <p className="ch-card-help">{presentation.helpLine}</p>
      </div>

      <div className="ch-card-count">
        {count.kind === 'count' && (
          <>
            <span className="ch-card-count-value">{count.value.toLocaleString()}</span>
            <span className="ch-card-count-unit">tickets</span>
          </>
        )}
        {count.kind === 'empty' && (
          <span className="ch-card-count-note">No tickets this period</span>
        )}
        {count.kind === 'unavailable' && (
          <span className="ch-card-count-note">Count unavailable</span>
        )}
      </div>
    </div>
  );
}
