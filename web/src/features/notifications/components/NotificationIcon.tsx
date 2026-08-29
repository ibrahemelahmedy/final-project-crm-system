import type { NotificationTone } from '../model/notification';

type Props = { tone: NotificationTone };

// One glyph per tone — WisalNotifications-*.dc.html row icons. Tone alone is
// never the only signal (the type label renders as text beside it), but the
// shape still helps a sighted user scan the panel at a glance.
const PATHS: Record<NotificationTone, string> = {
  // Warning — clock (SLA at risk).
  warning: 'M12 7v6l3 3 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  // Danger — alert circle (SLA breached).
  danger: 'M12 8v5 M12 16h.01 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  // Info — at-mention (Mention).
  info: 'M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  // Success — checklist (Task due).
  success: 'M3 5h18v16H3z M16 3v4 M8 3v4 M3 11h18 M9 16l2 2 4-4',
};

export function NotificationIcon({ tone }: Props) {
  return (
    <span className={`notif-icon notif-icon-${tone}`} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[tone]} />
      </svg>
    </span>
  );
}
