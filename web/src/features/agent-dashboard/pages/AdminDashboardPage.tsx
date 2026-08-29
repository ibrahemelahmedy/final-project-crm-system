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
  const summary = useAdminSummary();
  const s = summary.data;
  const err = summary.isError;

  const count = (n: number | undefined, noun: string) =>
    n === undefined ? null : `${n} ${noun}${n === 1 ? '' : 's'}`;

  return (
    <div className="dash-page">
      <header className="dash-head">
        <h1 className="dash-title">Admin overview</h1>
        <p className="dash-subtitle">Platform configuration and oversight</p>
      </header>

      <div className="admin-card-grid">
        <AdminEntryCard
          icon={usersIcon}
          tone="indigo"
          title="User Management"
          subtitle={count(s?.user_count, 'internal user')}
          subtitleError={err}
          cta="Manage users"
          to="/users"
        />
        <AdminEntryCard
          icon={shieldIcon}
          tone="green"
          title="SLA Rule Configuration"
          subtitle={count(s?.active_sla_rule_count, 'active rule')}
          subtitleError={err}
          cta="Configure rules"
          to="/sla-rules"
        />
        <AdminEntryCard
          icon={logIcon}
          tone="amber"
          title="Audit Log"
          subtitle={count(s?.audit_log_count, 'recorded event')}
          subtitleError={err}
          cta="View log"
          // Repointed by Story 08, which owns the audit viewer route.
          to="/users/audit-log"
        />
      </div>
    </div>
  );
}
