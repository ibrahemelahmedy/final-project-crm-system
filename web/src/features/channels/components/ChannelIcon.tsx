import type { ChannelIconName } from '../model/channel';

// Icon shapes ported from docs/design/references/14.WisalChannels. Colour is
// never the only signal — every card also carries the channel name as text
// and the icon is aria-hidden decoration next to it.
const PATHS: Record<ChannelIconName | 'info', string> = {
  email: 'M2 4h20v16H2z M2 7l10 7 10-7',
  whatsapp:
    'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  sms: 'M5 2h14v20 M9 22v-4h6v4 M9 6h6 M9 10h6',
  web_form: 'M3 3h18v18H3z M9 9h6 M9 13h4',
  generic: 'M4 5h16v10H8l-4 4z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 8v5 M12 16h.01',
};

export function ChannelIcon({
  name,
  size = 18,
}: {
  name: ChannelIconName | 'info';
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
