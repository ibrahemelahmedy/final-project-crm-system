import type { CsatBlock } from '../model/report';
import { useT, formatNumber } from '../../../i18n';
import { ReportCard } from './ReportCard';
import '../../csat/csat.css';

/**
 * Customer Satisfaction (CSAT). Story 13 supplies the data source: this card
 * now renders a real average over `csat_surveys` when the range has rated
 * responses, and Story 12's permanent Empty state otherwise.
 *
 * A period with zero responses is "no data" — `available: false` — never a
 * score of 0. Story 12's payload shape is unchanged; the aggregate fields are
 * read only when `block.available` is true.
 *
 * There is still no chart element here — the design export has no CSAT chart.
 */
export function CsatCard({ block }: { block: CsatBlock }) {
  const { t } = useT('reports');
  const fmt = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <ReportCard
      title={t('csat.title')}
      available={block.available}
      emptyMessage={t('csat.empty')}
    >
      <div className="rp-csat">
        <p className="rp-csat-value" dir="ltr">
          {block.average != null ? fmt(block.average) : '—'}
          <span className="rp-csat-scale"> / 5</span>
        </p>
        <p className="rp-csat-count">{t('csat.responseCount', { count: block.response_count ?? 0 })}</p>
        {block.by_agent && block.by_agent.length > 0 && (
          <ul className="rp-csat-agents">
            {block.by_agent.map((row) => (
              <li key={row.user_id ?? 'unattributed'} className="rp-csat-agent-row">
                <span className="rp-csat-agent-name">{row.name}</span>
                <span className="rp-csat-agent-score" dir="ltr">
                  {fmt(row.average)} ({row.response_count})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ReportCard>
  );
}
