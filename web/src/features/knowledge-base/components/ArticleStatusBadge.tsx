import React from 'react';
import type { ArticleStatus } from '../model/article';

/**
 * Draft / Published / Archived. Colour is never the only signal
 * (docs/design/brief.md line 196) — the label carries the meaning and the tint
 * only reinforces it, which is also what makes this legible in dark mode.
 */
export const ArticleStatusBadge: React.FC<{ status: ArticleStatus; label: string }> = ({
  status,
  label,
}) => (
  <span className={`kb-status-badge kb-status-badge--${status}`} data-status={status}>
    {label}
  </span>
);
