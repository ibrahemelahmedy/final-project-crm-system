import { RANGE_PRESETS } from '../model/report';
import { useReportRange } from '../hooks/useReportRange';

const LABELS: Record<number, string> = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
};

/**
 * The range control from the artboard ("Last 30 days"). Writes `from`/`to` to
 * URL search params; every figure on the page recomputes from that single
 * range. Follows the document direction — this is card chrome, not a plot.
 */
export function RangePicker() {
  const { from, to, preset, setPreset, setRange } = useReportRange();

  return (
    <div className="rp-range" role="group" aria-label="Report date range">
      <div className="rp-range-presets">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`rp-range-preset${preset === p ? ' is-active' : ''}`}
            aria-pressed={preset === p}
            onClick={() => setPreset(p)}
          >
            {LABELS[p]}
          </button>
        ))}
      </div>
      <div className="rp-range-custom">
        <label>
          <span className="tq-sr-only">From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setRange(e.target.value, to)}
          />
        </label>
        <span aria-hidden="true">–</span>
        <label>
          <span className="tq-sr-only">To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && setRange(from, e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
