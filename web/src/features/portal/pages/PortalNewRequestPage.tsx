import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../../../i18n';
import { useCreatePortalRequest } from '../hooks/usePortalRequests';
import { PortalError } from '../components/PortalStates';
import type { PortalTicketCategory } from '../model/portal';

const CATEGORIES: PortalTicketCategory[] = [
  'general',
  'billing',
  'technical',
  'account',
  'feature_request',
];

type NewRequestValues = {
  subject: string;
  category: PortalTicketCategory;
  description: string;
};

/**
 * Story 17 (WIS-16) — AC2, "submit a new request". Undesigned screen
 * (Decision 3). Subject, category, description and NOTHING else: there is
 * deliberately no priority field, because StorePortalRequestRequest does not
 * accept one — a customer does not set their own SLA.
 */
export const PortalNewRequestPage: React.FC = () => {
  const { t } = useT('portal');
  const navigate = useNavigate();
  const createRequest = useCreatePortalRequest();

  // The max lengths mirror StorePortalRequestRequest's rules, so the field
  // errors surface here rather than as a 422 round trip.
  const schema = useMemo(
    () =>
      z.object({
        subject: z.string().trim().min(1, t('newRequest.subjectRequired')).max(255),
        category: z.enum(['general', 'billing', 'technical', 'account', 'feature_request']),
        description: z.string().trim().min(1, t('newRequest.descriptionRequired')).max(5000),
      }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewRequestValues>({
    resolver: zodResolver(schema),
    defaultValues: { subject: '', category: 'general', description: '' },
  });

  const onSubmit = (values: NewRequestValues) => {
    createRequest.mutate(values, {
      onSuccess: (ticket) => navigate(`/portal/requests/${ticket.id}`, { replace: true }),
    });
  };

  return (
    <div className="portal-card portal-wide">
      <div className="portal-page-head">
        <h1 className="portal-heading">{t('newRequest.title')}</h1>
      </div>

      <form className="portal-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="portal-field">
          <label htmlFor="subject" className="portal-label">
            {t('newRequest.subjectLabel')}
          </label>
          <input
            id="subject"
            type="text"
            className="portal-input fv"
            maxLength={255}
            dir="auto"
            aria-invalid={!!errors.subject}
            aria-describedby={errors.subject ? 'subject-error' : undefined}
            disabled={createRequest.isPending}
            {...register('subject')}
          />
          {errors.subject && (
            <span id="subject-error" className="portal-alert-error" role="alert">
              {errors.subject.message}
            </span>
          )}
        </div>

        <div className="portal-field">
          <label htmlFor="category" className="portal-label">
            {t('newRequest.categoryLabel')}
          </label>
          <select
            id="category"
            className="portal-select fv"
            disabled={createRequest.isPending}
            {...register('category')}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`newRequest.category.${category}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="portal-field">
          <label htmlFor="description" className="portal-label">
            {t('newRequest.descriptionLabel')}
          </label>
          <textarea
            id="description"
            className="portal-textarea fv"
            maxLength={5000}
            dir="auto"
            rows={6}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'description-error' : undefined}
            disabled={createRequest.isPending}
            {...register('description')}
          />
          {errors.description && (
            <span id="description-error" className="portal-alert-error" role="alert">
              {errors.description.message}
            </span>
          )}
        </div>

        {createRequest.isError && <PortalError message={t('newRequest.error')} />}

        <button
          type="submit"
          className="portal-btn fv"
          disabled={createRequest.isPending}
          aria-busy={createRequest.isPending}
        >
          {createRequest.isPending ? t('newRequest.submitting') : t('newRequest.submit')}
        </button>
      </form>

      <p className="portal-footer-note">
        <Link to="/portal/requests" className="portal-link">
          {t('newRequest.cancel')}
        </Link>
      </p>
    </div>
  );
};
