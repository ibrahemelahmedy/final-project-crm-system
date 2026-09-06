import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useT } from '../../../i18n';
import { Modal } from '../../../components/ui/Modal';
import { useSaveBranch } from '../hooks/useSaveBranch';
import { createBranchSchema, TIMEZONE_OPTIONS, type BranchFormValues } from '../model/branchSchema';
import type { Branch } from '../model/types';

function toFormValues(branch?: Branch): BranchFormValues {
  return {
    name: branch?.name ?? '',
    region: branch?.region ?? '',
    timezone: branch?.timezone ?? 'Asia/Riyadh',
    is_active: branch?.is_active ?? true,
  };
}

/** One component for both Add and Edit, keyed by an optional `branch` prop. */
export function BranchModal({
  open,
  branch,
  onClose,
}: {
  open: boolean;
  branch?: Branch;
  onClose: () => void;
}) {
  const { t } = useT('organization');
  const isEdit = Boolean(branch);
  const schema = useMemo(() => createBranchSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(branch),
  });

  useEffect(() => {
    if (open) reset(toFormValues(branch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branch]);

  const save = useSaveBranch();

  const onSubmit = async (values: BranchFormValues) => {
    try {
      await save.mutateAsync({
        id: branch?.id,
        body: { name: values.name, region: values.region || null, timezone: values.timezone, is_active: values.is_active },
      });
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const fieldErrors = (error.response.data?.errors ?? {}) as Record<string, string[]>;
        Object.entries(fieldErrors).forEach(([field, messages]) => {
          if (field in values) {
            setError(field as keyof BranchFormValues, { message: messages[0] });
          }
        });
      }
    }
  };

  const titleId = isEdit ? 'edit-branch-title' : 'add-branch-title';

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      title={isEdit ? t('branches.editTitle') : t('branches.addTitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-field">
          <label htmlFor="branch-name">{t('branches.field.name')}</label>
          <input id="branch-name" {...register('name')} />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="branch-region">{t('branches.field.region')}</label>
          <input id="branch-region" {...register('region')} />
          {errors.region && <p className="form-error">{errors.region.message}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="branch-timezone">{t('branches.field.timezone')}</label>
          <select id="branch-timezone" {...register('timezone')}>
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {t(tz.labelKey)}
              </option>
            ))}
          </select>
          {errors.timezone && <p className="form-error">{errors.timezone.message}</p>}
        </div>

        <div className="form-field form-field-checkbox">
          <label htmlFor="branch-active">
            <input id="branch-active" type="checkbox" {...register('is_active')} />
            {t('branches.field.active')}
          </label>
        </div>

        <div className="modal-footer modal-footer-end">
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={onClose}>
            {t('actions.cancel')}
          </button>
          <button type="submit" className="dt-btn dt-btn-primary fv" disabled={isSubmitting || save.isPending}>
            {isSubmitting || save.isPending ? t('actions.saving') : t('branches.saveButton')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
