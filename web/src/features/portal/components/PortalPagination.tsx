import React from 'react';
import { useT } from '../../../i18n';

/**
 * Story 17 (WIS-16). Pagination state lives in the URL, per the cross-cutting
 * rule in .squad/plans/00-index.md — this control only reports the page it
 * wants; the page owns the search param.
 */
export const PortalPagination: React.FC<{
  currentPage: number;
  lastPage: number;
  onChange: (page: number) => void;
}> = ({ currentPage, lastPage, onChange }) => {
  const { t } = useT('portal');

  if (lastPage <= 1) return null;

  return (
    <nav className="portal-pagination" aria-label={t('ui.page', { current: currentPage, total: lastPage })}>
      <button
        type="button"
        className="portal-link fv"
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        {t('ui.previous')}
      </button>
      <span className="portal-hint" aria-live="polite">
        {t('ui.page', { current: currentPage, total: lastPage })}
      </span>
      <button
        type="button"
        className="portal-link fv"
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage >= lastPage}
      >
        {t('ui.next')}
      </button>
    </nav>
  );
};
