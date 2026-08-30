import { useT } from '../../../i18n';
import { useSearchParams } from 'react-router-dom';
import { useSlaRules } from '../hooks/useSlaRules';
import { SlaRuleCard } from '../components/SlaRuleCard';
import { SlaRuleFormModal } from '../components/SlaRuleFormModal';
import { SlaRulesSkeleton } from '../components/SlaRulesSkeleton';
import { SlaRulesError } from '../components/SlaRulesError';
import { SlaRulesEmpty } from '../components/SlaRulesEmpty';
import { PRIORITY_TIERS, type PriorityValue, type SlaRule } from '../model/types';

/**
 * SLA Rules (`/sla-rules`, Story 06 / WIS-6). Administrator-only; the route
 * guard in App.tsx is UX only — SlaRulePolicy is the boundary and returns 403
 * to an Agent or a Team Lead.
 *
 * Modal state lives in the URL (`?new=1` / `?edit={id}`), following Story 04's
 * New-Ticket pattern, so a reload and the back button both behave.
 *
 * The card order is the server's — ordered by Priority::sortExpression(). It
 * is deliberately NOT re-sorted here.
 */
export function SlaRulesPage() {
  const { t } = useT('sla');
  const [params, setParams] = useSearchParams();
  const query = useSlaRules();

  const rules = query.data ?? [];
  const activeCount = rules.filter((r) => r.is_active).length;
  const takenTiers = new Set(rules.map((r) => r.priority));
  const availableTiers = PRIORITY_TIERS.filter((tier) => !takenTiers.has(tier));
  const allTiersTaken = availableTiers.length === 0;

  const editId = params.get('edit');
  const isCreating = params.get('new') === '1';
  const editing = editId ? (rules.find((r) => String(r.id) === editId) ?? null) : null;
  const modalOpen = isCreating || editing !== null;

  const openCreate = () => setParams({ new: '1' });
  const openEdit = (rule: SlaRule) => setParams({ edit: String(rule.id) });
  const closeModal = () => setParams({});

  const tierLabels = Object.fromEntries(
    PRIORITY_TIERS.map((tier) => [tier, rules.find((r) => r.priority === tier)?.priority_label ?? tier]),
  ) as Record<PriorityValue, string>;

  return (
    <div className="slar-page">
      <header className="slar-head">
        <div>
          <h1 className="slar-title">{t('title')}</h1>
          {/* Computed from the response, never hardcoded, and pluralised. */}
          <p className="slar-subtitle">{t('subtitle', { count: activeCount })}</p>
        </div>

        <button
          type="button"
          className="slar-btn slar-btn-primary"
          onClick={openCreate}
          disabled={allTiersTaken}
          title={allTiersTaken ? t('allTiersTaken') : undefined}
          aria-describedby={allTiersTaken ? 'slar-add-reason' : undefined}
        >
          {t('addRule')}
        </button>
        {allTiersTaken && (
          <span id="slar-add-reason" className="slar-visually-hidden">
            {t('allTiersTaken')}
          </span>
        )}
      </header>

      {query.isPending && <SlaRulesSkeleton />}

      {query.isError && <SlaRulesError onRetry={() => void query.refetch()} />}

      {!query.isPending && !query.isError && rules.length === 0 && (
        <SlaRulesEmpty onAdd={openCreate} />
      )}

      {!query.isPending && !query.isError && rules.length > 0 && (
        <div className="slar-list">
          {rules.map((rule) => (
            <SlaRuleCard key={rule.id} rule={rule} onEdit={openEdit} />
          ))}
        </div>
      )}

      {modalOpen && (
        <SlaRuleFormModal
          rule={editing}
          availableTiers={availableTiers}
          tierLabels={tierLabels}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
