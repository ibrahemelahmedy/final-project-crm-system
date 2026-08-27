import type { TicketSla } from '../model/ticket';

type Props = { sla: TicketSla };

// Story 06 (SLA Rules) computes sla.minutes_left and sla.risk. Until then the
// API returns nulls and this cell renders the design's own "no SLA" dash
// (WisalTicketQueue-LightLTR.dc.html line 157). Do not derive a countdown
// from created_at — a number that means nothing is worse than no number.
//
// The three risk branches below are written now and unreachable until Story 06
// lands, so that story changes only the API, never this component.

function formatMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function SlaCell({ sla }: Props) {
  if (sla.risk === null) {
    return (
      <span className="tq-sla tq-sla-none" aria-label="SLA not configured">
        —
      </span>
    );
  }

  const left = sla.minutes_left;
  // Each branch renders TEXT, not just colour — brief.md line 196.
  const text = left === null ? 'No due date' : left < 0 ? `${formatMinutes(left)} over` : formatMinutes(left);
  const risk = sla.risk;
  const label =
    risk === 'breached' ? 'SLA breached' : risk === 'at_risk' ? 'SLA at risk' : 'Within SLA';

  return (
    <span className={`tq-sla tq-sla-${risk}`} title={label}>
      <span className="tq-sr-only">{label}: </span>
      <span dir="ltr" className="tq-ltr">
        {text}
      </span>
    </span>
  );
}
