import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { DurationField } from './DurationField';
import { useSaveSlaRule } from '../hooks/useSaveSlaRule';
import { slaRuleSchema, type SlaRuleInput } from '../model/slaRuleSchema';
import type { EscalationRole, PriorityValue, SlaRule } from '../model/types';

type Props = {
  rule: SlaRule | null;
  availableTiers: PriorityValue[];
  tierLabels: Record<PriorityValue, string>;
  onClose: () => void;
};

const DEFAULTS: SlaRuleInput = {
  priority: 'normal',
  first_response_minutes: 60,
  resolution_minutes: 480,
  at_risk_threshold_pct: 80,
  notify_on_breach: true,
  escalation_enabled: false,
  escalate_after_minutes: null,
  escalate_to_role: null,
  auto_close_after_days: 5,
  is_active: true,
};

function toInput(rule: SlaRule): SlaRuleInput {
  return {
    priority: rule.priority,
    first_response_minutes: rule.first_response_minutes,
    resolution_minutes: rule.resolution_minutes,
    at_risk_threshold_pct: rule.at_risk_threshold_pct,
    notify_on_breach: rule.notify_on_breach,
    escalation_enabled: rule.escalation_enabled,
    escalate_after_minutes: rule.escalate_after_minutes,
    escalate_to_role: rule.escalate_to_role,
    auto_close_after_days: rule.auto_close_after_days,
    is_active: rule.is_active,
  };
}

/**
 * The rule editor. Validation comes from slaRuleSchema — the same Zod object
 * that types this form — so the client cannot drift from the server's rules,
 * and its two cross-field messages are byte-identical to the API's.
 *
 * The modal traps focus, closes on Escape, and restores focus to the control
 * that opened it.
 */
export function SlaRuleFormModal({ rule, availableTiers, tierLabels, onClose }: Props) {
  const { t } = useT('sla');
  const save = useSaveSlaRule();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  const [values, setValues] = useState<SlaRuleInput>(() =>
    rule ? toInput(rule) : { ...DEFAULTS, priority: availableTiers[0] ?? 'normal' },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof SlaRuleInput>(key: K, value: SlaRuleInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Remember the opener BEFORE the dialog steals focus, and give it back on unmount.
  useEffect(() => {
    openerRef.current = document.activeElement;
    dialogRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();

    return () => {
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = slaRuleSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        if (!next[path]) next[path] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    save.mutate(
      { id: rule?.id, values: parsed.data },
      {
        onSuccess: onClose,
        onError: (error: unknown) => {
          // Map a 422 onto the fields. Never render a raw error object.
          const response = (error as { response?: { data?: { errors?: Record<string, string[]> } } })
            .response;
          const apiErrors = response?.data?.errors;

          if (apiErrors) {
            setErrors(
              Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]])),
            );
          } else {
            setErrors({ _form: t('form.saveFailed') });
          }
        },
      },
    );
  };

  const tierOptions = rule ? [rule.priority] : availableTiers;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-card slar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slar-modal-title"
        ref={dialogRef}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="slar-modal-title">
            {rule ? t('form.editTitle') : t('form.createTitle')}
          </h2>
          <button type="button" className="slar-icon-btn" onClick={onClose} aria-label={t('form.close')}>
            ×
          </button>
        </div>

        <form className="modal-body" onSubmit={submit} noValidate>
          <div className="form-field">
            <label htmlFor="slar-priority">{t('form.priority')}</label>
            <select
              id="slar-priority"
              value={values.priority}
              // priority is the unique key: an existing rule cannot move tier.
              disabled={rule !== null}
              onChange={(e) => set('priority', e.target.value as PriorityValue)}
            >
              {tierOptions.map((tier) => (
                <option key={tier} value={tier}>
                  {tierLabels[tier]}
                </option>
              ))}
            </select>
          </div>

          <DurationField
            id="slar-response"
            label={t('form.respondWithin')}
            value={values.first_response_minutes}
            onChange={(m) => set('first_response_minutes', m ?? 1)}
            error={errors.first_response_minutes}
          />

          <DurationField
            id="slar-resolution"
            label={t('form.resolveWithin')}
            value={values.resolution_minutes}
            onChange={(m) => set('resolution_minutes', m ?? 1)}
            error={errors.resolution_minutes}
          />

          <div className="form-field">
            <label htmlFor="slar-threshold">{t('form.atRisk')}</label>
            <div className="slar-duration">
              <input
                id="slar-threshold"
                type="number"
                min={1}
                max={99}
                value={values.at_risk_threshold_pct}
                aria-describedby="slar-threshold-help"
                onChange={(e) => set('at_risk_threshold_pct', Number(e.target.value))}
              />
              <span className="slar-suffix">%</span>
            </div>
            <span id="slar-threshold-help" className="form-hint">
              {t('form.atRiskHelp')}
            </span>
            {errors.at_risk_threshold_pct && (
              <span className="form-error">{errors.at_risk_threshold_pct}</span>
            )}
          </div>

          <label className="slar-check">
            <input
              type="checkbox"
              checked={values.notify_on_breach}
              onChange={(e) => set('notify_on_breach', e.target.checked)}
            />
            {t('form.notifyOnBreach')}
          </label>

          <label className="slar-check">
            <input
              type="checkbox"
              checked={values.escalation_enabled}
              onChange={(e) => {
                set('escalation_enabled', e.target.checked);
                if (!e.target.checked) {
                  set('escalate_to_role', null);
                  set('escalate_after_minutes', null);
                }
              }}
            />
            {t('form.escalate')}
          </label>

          {values.escalation_enabled && (
            <>
              <div className="form-field">
                <label htmlFor="slar-escalate-to">{t('form.escalateTo')}</label>
                <select
                  id="slar-escalate-to"
                  value={values.escalate_to_role ?? ''}
                  onChange={(e) =>
                    set('escalate_to_role', (e.target.value || null) as EscalationRole | null)
                  }
                >
                  <option value="">—</option>
                  <option value="team_lead">{t('roles.team_lead')}</option>
                  <option value="administrator">{t('roles.administrator')}</option>
                </select>
                {errors.escalate_to_role && (
                  <span className="form-error">{errors.escalate_to_role}</span>
                )}
              </div>

              <DurationField
                id="slar-escalate-after"
                label={t('form.escalateAfter')}
                help={t('form.escalateAfterHelp')}
                value={values.escalate_after_minutes}
                onChange={(m) => set('escalate_after_minutes', m)}
                error={errors.escalate_after_minutes}
                clearable
              />
            </>
          )}

          <div className="form-field">
            <label htmlFor="slar-autoclose">{t('form.autoClose')}</label>
            <div className="slar-duration">
              <input
                id="slar-autoclose"
                type="number"
                min={1}
                max={365}
                value={values.auto_close_after_days ?? ''}
                onChange={(e) =>
                  set('auto_close_after_days', e.target.value === '' ? null : Number(e.target.value))
                }
              />
              <span className="slar-suffix">{t('form.autoCloseUnit')}</span>
            </div>
            {errors.auto_close_after_days && (
              <span className="form-error">{errors.auto_close_after_days}</span>
            )}
          </div>

          <label className="slar-check">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
            />
            {t('form.active')}
          </label>

          {errors._form && (
            <span className="form-error" role="alert">
              {errors._form}
            </span>
          )}

          <div className="modal-footer modal-footer-end">
            <button type="button" className="slar-btn" onClick={onClose}>
              {t('form.cancel')}
            </button>
            <button type="submit" className="slar-btn slar-btn-primary" disabled={save.isPending}>
              {save.isPending ? t('form.saving') : t('form.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
