import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { newTicketSchema, type NewTicketValues } from '../model/newTicketSchema';
import type { TicketMeta, TicketPriority } from '../model/ticket';
import { useCreateTicket } from '../hooks/useTicketMutations';
import { CustomerCombobox } from './CustomerCombobox';

type Props = {
  meta: TicketMeta | undefined;
  onClose: () => void;
  onCreated: () => void;
};

const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export function NewTicketModal({ meta, onClose, onCreated }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const invokerRef = useRef<Element | null>(null);

  const createTicket = useCreateTicket();

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NewTicketValues>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: { subject: '', category: '', priority: 'normal', channel: 'email', description: '' },
  });

  // Focus moves to the first field on open and returns to the invoker on
  // close. The cleanup form is what makes it survive an unmount that no
  // onClose path ran for.
  useEffect(() => {
    invokerRef.current = document.activeElement;
    firstFieldRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
      (invokerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createTicket.mutateAsync(values);
      onCreated();
    } catch (error) {
      // Map Laravel's 422 errors object onto the form. Never swallow a 422
      // into a generic "something went wrong".
      const response = (error as { response?: { status?: number; data?: { errors?: Record<string, string[]>; message?: string } } }).response;
      if (response?.status === 422 && response.data?.errors) {
        for (const [field, messages] of Object.entries(response.data.errors)) {
          setError(field as keyof NewTicketValues, { message: messages[0] });
        }
      } else {
        setError('root', { message: 'We could not create this ticket. Try again.' });
      }
    }
  });

  // useWatch, not watch(): watch() returns a subscription the React Compiler
  // cannot memoize, so a value read from it can go stale downstream.
  const priorityValue = useWatch({ control, name: 'priority' });
  const customerId = useWatch({ control, name: 'customer_id' });

  return createPortal(
    <div className="tq-modal-backdrop">
      <div ref={panelRef} className="tq-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="tq-modal-head">
          <h2 id={titleId} className="tq-modal-title">
            New Ticket
          </h2>
          <button type="button" className="tq-modal-close" onClick={onClose} aria-label="Close dialog">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form className="tq-modal-body" onSubmit={onSubmit} noValidate>
          {errors.root && (
            <p className="tq-field-error" role="alert">
              {errors.root.message}
            </p>
          )}

          <div className="tq-field">
            <label className="tq-label" htmlFor="tq-subject">
              Subject
            </label>
            <input
              id="tq-subject"
              className="tq-input"
              aria-invalid={errors.subject ? true : undefined}
              aria-describedby={errors.subject ? 'tq-subject-error' : undefined}
              {...register('subject')}
              ref={(el) => {
                register('subject').ref(el);
                firstFieldRef.current = el;
              }}
            />
            {errors.subject && (
              <p id="tq-subject-error" className="tq-field-error">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div className="tq-field">
            <label className="tq-label" htmlFor="tq-customer">
              Customer
            </label>
            <Controller
              control={control}
              name="customer_id"
              render={({ field }) => (
                <CustomerCombobox
                  id="tq-customer"
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  invalid={Boolean(errors.customer_id)}
                  describedBy={errors.customer_id ? 'tq-customer-error' : undefined}
                />
              )}
            />
            {errors.customer_id && (
              <p id="tq-customer-error" className="tq-field-error">
                {errors.customer_id.message}
              </p>
            )}
          </div>

          <div className="tq-field">
            <label className="tq-label" htmlFor="tq-category">
              Category
            </label>
            <select
              id="tq-category"
              className="tq-input"
              aria-invalid={errors.category ? true : undefined}
              {...register('category')}
            >
              <option value="">Select a category</option>
              {(meta?.categories ?? []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.category && <p className="tq-field-error">{errors.category.message}</p>}
          </div>

          <div className="tq-field">
            <span className="tq-label" id="tq-priority-label">
              Priority
            </span>
            {/* A radiogroup with roving tabIndex — four independent buttons
                would give a keyboard user four stops for one value. */}
            <div className="tq-segmented" role="radiogroup" aria-labelledby="tq-priority-label">
              {PRIORITIES.map((p) => {
                const checked = priorityValue === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked ? 0 : -1}
                    className={`tq-segment tq-prio-${p}`}
                    data-checked={checked ? 'true' : 'false'}
                    onClick={() => setValue('priority', p, { shouldValidate: true })}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        setValue('priority', PRIORITIES[(PRIORITIES.indexOf(p) + 1) % PRIORITIES.length]);
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        setValue(
                          'priority',
                          PRIORITIES[(PRIORITIES.indexOf(p) - 1 + PRIORITIES.length) % PRIORITIES.length]
                        );
                      }
                    }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tq-field">
            <label className="tq-label" htmlFor="tq-channel">
              Channel
            </label>
            <select id="tq-channel" className="tq-input" {...register('channel')}>
              {(meta?.channels ?? []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="tq-field">
            <label className="tq-label" htmlFor="tq-description">
              Description
            </label>
            <textarea id="tq-description" className="tq-input tq-textarea" rows={4} {...register('description')} />
          </div>

          {/* Inert by design: wiring it would invent file storage, virus
              scanning and a retention policy that no story owns. Deleting it
              would stop the modal matching the reviewed design. */}
          <div className="tq-dropzone" aria-hidden="true" title="Coming soon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4 M7 9l5-5 5 5 M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span>Drag files here or click to browse</span>
          </div>

          <footer className="tq-modal-foot">
            <button type="button" className="tq-btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="tq-btn-primary" disabled={isSubmitting || customerId === undefined}>
              {isSubmitting ? 'Creating…' : 'Create Ticket'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
