import { CHANNEL_PERIODS, PERIOD_LABELS } from '../model/channel';
import { useChannelPeriod } from '../hooks/useChannelPeriod';

/**
 * The segmented period control from the artboard. Writes the choice to the
 * `?period=` URL search param and reads its active state from there. This is
 * card chrome — it follows the document direction and mirrors under RTL.
 */
export function PeriodSelector() {
  const { period, setPeriod } = useChannelPeriod();

  return (
    <div className="ch-periods" role="group" aria-label="Ticket count period">
      {CHANNEL_PERIODS.map((option) => (
        <button
          key={option}
          type="button"
          className={`ch-period${period === option ? ' is-active' : ''}`}
          aria-pressed={period === option}
          onClick={() => setPeriod(option)}
        >
          {PERIOD_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
