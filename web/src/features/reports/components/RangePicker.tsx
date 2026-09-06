import { RANGE_PRESETS } from '../model/report';
import { useReportRange } from '../hooks/useReportRange';
import { useT } from '../../../i18n';

const LABEL_KEYS: Record<number, string> = {
  7: 'range.last7',
  30: 'range.last30',
  90: 'range.last90',
};

/**
 * The range control from the artboard ("Last 30 days"). Writes `from`/`to` to
 * URL search params; every figure on the page recomputes from that single
 * range. Follows the document direction — this is card chrome, not a plot.
 */
export function RangePicker() {
  const { t } = useT('reports');
  const { from, to, preset, setPreset, setRange } = useReportRange();

  return (
    <div className="rp-range" role="group" aria-label={t('range.ariaLabel')}>
      <div className="rp-range-presets">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`rp-range-preset${preset === p ? ' is-active' : ''}`}
            aria-pressed={preset === p}
            onClick={() => setPreset(p)}
          >
            {t(LABEL_KEYS[p])}
          </button>
        ))}
      </div>
      <div className="rp-range-custom">
        <label>
          <span className="tq-sr-only">{t('range.from')}</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setRange(e.target.value, to)}
          />
        </label>
        <span aria-hidden="true">–</span>
        <label>
          <span className="tq-sr-only">{t('range.to')}</span>
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
