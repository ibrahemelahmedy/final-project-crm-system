import { useAuth } from '../../auth/AuthContext';
import { useChannelPeriod } from '../hooks/useChannelPeriod';
import { useChannelOverview } from '../hooks/useChannelOverview';
import { PeriodSelector } from '../components/PeriodSelector';
import { ChannelCard, type CountState } from '../components/ChannelCard';
import { ChannelIcon } from '../components/ChannelIcon';
import { KNOWN_CHANNEL_VALUES, type ChannelOverviewItem } from '../model/channel';

/**
 * Channels overview (`/channels`, Story 14 / WIS-15). Read-only for every
 * role. It replaces the Story 02 `PagePlaceholder`; the nav manifest entry is
 * unchanged.
 *
 * The channel LIST is static — it comes from `App\Enums\Channel` via the API,
 * or from the known-channel copy map while the request is pending/failed — so
 * a failed COUNT never blanks the screen: the cards still render, each count
 * reads `Count unavailable`, and `Retry` refetches. There is no error
 * boundary around the page.
 *
 * An Administrator additionally sees a plain sentence that channel
 * integrations are not available in this release. It is static text, never a
 * button, link, or disclosure — Agents see no configuration affordance at all.
 */
export function ChannelsPage() {
  const { user } = useAuth();
  const { period } = useChannelPeriod();
  const query = useChannelOverview(period);

  const isAdmin = user?.role === 'administrator';

  const items: ChannelOverviewItem[] = query.data
    ? query.data.data
    : KNOWN_CHANNEL_VALUES.map((value) => ({
        value,
        label_key: `channels.${value}.label`,
        status: 'not_connected',
        ticket_count: 0,
      }));

  const countFor = (item: ChannelOverviewItem): CountState => {
    if (query.isError) return { kind: 'unavailable' };
    if (item.ticket_count > 0) return { kind: 'count', value: item.ticket_count };
    return { kind: 'empty' };
  };

  return (
    <div className="ch-page">
      <header className="ch-head">
        <h1 className="ch-title">Channels</h1>
        <p className="ch-subtitle">
          {isAdmin
            ? 'Ticket origin by channel — no integrations connected'
            : 'Ticket origin by channel'}
        </p>
      </header>

      <PeriodSelector />

      {isAdmin && (
        <div className="ch-notice" role="note">
          <ChannelIcon name="info" size={16} />
          <p className="ch-notice-text">
            <strong>Channel integrations are not available in this release.</strong> The counts
            below are drawn from existing ticket data.
          </p>
        </div>
      )}

      {query.isError && (
        <div className="ch-error" role="alert">
          <ChannelIcon name="info" size={15} />
          <span className="ch-error-text">
            Ticket counts couldn&apos;t load. Channel information is still shown.
          </span>
          <button type="button" className="ch-retry" onClick={() => query.refetch()}>
            Retry
          </button>
        </div>
      )}

      {query.isPending ? (
        <ul className="ch-list" role="status" aria-label="Loading channels">
          {KNOWN_CHANNEL_VALUES.map((value) => (
            <li key={value} className="ch-card ch-card-skeleton">
              <span className="ch-skeleton ch-skeleton-icon" />
              <div className="ch-card-main">
                <span className="ch-skeleton ch-skeleton-line" />
                <span className="ch-skeleton ch-skeleton-line ch-skeleton-line-sm" />
              </div>
              <span className="ch-skeleton ch-skeleton-count" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="ch-list">
          {items.map((item) => (
            <ChannelCard key={item.value} item={item} count={countFor(item)} />
          ))}
        </div>
      )}
    </div>
  );
}
