import { useReportRange } from '../hooks/useReportRange';
import { useReportSummary } from '../hooks/useReportSummary';
import { RangePicker } from '../components/RangePicker';
import { TicketVolumeCard } from '../components/TicketVolumeCard';
import { SlaComplianceCard } from '../components/SlaComplianceCard';
import { ChannelMixCard } from '../components/ChannelMixCard';
import { AgentPerformanceCard } from '../components/AgentPerformanceCard';
import { CsatCard } from '../components/CsatCard';
import type { ReportSummary } from '../model/report';

/**
 * Management Reports dashboard (`/reports`, Story 12). Team Lead / Administrator
 * only — the API returns 403 for an Agent regardless of this route's guard.
 *
 * ONE query for the whole page (`useReportSummary`), keyed by the range in the
 * URL. A range change refetches everything at once, so no widget can show a
 * different, stale range. Five named cards — no metric sprawl, no sixth widget.
 */
export function ReportsPage() {
  const { from, to } = useReportRange();
  const query = useReportSummary(from, to);

  return (
    <div className="rp-page">
      <header className="rp-head">
        <h1 className="rp-title">Reports</h1>
        <RangePicker />
      </header>

      {query.isPending && <LoadingState />}

      {query.isError && (
        <div className="rp-state rp-state-error" role="alert">
          <p>The report couldn&apos;t load.</p>
          <button type="button" className="rp-retry" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      )}

      {query.isSuccess && (isAllEmpty(query.data) ? <EmptyState /> : <Cards data={query.data} />)}
    </div>
  );
}

function isAllEmpty(d: ReportSummary): boolean {
  return (
    !d.ticket_volume.available &&
    !d.sla.available &&
    !d.channels.available &&
    !d.agents.available &&
    !d.csat.available
  );
}

function Cards({ data }: { data: ReportSummary }) {
  return (
    <div className="rp-grid">
      <TicketVolumeCard block={data.ticket_volume} />
      <SlaComplianceCard block={data.sla} />
      <ChannelMixCard block={data.channels} />
      <AgentPerformanceCard block={data.agents} />
      <CsatCard block={data.csat} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rp-grid" role="status" aria-label="Loading report">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rp-card rp-card-skeleton">
          <span className="rp-skeleton-row" />
          <span className="rp-skeleton-row" />
          <span className="rp-skeleton-row" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rp-state rp-state-empty">
      <p>No ticket activity in this date range yet. Pick a wider range to see report figures.</p>
    </div>
  );
}
