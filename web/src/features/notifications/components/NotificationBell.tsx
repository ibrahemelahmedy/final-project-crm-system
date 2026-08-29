import { useEffect, useRef, useState } from 'react';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { NotificationPanel } from './NotificationPanel';

const BADGE_OVERFLOW_THRESHOLD = 9;

function badgeText(count: number): string {
  return count > BADGE_OVERFLOW_THRESHOLD ? '9+' : String(count);
}

function bellLabel(count: number): string {
  if (count === 0) return 'Notifications, no unread';
  // The exact count is always announced — the 9+ overflow is a VISUAL
  // badge treatment only, never a loss of information for assistive tech.
  return `Notifications, ${count} unread`;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The header bell — trigger plus popup panel. WisalNotifications-*.dc.html
 * "Bell states" and "Success (panel open)". Mirrors AppLayout's sidebar
 * drawer behaviour: Escape closes, focus returns to the trigger, Tab is
 * trapped inside while open.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: unreadCount } = useUnreadCount();
  const count = unreadCount ?? 0;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Escape closes; a click outside the panel and trigger closes too.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => {
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <div className="notif-bell-wrap">
      <button
        type="button"
        ref={triggerRef}
        className="shell-icon-btn notif-bell-trigger"
        data-open={open}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={bellLabel(count)}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7 M9.5 19a2.5 2.5 0 0 0 5 0" />
        </svg>
        {count > 0 && <span className="notif-badge" aria-hidden="true">{badgeText(count)}</span>}
      </button>

      {open && (
        <div id="notification-panel" ref={panelRef} className="notif-panel-anchor">
          <NotificationPanel onRowActivated={close} />
        </div>
      )}
    </div>
  );
}
