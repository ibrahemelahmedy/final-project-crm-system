import { useT } from '../../../i18n';
import { useAdminSummary } from '../hooks/useDashboardQueries';
import { AdminEntryCard } from '../components/AdminEntryCard';

const usersIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20c.3-3 2.7-5 5.5-5s5.2 2 5.5 5 M18 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
  </svg>
);
const shieldIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9.5 12l1.8 1.8L14.5 10" />
  </svg>
);
const logIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 4h8l4 4v12H4V4z M8 4v4H4 M9 13h6 M9 17h6" />
  </svg>
);

/**
 * Administrator home (`/dashboard/admin`). Entry points into user management,
 * SLA rule configuration and the audit log — and NO ticket queue at all.
 *
 * The audit-log card points at Story 08's `/users/audit-log` viewer.
 */
export function AdminDashboardPage() {
  const { t } = useT('dashboard');
  const summary = useAdminSummary();
  const s = summary.data;
  const err = summary.isError;

  return (
    <div className="dash-page">
      <header className="dash-head">
        <h1 className="dash-title">{t('admin.heading')}</h1>
        <p className="dash-subtitle">{t('admin.subtitle')}</p>
      </header>

      <div className="admin-card-grid">
        <AdminEntryCard
          icon={usersIcon}
          tone="indigo"
          title={t('admin.userManagement')}
          subtitle={s?.user_count === undefined ? null : t('admin.userCount', { count: s.user_count })}
          subtitleError={err}
          cta={t('admin.manageUsers')}
          to="/users"
        />
        <AdminEntryCard
          icon={shieldIcon}
          tone="green"
          title={t('admin.slaRuleConfig')}
          subtitle={
            s?.active_sla_rule_count === undefined
              ? null
              : t('admin.slaRuleCount', { count: s.active_sla_rule_count })
          }
          subtitleError={err}
          cta={t('admin.configureRules')}
          to="/sla-rules"
        />
        <AdminEntryCard
          icon={logIcon}
          tone="amber"
          title={t('admin.auditLog')}
          subtitle={
            s?.audit_log_count === undefined ? null : t('admin.auditLogCount', { count: s.audit_log_count })
          }
          subtitleError={err}
          cta={t('admin.viewLog')}
          // Repointed by Story 08, which owns the audit viewer route.
          to="/users/audit-log"
        />
      </div>
    </div>
  );
}
