import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchCsatSurvey, submitCsatResponse } from '../api/csatApi';
import { RatingGroup } from '../components/RatingGroup';
import { i18n, useT, formatDateTime } from '../../../i18n';
import { csatDir, detectCsatLocale, type CsatLocale } from '../model/csatStrings';
import type { CsatSurvey } from '../model/csat';

const WISAL_MARK = (
  <svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true" className="csat-mark">
    <circle cx="24" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="7" />
    <circle cx="42" cy="32" r="9" fill="none" stroke="currentColor" strokeWidth="7" />
  </svg>
);

/**
 * Story 13 — the no-login public feedback page. Maps `CsatSurveyState` to an
 * artboard: `outstanding` -> the form (idle / rating-selected / submitting),
 * `answered` -> the read-only recap, `expired` -> the calm card. A failed
 * fetch renders a retryable error; an unknown/invalid uuid renders the SAME
 * expired card as a genuine expiry (the API guarantees this), so the link
 * space is never enumerable.
 *
 * Story 16 (WIS-17): the page drives the SHARED i18next instance with its
 * OWN detected/toggled locale — never `UiPreferencesContext.setLocale`, which
 * would fire `PATCH /api/user/preferences` for a visitor who never signed in.
 * This is safe because the page is always the sole occupant of its browser
 * tab (opened from a feedback-link email/SMS); the previous language is
 * restored on unmount exactly like the `lang`/`dir` attributes below.
 */
export function CsatResponsePage() {
  const { uuid = '' } = useParams();
  const [override, setOverride] = useState<CsatLocale | null>(null);
  const locale = override ?? detectCsatLocale();
  const dir = csatDir(locale);

  useEffect(() => {
    const previousLanguage = i18n.language;
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    return () => {
      void i18n.changeLanguage(previousLanguage);
    };
  }, [locale]);

  const { t } = useT('csat');

  useEffect(() => {
    const html = document.documentElement;
    const prevLang = html.getAttribute('lang');
    const prevDir = html.getAttribute('dir');
    html.setAttribute('lang', locale);
    html.setAttribute('dir', dir);
    return () => {
      if (prevLang) html.setAttribute('lang', prevLang);
      else html.removeAttribute('lang');
      if (prevDir) html.setAttribute('dir', prevDir);
      else html.removeAttribute('dir');
    };
  }, [locale, dir]);

  const query = useQuery({
    queryKey: ['csat', uuid],
    queryFn: () => fetchCsatSurvey(uuid),
    retry: false,
  });

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const mutation = useMutation({
    mutationFn: () => submitCsatResponse(uuid, { rating: rating as number, comment: comment || undefined }),
    onSuccess: (data) => query.refetch().then(() => data),
  });

  const survey: CsatSurvey | undefined = mutation.data ?? query.data;

  const body = useMemo(() => {
    if (query.isLoading) {
      return (
        <div className="csat-card" aria-busy="true">
          <div className="csat-skeleton csat-skeleton-title" />
          <div className="csat-skeleton csat-skeleton-block" />
          <div className="csat-skeleton csat-skeleton-btn" />
          <span className="csat-visually-hidden">{t('loading')}</span>
        </div>
      );
    }

    if (query.isError || !survey) {
      return (
        <div className="csat-card csat-card-centered">
          {WISAL_MARK}
          <div className="csat-status-icon csat-status-icon-error" aria-hidden="true">!</div>
          <h1 className="csat-title">{t('errorTitle')}</h1>
          <p className="csat-body-text">{t('errorBody')}</p>
          <button type="button" className="csat-btn fv" onClick={() => query.refetch()}>
            {t('retry')}
          </button>
        </div>
      );
    }

    // A fresh submission this session -> the dedicated thank-you artboard,
    // even after the background refetch flips the survey to `answered`.
    if (mutation.isSuccess) {
      return (
        <div className="csat-card csat-card-centered">
          {WISAL_MARK}
          <div className="csat-status-icon csat-status-icon-ok" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="csat-title">{t('submittedTitle')}</h1>
          {survey.ticket && <p className="csat-body-text">{t('submittedBody', { number: survey.ticket.number })}</p>}
        </div>
      );
    }

    if (survey.state === 'expired') {
      return (
        <div className="csat-card csat-card-centered">
          {WISAL_MARK}
          <div className="csat-status-icon csat-status-icon-muted" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6l3 3" />
            </svg>
          </div>
          <h1 className="csat-title">{t('expiredTitle')}</h1>
          <p className="csat-body-text">{t('expiredBody')}</p>
        </div>
      );
    }

    if (survey.state === 'answered') {
      return (
        <div className="csat-card">
          <div className="csat-header">
            {WISAL_MARK}
            <span className="csat-brand">{t('brand')}</span>
          </div>
          <div className="csat-head-block">
            <h1 className="csat-title csat-title-sm">{t('answeredTitle')}</h1>
            {survey.ticket && (
              <p className="csat-sub">{t('request', { number: survey.ticket.number, subject: survey.ticket.subject })}</p>
            )}
          </div>
          <div className="csat-recap">
            <div className="csat-recap-label">{t('yourResponse')}</div>
            <RatingGroup value={survey.rating} readOnly t={t} />
            {survey.comment && (
              <div className="csat-recap-comment">
                <div className="csat-recap-label">{t('commentHeading')}</div>
                <div className="csat-recap-comment-text" dir="auto">
                  {survey.comment}
                </div>
              </div>
            )}
            {survey.responded_at && (
              <div className="csat-recap-date">{t('submittedOn', { date: formatDateTime(survey.responded_at) })}</div>
            )}
          </div>
          <p className="csat-body-text csat-center">{t('answeredFooter')}</p>
        </div>
      );
    }

    // survey.state === 'outstanding' — the form.
    const submitting = mutation.isPending;

    return (
      <div className="csat-card">
        <div className="csat-header">
          {WISAL_MARK}
          <span className="csat-brand">{t('brand')}</span>
        </div>
        <div className="csat-head-block">
          <h1 className="csat-title">{t('heading')}</h1>
          {survey.ticket && (
            <p className="csat-sub">{t('request', { number: survey.ticket.number, subject: survey.ticket.subject })}</p>
          )}
        </div>
        <form
          className="csat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating !== null && !submitting) mutation.mutate();
          }}
        >
          <fieldset className="csat-fieldset" disabled={submitting}>
            <legend className="csat-legend">
              {t('ratingLegend')} <span aria-hidden="true" className="csat-req">*</span>
            </legend>
            <RatingGroup value={rating} onChange={setRating} disabled={submitting} t={t} />
            {rating !== null && (
              <div className="csat-rating-confirm">
                {t('ratingSelected', { label: t(`rating.${rating}`) })}
              </div>
            )}
          </fieldset>
          <div className="csat-comment-block">
            <label htmlFor="csat-comment" className="csat-legend">
              {t('commentLabel')} <span className="csat-optional">{t('commentOptional')}</span>
            </label>
            <div className="csat-hint">{t('commentHint')}</div>
            <textarea
              id="csat-comment"
              className="csat-textarea fv"
              rows={4}
              dir="auto"
              value={comment}
              disabled={submitting}
              placeholder={t('commentPlaceholder')}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <button type="submit" className="csat-btn fv" disabled={rating === null || submitting}>
            {submitting ? t('submitting') : t('submit')}
          </button>
          {mutation.isError && <div className="csat-inline-error">{t('errorBody')}</div>}
        </form>
      </div>
    );
  }, [query, survey, mutation, rating, comment, t]);

  return (
    <div className="csat-page" dir={dir} lang={locale}>
      <div className="csat-locale-toggle">
        <button
          type="button"
          className="csat-toggle-btn fv"
          onClick={() => setOverride(locale === 'ar' ? 'en' : 'ar')}
        >
          {t('toggleTo')}
        </button>
      </div>
      {body}
    </div>
  );
}
