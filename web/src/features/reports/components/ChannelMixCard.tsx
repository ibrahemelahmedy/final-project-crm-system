import type { ChannelsBlock } from '../model/report';
import { ReportCard } from './ReportCard';

/**
 * A proportional breakdown listing each channel with its share. The percentage
 * is printed next to every row — the bar is a visual aid, not the only way to
 * read the value, and state is never encoded in colour alone.
 */
export function ChannelMixCard({ block }: { block: ChannelsBlock }) {
  return (
    <ReportCard
      title="Tickets by Channel"
      available={block.available}
      emptyMessage="No tickets were received on any channel in this date range."
    >
      <ul className="rp-channels">
        {block.items.map((item) => (
          <li key={item.channel} className="rp-channel-row">
            <span className="rp-channel-label">{item.label}</span>
            <span className="rp-channel-bar" aria-hidden="true">
              <span className="rp-channel-fill" style={{ inlineSize: `${item.percent}%` }} />
            </span>
            <span className="rp-channel-percent" dir="ltr">
              {item.percent}%
            </span>
          </li>
        ))}
      </ul>
    </ReportCard>
  );
}
