import React from 'react';
import { useT } from '../../i18n';

/**
 * Story 15 (WIS-11): `titleKey` is an i18n key (e.g. `common:nav.slaRules`),
 * resolved here so the placeholder heading localizes with the rest of the shell.
 */
export const PagePlaceholder: React.FC<{ titleKey: string }> = ({ titleKey }) => {
  const { t } = useT('common');
  return (
    <div data-testid="page-placeholder">
      <h1>{t(titleKey)}</h1>
      <p>{t('state.featureComingSoon')}</p>
    </div>
  );
};
