import type { SlaBlock } from '../model/report';
import { formatMinutes } from '../model/report';
import { ReportCard } from './ReportCard';

/**
 * A single large figure with a "Target: 90%" subline, plus breach rate and
 * average resolution time — every value labelled on the surface, none
 * dependent on a tooltip (brief anti-pattern list).
 */
export function SlaComplianceCard({ block }: { block: SlaBlock }) {
  const rate = block.compliance_rate;
  return (
    <ReportCard
      title="SLA Compliance Rate"
      available={block.available && rate != null}
      emptyMessage="No tickets with an SLA were resolved in this date range."
    >
      <div className="rp-sla">
        <div className="rp-sla-figure">
          <span className="rp-sla-value" dir="ltr">
            {rate != null ? `${Math.round(rate)}%` : '—'}
          </span>
          <span className="rp-sla-target">Target: {Math.round(block.target_rate)}%</span>
        </div>
        <dl className="rp-sla-detail">
          <div>
            <dt>Breach rate</dt>
            <dd dir="ltr">{block.breach_rate != null ? `${block.breach_rate}%` : '—'}</dd>
          </div>
          <div>
            <dt>Avg. resolution time</dt>
            <dd dir="ltr">{formatMinutes(block.avg_resolution_minutes)}</dd>
          </div>
        </dl>
      </div>
    </ReportCard>
  );
}
