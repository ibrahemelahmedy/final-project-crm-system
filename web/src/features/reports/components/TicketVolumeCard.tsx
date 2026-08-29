import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TicketVolumeBlock } from '../model/report';
import { formatDayTick } from '../model/report';
import { ReportCard } from './ReportCard';
import { ChartFrame } from './ChartFrame';
import { chartColors } from './chartTheme';

export function TicketVolumeCard({ block }: { block: TicketVolumeBlock }) {
  return (
    <ReportCard
      title="Ticket Volume Over Time"
      available={block.available}
      emptyMessage="No tickets were created or resolved in this date range."
    >
      <ChartFrame label="Ticket volume over time — tickets created and resolved per day">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={block.points} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={chartColors.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayTick}
              stroke={chartColors.axis}
              fontSize={12}
              minTickGap={24}
            />
            <YAxis stroke={chartColors.axis} fontSize={12} allowDecimals={false} width={32} />
            <Tooltip labelFormatter={(label) => formatDayTick(String(label))} />
            <Legend />
            <Line
              type="monotone"
              dataKey="created"
              name="Created"
              stroke={chartColors.created}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!prefersReducedMotion()}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              name="Resolved"
              stroke={chartColors.resolved}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!prefersReducedMotion()}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </ReportCard>
  );
}

/** Chart entry animations are disabled under prefers-reduced-motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
