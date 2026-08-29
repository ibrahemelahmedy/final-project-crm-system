import React, { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { Modal } from '../../../components/ui/Modal';
import { ROLE_LABELS, USER_ROLES, type AdminUser } from '../model/adminUser';
import { inviteUserSchema, type InviteUserFormValues } from '../model/userSchema';
import { useInviteUser, useUpdateUser } from '../hooks/useUserMutations';

function toFormValues(user?: AdminUser): InviteUserFormValues {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    // No blank default. An unselected role is not a state this form can be in
    // — the create AC is that a user is never role-less, and a '' default is
    // how that leaks through as a 422 the Administrator has to discover.
    role: user?.role ?? 'agent',
    department: user?.department ?? '',
  };
}

/**
 * One component for both invite and edit, keyed by an optional `user` prop —
 * the same shape as Story 03's CustomerFormModal, from
 * docs/design/references/5.Modals/.
 *
 * Validation comes from `inviteUserSchema`; there is no second copy of the
 * rules here.
 */
export const UserFormModal: React.FC<{
  open: boolean;
  user?: AdminUser;
  onClose: () => void;
  onSaved?: (user: AdminUser) => void;
}> = ({ open, user, onClose, onSaved }) => {
  const isEdit = Boolean(user);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: toFormValues(user),
  });

  useEffect(() => {
    if (open) reset(toFormValues(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const inviteMutation = useInviteUser();
  const updateMutation = useUpdateUser(user?.id ?? 0);
  const isPending = inviteMutation.isPending || updateMutation.isPending;

  const [formError, setFormError] = React.useState<string | null>(null);

  const handleServerError = (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 422) {
      setFormError('Something went wrong. Try again.');
      return;
    }
    const payload = error.response.data ?? {};
    const fieldErrors = payload.errors as Record<string, string[]> | undefined;
    let attached = false;

    if (fieldErrors) {
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        if (['name', 'email', 'role', 'department'].includes(field)) {
          setError(field as keyof InviteUserFormValues, { message: messages[0] });
          attached = true;
        }
      });
    }

    // A server error with no matching field — the last-Administrator rule
    // arrives on `role`, but anything else must still be visible rather than
    // vanish into a silent no-op.
    if (!attached) setFormError(payload.message ?? 'The change could not be saved.');
  };

  const onSubmit = async (values: InviteUserFormValues) => {
    setFormError(null);
    try {
      const saved = isEdit ? await updateMutation.mutateAsync(values) : await inviteMutation.mutateAsync(values);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      handleServerError(error);
    }
  };

  const titleId = isEdit ? 'edit-user-title' : 'invite-user-title';

  return (
    <Modal open={open} onClose={onClose} titleId={titleId} title={isEdit ? 'Edit User' : 'Invite User'}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-field">
          <label htmlFor="user-name">Name</label>
          <input id="user-name" {...register('name')} />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="user-email">Email</label>
          <input id="user-email" type="email" dir="ltr" {...register('email')} />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="user-role">Role</label>
          {/*
            No blank <option>. Every user has exactly one role, so there is no
            "unselected" value to offer — the select opens on a real role.
          */}
          <select id="user-role" {...register('role')}>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {errors.role && <p className="form-error">{errors.role.message}</p>}
          <p className="form-hint">Every user has exactly one role.</p>
        </div>

        <div className="form-field">
          <label htmlFor="user-department">Department</label>
          <input id="user-department" {...register('department')} placeholder="Optional" />
          {errors.department && <p className="form-error">{errors.department.message}</p>}
        </div>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="modal-footer modal-footer-end">
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="dt-btn dt-btn-primary fv" disabled={isSubmitting || isPending}>
            {isSubmitting || isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Send Invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
