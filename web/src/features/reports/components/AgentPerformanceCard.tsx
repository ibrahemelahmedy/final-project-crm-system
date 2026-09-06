import type { AgentsBlock } from '../model/report';
import { formatMinutes } from '../model/report';
import { useT } from '../../../i18n';
import { ReportCard } from './ReportCard';

/**
 * The artboard's table: AGENT · RESOLVED · AVG. RESPONSE. The table follows
 * the document direction and mirrors normally (only plot areas stay LTR). An
 * agent deactivated mid-range still has a historical row — dropping it would
 * make period totals stop reconciling — and it renders with a marker.
 */
export function AgentPerformanceCard({ block }: { block: AgentsBlock }) {
  const { t } = useT('reports');
  return (
    <ReportCard
      title={t('agentPerformance.title')}
      available={block.available}
      emptyMessage={t('agentPerformance.empty')}
    >
      <table className="rp-agents">
        <thead>
          <tr>
            <th scope="col">{t('agentPerformance.columns.agent')}</th>
            <th scope="col" className="rp-num">
              {t('agentPerformance.columns.resolved')}
            </th>
            <th scope="col" className="rp-num">
              {t('agentPerformance.columns.avgResponse')}
            </th>
          </tr>
        </thead>
        <tbody>
          {block.items.map((row) => (
            <tr key={row.user_id}>
              <td>
                {row.name}
                {row.deactivated && <span className="rp-agent-inactive"> {t('agentPerformance.deactivated')}</span>}
              </td>
              <td className="rp-num" dir="ltr">
                {row.resolved}
              </td>
              <td className="rp-num" dir="ltr">
                {formatMinutes(row.avg_response_minutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReportCard>
  );
}
