import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { DataTableError } from '../../../components/data-table/DataTableError';
import { useT } from '../../../i18n';
import { useSystemSettings, useUpdateSystemSettings } from '../hooks/useSystemSettings';
import { buildSettingsSchema, type SettingsFormValues } from '../model/settingsSchema';
import type { SystemSetting } from '../model/adminUser';

/**
 * System configuration.
 *
 * The client validation is built from the SERVER's own metadata — each setting
 * ships its min/max — so the two cannot drift. It is still only a
 * convenience: a password minimum length of 0 is rejected by
 * UpdateSettingsRequest regardless of what reaches it, and this page renders
 * the server's field error when a client check is bypassed.
 */
export const SystemSettingsPage: React.FC = () => {
  const { t } = useT('users');
  const { data: settings, isLoading, isError, refetch } = useSystemSettings();
  const update = useUpdateSystemSettings();

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => buildSettingsSchema(settings ?? [], t), [settings, t]);

  const defaultValues = useMemo(
    () => Object.fromEntries((settings ?? []).map((s) => [s.key, s.value])) as SettingsFormValues,
    [settings]
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // The form is mounted before the query resolves, so its defaults have to be
  // re-seeded once the real values arrive.
  useEffect(() => {
    if (settings) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const onSubmit = async (values: SettingsFormValues) => {
    setFormError(null);
    setSavedAt(null);
    try {
      const result = await update.mutateAsync(values);
      reset(Object.fromEntries(result.data.map((s) => [s.key, s.value])) as SettingsFormValues);
      setSavedAt(
        result.changed.length === 0
          ? t('settings.noChanges')
          : t('settings.savedCount', { count: result.changed.length })
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const fieldErrors = (error.response.data?.errors ?? {}) as Record<string, string[]>;
        let attached = false;
        // The server keys its errors as `settings.<key>`; strip the prefix so
        // they land on the field the Administrator is looking at.
        Object.entries(fieldErrors).forEach(([path, messages]) => {
          const key = path.replace(/^settings\./, '');
          if (settings?.some((s) => s.key === key)) {
            setError(key as keyof SettingsFormValues, { message: messages[0] });
            attached = true;
          }
        });
        if (!attached) setFormError(error.response.data?.message ?? t('settings.saveFailed'));
        return;
      }
      setFormError(t('settings.genericError'));
    }
  };

  if (isError) {
    return (
      <div className="settings-page">
        <div className="page-title-row">
          <h1>{t('settings.title')}</h1>
        </div>
        <div className="table-card">
          <DataTableError onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-title-row">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
        <div className="page-title-actions">
          <Link to="/users" className="dt-btn dt-btn-outline fv">
            {t('settings.backToUsers')}
          </Link>
        </div>
      </div>

      <div className="table-card settings-card">
        {isLoading ? (
          <div className="settings-skeleton">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="settings-row">
                <span className="sk" style={{ width: 200, height: 14 }} />
                <span className="sk" style={{ width: 120, height: 32, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        ) : (settings ?? []).length === 0 ? (
          <p className="settings-empty">{t('settings.empty')}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {(settings as SystemSetting[]).map((setting) => (
              <div key={setting.key} className="settings-row">
                <div className="settings-row-label">
                  <label htmlFor={`setting-${setting.key}`}>{setting.label}</label>
                  <p className="form-hint">{setting.help}</p>
                </div>
                <div className="settings-row-control">
                  <input
                    id={`setting-${setting.key}`}
                    type="number"
                    inputMode="numeric"
                    dir="ltr"
                    min={setting.min ?? undefined}
                    max={setting.max ?? undefined}
                    aria-describedby={`setting-${setting.key}-bounds`}
                    {...register(setting.key)}
                  />
                  <span id={`setting-${setting.key}-bounds`} className="settings-bounds">
                    {setting.min !== null && setting.max !== null
                      ? t('settings.rangeBounds', { min: setting.min, max: setting.max })
                      : setting.min !== null
                        ? t('settings.minOnly', { min: setting.min })
                        : ''}
                  </span>
                  {errors[setting.key] && (
                    <p className="form-error">{String(errors[setting.key]?.message)}</p>
                  )}
                </div>
              </div>
            ))}

            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            {savedAt && (
              <p className="form-success" role="status">
                {savedAt}
              </p>
            )}

            <div className="modal-footer modal-footer-end">
              <button
                type="button"
                className="dt-btn dt-btn-outline fv"
                disabled={!isDirty}
                onClick={() => reset(defaultValues)}
              >
                {t('settings.reset')}
              </button>
              <button
                type="submit"
                className="dt-btn dt-btn-primary fv"
                disabled={isSubmitting || update.isPending}
              >
                {isSubmitting || update.isPending ? t('settings.saving') : t('settings.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
