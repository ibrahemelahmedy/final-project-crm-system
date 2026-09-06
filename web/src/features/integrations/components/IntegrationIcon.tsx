import type { IntegrationTypeValue } from '../model/types';

// Generic geometry only — no vendor logo, no brand colour (intake
// constraint). Drawn the same way navItems.tsx's icon() helper does:
// stroke="currentColor" so it follows the surrounding text colour in both
// themes with no separate dark-mode asset.
const PATHS: Record<IntegrationTypeValue, string> = {
  erp: 'M4 7h16v10H4z M4 7l8 6 8-6 M8 17v-4 M12 17v-2 M16 17v-6',
  email: 'M4 6h16v12H4z M4 6l8 7 8-7',
  sms: 'M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  whatsapp:
    'M12 3a9 9 0 0 0-7.75 13.55L3 21l4.6-1.2A9 9 0 1 0 12 3z M8.5 8.5c.3-.7 1-1.2 1.7-1 .4.1.7.6 1 1.2.2.5.3 1 .1 1.4-.2.4-.5.6-.4.9.2.7 1.5 2 2.5 2.3.4.1.6-.2.9-.4.4-.2.9-.1 1.4.1.6.3 1.1.6 1.2 1 .2.7-.3 1.4-1 1.7-.8.4-1.8.5-3.5-.2-1.9-.8-3.5-2.4-4.3-4.3-.7-1.7-.6-2.7-.2-3.5z',
  api_webhook: 'M8 8a4 4 0 1 1 0 8 M16 8a4 4 0 1 1 0 8 M8 12h8',
};

/** No vendor logo, no brand colour — generic geometry per type, with a fallback for an unknown value. */
export function IntegrationIcon({ type }: { type: IntegrationTypeValue | string }) {
  const d = PATHS[type as IntegrationTypeValue] ?? 'M12 3v18 M3 12h18';

  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
