import React from 'react';
import { useT } from '../../../i18n';

type Props = {
  label: string;
  /** Already-formatted value. Pass "—" for an unknown/not-applicable metric. */
  value: React.ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  /** Own loading state — the tile row fetches with the summary widget. */
  loading?: boolean;
  /** Own error state — a failed summary shows "—", never a fake 0. */
  error?: boolean;
};

/**
 * label · value. The three stat tiles at the top of every role dashboard.
 * A tile never renders 0 when the request failed — it renders "—".
 */
export function StatTile({ label, value, tone = 'default', loading, error }: Props) {
  const { t } = useT('dashboard');
  return (
    <div className={`stat-tile stat-tile-${tone}`}>
      <div className="stat-tile-label">{label}</div>
      {loading ? (
        <div className="stat-tile-value" role="status">
          <span className="tq-sr-only">{t('widget.loadingTitled', { title: label })}</span>
          <span className="stat-tile-skeleton" />
        </div>
      ) : (
        <div className="stat-tile-value">
          <span dir="ltr" className="tq-ltr">
            {error ? '—' : value}
          </span>
        </div>
      )}
    </div>
  );
}
