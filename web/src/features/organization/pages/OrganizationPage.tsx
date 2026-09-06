import { Link, Navigate, useParams } from 'react-router-dom';
import { useT } from '../../../i18n';
import { BranchesTab } from '../components/BranchesTab';
import { DepartmentsTab } from '../components/DepartmentsTab';
import { BrandingTab } from '../components/BrandingTab';

const TABS = ['branches', 'departments', 'branding'] as const;
type Tab = (typeof TABS)[number];

const TAB_PATH: Record<Tab, string> = {
  branches: '/organization',
  departments: '/organization/departments',
  branding: '/organization/branding',
};

/**
 * OrganizationPage — the tabbed Admin screen for Story 20 (WIS-20). Tab
 * state lives in the URL as a route segment (Decision 11), not component
 * state, so the Departments empty state's "Go to Branches" link is a real
 * href and the tab survives a reload.
 */
export function OrganizationPage() {
  const { t } = useT('organization');
  const { tab: rawTab } = useParams<{ tab?: string }>();
  const tab = (rawTab ?? 'branches') as string;

  if (!TABS.includes(tab as Tab)) {
    return <Navigate to="/organization" replace />;
  }

  const activeTab = tab as Tab;

  return (
    <div className="org-page">
      <div className="page-title-row">
        <div>
          <h1>{t('title')}</h1>
          <p className="page-subtitle">{t('subtitle')}</p>
        </div>
      </div>

      <div className="org-tabs" role="tablist" aria-label={t('tabs.label')}>
        {TABS.map((t2) => (
          <Link
            key={t2}
            to={TAB_PATH[t2]}
            role="tab"
            aria-selected={activeTab === t2}
            className={activeTab === t2 ? 'org-tab org-tab-active' : 'org-tab'}
          >
            {t(`tabs.${t2}`)}
          </Link>
        ))}
      </div>

      {activeTab === 'branches' && <BranchesTab />}
      {activeTab === 'departments' && <DepartmentsTab />}
      {activeTab === 'branding' && <BrandingTab />}
    </div>
  );
}
