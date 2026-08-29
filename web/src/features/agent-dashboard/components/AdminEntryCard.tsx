import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  icon: React.ReactNode;
  tone: 'indigo' | 'green' | 'amber';
  title: string;
  /** Live count subtitle. `null` while loading, string when resolved. */
  subtitle: string | null;
  subtitleError?: boolean;
  cta: string;
  to: string;
};

/**
 * One entry-point card on the Admin dashboard. Links into a management area;
 * the subtitle carries a live count. There is no ticket data on this view.
 */
export function AdminEntryCard({ icon, tone, title, subtitle, subtitleError, cta, to }: Props) {
  return (
    <Link to={to} className="admin-card">
      <span className={`admin-card-icon admin-card-icon-${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="admin-card-body">
        <span className="admin-card-title">{title}</span>
        <span className="admin-card-subtitle">
          {subtitleError ? 'Count unavailable' : (subtitle ?? 'Loading…')}
        </span>
      </span>
      <span className="admin-card-cta">
        {cta}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
