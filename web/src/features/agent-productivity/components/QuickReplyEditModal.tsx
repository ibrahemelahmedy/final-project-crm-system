import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../components/ui/Modal';
import { quickReplySchema, type QuickReplyFormValues } from '../model/quickReplySchema';
import type { QuickReply } from '../model/quickReply';

const PLACEHOLDERS = [
  '{{customer.first_name}}',
  '{{customer.full_name}}',
  '{{ticket.id}}',
  '{{ticket.subject}}',
  '{{agent.first_name}}',
];

const CATEGORIES = ['billing', 'account', 'technical', 'general'];

type Props = {
  open: boolean;
  quickReply: QuickReply | null; // null = create
  onSave: (values: QuickReplyFormValues) => Promise<unknown>;
  onClose: () => void;
};

/** The create/edit form (`8.WisalQuickReplies-EditModal` artboard). */
export function QuickReplyEditModal({ open, quickReply, onSave, onClose }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickReplyFormValues>({
    resolver: zodResolver(quickReplySchema),
    values: {
      title: quickReply?.title ?? '',
      body: quickReply?.body ?? '',
      category: quickReply?.category ?? CATEGORIES[0],
    },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSave(values);
      reset();
      onClose();
    } catch {
      setServerError('That template could not be saved. Try again.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="quick-reply-modal-title"
      title={quickReply ? 'Edit quick reply' : 'New quick reply'}
      width={520}
    >
      <form className="qr-edit-form" onSubmit={submit}>
        <label className="qr-edit-field">
          <span>Title</span>
          <input type="text" className="fv" {...register('title')} />
          {errors.title && <span className="add-task-error">{errors.title.message}</span>}
        </label>

        <label className="qr-edit-field">
          <span>Category</span>
          <select className="fv" {...register('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="qr-edit-field">
          <span>Body</span>
          <textarea rows={5} className="fv" {...register('body')} />
          {errors.body && <span className="add-task-error">{errors.body.message}</span>}
        </label>

        <div className="qr-edit-placeholders">
          <span className="qr-edit-placeholders-label">AVAILABLE PLACEHOLDERS</span>
          <div className="qr-edit-placeholder-list">
            {PLACEHOLDERS.map((p) => (
              <span key={p} className="qr-placeholder-badge">
                {p}
              </span>
            ))}
          </div>
        </div>

        {serverError && <p className="add-task-error">{serverError}</p>}

        <div className="modal-footer modal-footer-end">
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="dt-btn dt-btn-primary fv" disabled={isSubmitting}>
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
