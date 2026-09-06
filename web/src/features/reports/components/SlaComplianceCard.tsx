import type { SlaBlock } from '../model/report';
import { formatMinutes } from '../model/report';
import { useT } from '../../../i18n';
import { ReportCard } from './ReportCard';

/**
 * A single large figure with a "Target: 90%" subline, plus breach rate and
 * average resolution time — every value labelled on the surface, none
 * dependent on a tooltip (brief anti-pattern list).
 */
export function SlaComplianceCard({ block }: { block: SlaBlock }) {
  const { t } = useT('reports');
  const rate = block.compliance_rate;
  return (
    <ReportCard
      title={t('slaCompliance.title')}
      available={block.available && rate != null}
      emptyMessage={t('slaCompliance.empty')}
    >
      <div className="rp-sla">
        <div className="rp-sla-figure">
          <span className="rp-sla-value" dir="ltr">
            {rate != null ? `${Math.round(rate)}%` : '—'}
          </span>
          <span className="rp-sla-target">{t('slaCompliance.target', { rate: Math.round(block.target_rate) })}</span>
        </div>
        <dl className="rp-sla-detail">
          <div>
            <dt>{t('slaCompliance.breachRate')}</dt>
            <dd dir="ltr">{block.breach_rate != null ? `${block.breach_rate}%` : '—'}</dd>
          </div>
          <div>
            <dt>{t('slaCompliance.avgResolutionTime')}</dt>
            <dd dir="ltr">{formatMinutes(block.avg_resolution_minutes)}</dd>
          </div>
        </dl>
      </div>
    </ReportCard>
  );
}
