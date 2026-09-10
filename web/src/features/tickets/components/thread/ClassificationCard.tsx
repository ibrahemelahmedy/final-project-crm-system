import type { Ticket } from '../../model/ticket';
import { useT } from '../../../../i18n';
import {
  useDismissClassification,
  useTicketAttributeMutation,
} from '../../hooks/useTicketAttributeMutation';

/**
 * The relabelled TAGS block (Product rules). Two real chips — the ticket's
 * category and channel labels.
 *
 * Story 24 (WIS-23), Task 24. Below the chips, the AI classification: a
 * suggestion row when the proposal differs from the live values, a "needs
 * triage" pill when the assistant wasn't confident, nothing when the
 * suggestion already matches. Applying is the existing
 * PATCH /api/tickets/{id} (Decision 4).
 *
 * Story 27 (WIS-28) styles this card; the render conditions above are frozen.
 */
export function ClassificationCard({ ticket }: { ticket: Ticket }) {
  const { t } = useT('conversation');
  const apply = useTicketAttributeMutation(ticket.id);
  const dismiss = useDismissClassification(ticket.id);

  const ai = ticket.ai_classification;
  const hasSuggestion = !!ai && ai.suggested_category !== null && ai.suggested_priority !== null;
  const differs =
    hasSuggestion &&
    (ai!.suggested_category !== ticket.category || ai!.suggested_priority !== ticket.priority);

  return (
    <section>
      <p className="meta-section-label">{t('section.classification')}</p>
      <div className="classification-chips">
        <span className="classification-chip">{ticket.category_label}</span>
        <span className="classification-chip">{ticket.channel_label}</span>
      </div>

      {ai && ai.needs_triage && !hasSuggestion && (
        <div className="classification-ai" role="status">
          <div className="classification-ai-head">
            <span className="assist-chip" dir="ltr">AI</span>
            <span className="classification-chip classification-chip-triage">
              {t('classification.needsTriage')}
            </span>
          </div>
          <p className="classification-ai-note">{t('classification.notConfident')}</p>
          <div className="classification-ai-actions">
            <button
              type="button"
              className="classification-ai-btn"
              onClick={() => dismiss.mutate()}
              disabled={dismiss.isPending}
            >
              {t('classification.dismiss')}
            </button>
          </div>
        </div>
      )}

      {differs && ai && (
        <div className="classification-ai" role="status">
          <span className="assist-chip" dir="ltr">AI</span>
          <p className="classification-ai-note">
            {t('classification.suggested', {
              category: ai.suggested_category_label,
              priority: ai.suggested_priority_label,
            })}
          </p>
          {ai.confidence !== null && (
            <p className="classification-ai-note classification-ai-note--meta">
              {t('classification.confidence', { percent: Math.round(ai.confidence * 100) })}
            </p>
          )}
          <div className="classification-ai-actions">
            <button
              type="button"
              className="classification-ai-btn classification-ai-btn--apply"
              onClick={() =>
                apply.mutate({
                  category: ai.suggested_category!,
                  priority: ai.suggested_priority!,
                })
              }
              disabled={apply.isPending}
            >
              {apply.isPending ? t('classification.applying') : t('classification.apply')}
            </button>
            <button
              type="button"
              className="classification-ai-btn"
              onClick={() => dismiss.mutate()}
              disabled={dismiss.isPending}
            >
              {t('classification.dismiss')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
