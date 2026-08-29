// The Reports payload — one response, one range, every widget renders from it.
// Mirrors App\Http\Resources\ReportSummaryResource on the API.

export type TicketVolumePoint = { date: string; created: number; resolved: number };

export type TicketVolumeBlock = {
  available: boolean;
  points: TicketVolumePoint[];
};

export type SlaBlock = {
  available: boolean;
  compliance_rate: number | null;
  target_rate: number;
  breach_rate: number | null;
  avg_resolution_minutes: number | null;
};

export type ChannelItem = {
  channel: string;
  label: string;
  count: number;
  percent: number;
};

export type ChannelsBlock = { available: boolean; items: ChannelItem[] };

export type AgentRow = {
  user_id: number;
  name: string;
  deactivated: boolean;
  resolved: number;
  avg_response_minutes: number | null;
};

export type AgentsBlock = { available: boolean; items: AgentRow[] };

export type CsatAgentRow = {
  user_id: number | null;
  name: string;
  response_count: number;
  average: number;
};

// Story 13 wires this. `available: false` + `reason` is Story 12's original
// Empty shape and still what a zero-response period returns; the aggregate
// keys appear only when `available` is true.
export type CsatBlock = {
  available: boolean;
  reason?: string | null;
  average?: number;
  response_count?: number;
  by_agent?: CsatAgentRow[];
};

export type ReportSummary = {
  range: { from: string; to: string };
  ticket_volume: TicketVolumeBlock;
  sla: SlaBlock;
  channels: ChannelsBlock;
  agents: AgentsBlock;
  csat: CsatBlock;
};

/** Range presets, in days. 30 is the default and matches "Last 30 days". */
export const RANGE_PRESETS = [7, 30, 90] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const DEFAULT_PRESET: RangePreset = 30;

/** ISO date (YYYY-MM-DD) in local time — the format the API expects. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** [from, to] for a preset ending today. */
export function presetRange(days: number, today = new Date()): { from: string; to: string } {
  const to = new Date(today);
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** Which preset (if any) a from/to pair corresponds to — for the picker's active state. */
export function matchPreset(from: string, to: string, today = new Date()): RangePreset | null {
  for (const p of RANGE_PRESETS) {
    const r = presetRange(p, today);
    if (r.from === from && r.to === to) return p;
  }
  return null;
}

/** "11m", "1h 05m", "2d 3h" — the artboard's compact duration format. */
export function formatMinutes(total: number | null): string {
  if (total == null) return '—';
  if (total < 60) return `${Math.round(total)}m`;
  const mins = Math.round(total);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rem = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${String(rem).padStart(2, '0')}m`;
}

/** Short axis tick label, e.g. "Jul 24". */
export function formatDayTick(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
