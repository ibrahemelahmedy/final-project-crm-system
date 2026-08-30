import { useT } from '../../../i18n';
import { PriorityBadge } from '../../tickets/components/PriorityBadge';
import { formatDuration } from '../model/formatDuration';
import type { SlaRule } from '../model/types';

type Props = { rule: SlaRule; onEdit: (rule: SlaRule) => void };

/** The export's pencil path, at 14px. */
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l11-11-4-4L4 16z M14.5 5.5l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One rule, one card. The tier signal is the 4px accent edge plus the reused
 * Story 04 PriorityBadge — never a second priority chip (brief.md line 217).
 *
 * The accent edge is a single `border-inline-start` declaration, so RTL
 * mirrors it with no `[dir="rtl"]` override and no second stylesheet. The RTL
 * artboard hand-mirrors border-left → border-right; the logical property is
 * what makes that unnecessary.
 */
export function SlaRuleCard({ rule, onEdit }: Props) {
  const { t } = useT('sla');

  const actionTone =
    rule.priority === 'urgent' ? 'urgent' : rule.priority === 'high' ? 'high' : 'muted';

  return (
    <article
      className={`slar-card slar-card-${rule.priority}${rule.is_active ? '' : ' slar-card-inactive'}`}
    >
      <div className="slar-tier">
        <PriorityBadge priority={rule.priority} label={rule.priority_label} />
        {/* A text chip, not opacity alone — colour is never the only signal. */}
        {!rule.is_active && <span className="slar-inactive-chip">{t('inactive')}</span>}
      </div>

      <div className="slar-facts">
        <div className="slar-fact">
          <span className="slar-fact-label">{t('facts.respondWithin')}</span>
          <span className="slar-fact-value">
            {formatDuration(rule.first_response_minutes, t)}
          </span>
        </div>
        <div className="slar-fact">
          <span className="slar-fact-label">{t('facts.resolveWithin')}</span>
          <span className="slar-fact-value">{formatDuration(rule.resolution_minutes, t)}</span>
        </div>
        <div className="slar-fact">
          <span className="slar-fact-label">{t('facts.onBreach')}</span>
          <span className={`slar-fact-action slar-action-${actionTone}`}>
            <PencilIcon />
            {rule.breach_action_label}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="slar-edit"
        // The export's button has no accessible name at all; that is a defect,
        // not a design.
        aria-label={t('editRule', { tier: rule.priority_label })}
        onClick={() => onEdit(rule)}
      >
        <PencilIcon />
      </button>
    </article>
  );
}
