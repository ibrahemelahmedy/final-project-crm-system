import React from 'react';
import type { PortalTicketStatus } from '../model/portal';

const TONE: Record<PortalTicketStatus, string> = {
  open: 'portal-status-open',
  pending: 'portal-status-pending',
  resolved: 'portal-status-resolved',
  closed: 'portal-status-closed',
};

/** Colour is never the only signal — the server-localised label carries the meaning too. */
export const RequestStatusBadge: React.FC<{ status: PortalTicketStatus; label: string }> = ({ status, label }) => (
  <span className={`portal-status-badge ${TONE[status]}`}>{label}</span>
);
