import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useT } from '../../../i18n';
import { Modal } from '../../../components/ui/Modal';
import { useSaveDepartment } from '../hooks/useSaveDepartment';
import { createDepartmentSchema, type DepartmentFormValues } from '../model/departmentSchema';
import type { Branch, Department } from '../model/types';

function toFormValues(department?: Department, branches?: Branch[]): DepartmentFormValues {
  return {
    branch_id: department?.branch_id ?? branches?.[0]?.id ?? 0,
    name: department?.name ?? '',
    is_active: department?.is_active ?? true,
  };
}

/**
 * One component for both Add and Edit. When `branches` is empty (the
 * no-branch-yet state), the Branch select is disabled with a single
 * "No branches available" option and Save is disabled — a submit that
 * would only ever come back as SaveDepartmentRequest's 422 is never
 * offered in the first place.
 */
export function DepartmentModal({
  open,
  department,
  branches,
  onClose,
}: {
  open: boolean;
  department?: Department;
  branches: Branch[];
  onClose: () => void;
}) {
  const { t } = useT('organization');
  const isEdit = Boolean(department);
  const hasBranches = branches.length > 0;
  const schema = useMemo(() => createDepartmentSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(department, branches),
  });

  useEffect(() => {
    if (open) reset(toFormValues(department, branches));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, department, branches]);

  const save = useSaveDepartment();

  const onSubmit = async (values: DepartmentFormValues) => {
    try {
      await save.mutateAsync({
        id: department?.id,
        body: { branch_id: values.branch_id, name: values.name, is_active: values.is_active },
      });
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const fieldErrors = (error.response.data?.errors ?? {}) as Record<string, string[]>;
        Object.entries(fieldErrors).forEach(([field, messages]) => {
          if (field in values) {
            setError(field as keyof DepartmentFormValues, { message: messages[0] });
          }
        });
      }
    }
  };

  const titleId = isEdit ? 'edit-department-title' : 'add-department-title';

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      title={isEdit ? t('departments.editTitle') : t('departments.addTitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-field">
          <label htmlFor="department-name">{t('departments.field.name')}</label>
          <input id="department-name" {...register('name')} />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="department-branch">{t('departments.field.branch')}</label>
          {hasBranches ? (
            <select id="department-branch" {...register('branch_id', { valueAsNumber: true })}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <select id="department-branch" disabled defaultValue="">
                <option value="">{t('departments.field.noBranchesAvailable')}</option>
              </select>
              <p className="form-hint">{t('departments.field.branchUnavailableHint')}</p>
            </>
          )}
          {errors.branch_id && <p className="form-error">{errors.branch_id.message}</p>}
        </div>

        <div className="form-field form-field-checkbox">
          <label htmlFor="department-active">
            <input id="department-active" type="checkbox" {...register('is_active')} />
            {t('departments.field.active')}
          </label>
        </div>

        <div className="modal-footer modal-footer-end">
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={onClose}>
            {t('actions.cancel')}
          </button>
          <button
            type="submit"
            className="dt-btn dt-btn-primary fv"
            disabled={!hasBranches || isSubmitting || save.isPending}
          >
            {isSubmitting || save.isPending ? t('actions.saving') : t('departments.saveButton')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
