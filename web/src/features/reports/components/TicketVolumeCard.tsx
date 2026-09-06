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
import { useT } from '../../../i18n';
import { ReportCard } from './ReportCard';
import { ChartFrame } from './ChartFrame';
import { chartColors } from './chartTheme';

export function TicketVolumeCard({ block }: { block: TicketVolumeBlock }) {
  const { t } = useT('reports');
  return (
    <ReportCard
      title={t('ticketVolume.title')}
      available={block.available}
      emptyMessage={t('ticketVolume.empty')}
    >
      <ChartFrame label={t('ticketVolume.chartLabel')}>
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
              name={t('ticketVolume.created')}
              stroke={chartColors.created}
              strokeWidth={2}
              dot={false}
              isAnimationActive={!prefersReducedMotion()}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              name={t('ticketVolume.resolved')}
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
