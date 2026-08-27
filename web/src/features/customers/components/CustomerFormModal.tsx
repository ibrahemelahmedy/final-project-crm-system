import React, { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import axios from 'axios';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { customerSchema, type CustomerFormValues } from '../model/customerSchema';
import { CUSTOMER_TIERS, type Customer, type CustomerTier } from '../model/customer';
import { useCreateCustomer, useDeleteCustomer, useUpdateCustomer } from '../hooks/useCustomerMutations';

const TIER_LABELS: Record<CustomerTier, string> = {
  standard: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

function toFormValues(customer?: Customer): CustomerFormValues {
  return {
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    company: customer?.company ?? '',
    tier: customer?.tier ?? 'standard',
  };
}

// From WisalModals-LightLTR.dc.html lines 109-136. One component for both
// create and edit, keyed by an optional `customer` prop.
export const CustomerFormModal: React.FC<{
  open: boolean;
  customer?: Customer;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
  onDeleted?: () => void;
  onOpenDuplicate?: (id: number) => void;
}> = ({ open, customer, onClose, onSaved, onDeleted, onOpenDuplicate }) => {
  const isEdit = Boolean(customer);
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: toFormValues(customer),
  });

  const [duplicate, setDuplicate] = useState<{ id: number; name: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (open) {
      reset(toFormValues(customer));
      setDuplicate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer(customer?.id ?? 0);
  const deleteMutation = useDeleteCustomer();

  const isPending = createMutation.isPending || updateMutation.isPending;
  const tier = watch('tier');

  const handleServerError = (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 422) {
      return;
    }
    const payload = error.response.data ?? {};
    const fieldErrors = payload.errors as Record<string, string[]> | undefined;
    if (fieldErrors) {
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        setError(field as keyof CustomerFormValues, { message: messages[0] });
      });
    }
    if (payload.duplicate_customer_id) {
      setDuplicate({ id: payload.duplicate_customer_id, name: payload.duplicate_customer_name });
    }
  };

  const onSubmit = async (values: CustomerFormValues) => {
    setDuplicate(null);
    try {
      // Do not optimistically insert the row — it may land in a sort/filter
      // position or page the server does not agree with.
      const saved = isEdit
        ? await updateMutation.mutateAsync(values)
        : await createMutation.mutateAsync(values);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      handleServerError(error);
    }
  };

  const titleId = isEdit ? 'edit-customer-title' : 'create-customer-title';

  return (
    <>
      <Modal open={open} onClose={onClose} titleId={titleId} title={isEdit ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-field">
            <label htmlFor="customer-name">Name</label>
            <input id="customer-name" {...register('name')} />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="customer-email">Email</label>
            <input id="customer-email" type="email" {...register('email')} />
            {errors.email && <p className="form-error">{errors.email.message}</p>}
            {duplicate && (
              <p className="form-error">
                A customer with this email or phone already exists.{' '}
                <a href={`/customers/${duplicate.id}`} onClick={() => onOpenDuplicate?.(duplicate.id)}>
                  Open {duplicate.name}
                </a>
              </p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="customer-company">Company</label>
            <input id="customer-company" {...register('company')} />
          </div>

          <div className="form-field">
            <label htmlFor="customer-phone">Phone</label>
            <input id="customer-phone" {...register('phone')} />
            {errors.phone && <p className="form-error">{errors.phone.message}</p>}
          </div>

          <div className="form-field">
            <span id="tier-label">Tier</span>
            <Controller
              control={control}
              name="tier"
              render={() => (
                <div role="radiogroup" aria-labelledby="tier-label" className="tier-segmented">
                  {CUSTOMER_TIERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={tier === t}
                      className={`tier-option tier-option-${t}${tier === t ? ' tier-option-selected' : ''} fv`}
                      onClick={() => setValue('tier', t)}
                      onKeyDown={(e) => {
                        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                        const i = CUSTOMER_TIERS.indexOf(t);
                        const next =
                          e.key === 'ArrowRight'
                            ? CUSTOMER_TIERS[(i + 1) % CUSTOMER_TIERS.length]
                            : CUSTOMER_TIERS[(i - 1 + CUSTOMER_TIERS.length) % CUSTOMER_TIERS.length];
                        setValue('tier', next);
                      }}
                    >
                      {TIER_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {isEdit && customer && (
            <div className="form-field form-field-readonly">
              <label>Customer since</label>
              <span dir="ltr">{new Date(customer.created_at).toLocaleDateString()}</span>
            </div>
          )}

          <div className="modal-footer modal-footer-split">
            {isEdit ? (
              <button
                type="button"
                className="dt-btn dt-btn-danger-outline fv"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete Customer
              </button>
            ) : (
              <span />
            )}
            <div className="modal-footer-end">
              <button type="button" className="dt-btn dt-btn-outline fv" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="dt-btn dt-btn-primary fv" disabled={isSubmitting || isPending}>
                {isSubmitting || isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {isEdit && customer && (
        <ConfirmDialog
          open={confirmDeleteOpen}
          title={`Delete ${customer.name}?`}
          body={`Removes ${customer.name} from the customer list. Their ticket history is preserved and the record can be restored by an administrator.`}
          confirmLabel="Delete Customer"
          tone="danger"
          isPending={deleteMutation.isPending}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(customer.id);
            setConfirmDeleteOpen(false);
            onDeleted?.();
            onClose();
          }}
        />
      )}
    </>
  );
};
