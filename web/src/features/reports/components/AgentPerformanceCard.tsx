import type { AgentsBlock } from '../model/report';
import { formatMinutes } from '../model/report';
import { ReportCard } from './ReportCard';

/**
 * The artboard's table: AGENT · RESOLVED · AVG. RESPONSE. The table follows
 * the document direction and mirrors normally (only plot areas stay LTR). An
 * agent deactivated mid-range still has a historical row — dropping it would
 * make period totals stop reconciling — and it renders with a marker.
 */
export function AgentPerformanceCard({ block }: { block: AgentsBlock }) {
  return (
    <ReportCard
      title="Agent Performance"
      available={block.available}
      emptyMessage="No agent resolved a ticket in this date range."
    >
      <table className="rp-agents">
        <thead>
          <tr>
            <th scope="col">Agent</th>
            <th scope="col" className="rp-num">
              Resolved
            </th>
            <th scope="col" className="rp-num">
              Avg. Response
            </th>
          </tr>
        </thead>
        <tbody>
          {block.items.map((row) => (
            <tr key={row.user_id}>
              <td>
                {row.name}
                {row.deactivated && <span className="rp-agent-inactive"> · deactivated</span>}
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
