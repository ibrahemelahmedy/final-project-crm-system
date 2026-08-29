import type { TicketChannel } from '../model/ticket';
import { CHANNEL_FALLBACK_LABELS, CHANNEL_ICON_PATHS } from '../model/display';

type Props = { channel: TicketChannel; label?: string; size?: number };

/**
 * The glyph carries `role="img"` and the channel's label as its accessible
 * name. Colour is not the only signal (brief.md 196) — the icon shape plus its
 * label is what identifies the channel.
 */
export function ChannelIcon({ channel, label, size = 15 }: Props) {
  const name = label ?? CHANNEL_FALLBACK_LABELS[channel];
  return (
    <svg
      className="tq-channel-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={name}
    >
      <path d={CHANNEL_ICON_PATHS[channel]} />
    </svg>
  );
}
