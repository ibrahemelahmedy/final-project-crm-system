import type { CSSProperties } from 'react';
import type { TicketSla } from '../../model/ticket';

// Story 06 (SLA Rules) computes sla.minutes_left and sla.risk. Until then the
// API returns nulls and this card renders the "Not configured" branch. Do not
// derive a countdown from created_at — a number that means nothing is worse
// than no number. All four branches ship now so Story 06 changes only the API.

function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function SlaCard({ sla }: { sla: TicketSla }) {
  const risk = sla.risk;
  const tokenName =
    risk === 'breached'
      ? '--sla-breached'
      : risk === 'at_risk'
        ? '--sla-at-risk'
        : risk === 'ok'
          ? '--sla-ok'
          : '--sla-none';

  const style = {
    background: `color-mix(in srgb, var(${tokenName}) 10%, transparent)`,
    borderColor: `color-mix(in srgb, var(${tokenName}) 30%, transparent)`,
  } as CSSProperties;

  let label: string;
  let value: string;
  let ariaLabel: string | undefined;

  if (risk === null) {
    label = 'SLA';
    value = 'Not configured';
    ariaLabel = 'SLA not configured';
  } else if (risk === 'breached') {
    label = 'SLA breached';
    value = sla.minutes_left !== null ? `${formatMinutes(sla.minutes_left)} over` : 'Overdue';
  } else if (risk === 'at_risk') {
    label = 'SLA breach in';
    value = sla.minutes_left !== null ? formatMinutes(sla.minutes_left) : '—';
  } else {
    label = 'SLA due in';
    value = sla.minutes_left !== null ? formatMinutes(sla.minutes_left) : '—';
  }

  return (
    <div className="sla-card" style={style} aria-label={ariaLabel}>
      <span className="sla-card-label" style={{ color: `var(${tokenName})` }}>
        {label}
      </span>
      <span className="sla-card-value" style={{ color: `var(${tokenName})` }} dir="ltr">
        {value}
      </span>
    </div>
  );
}
