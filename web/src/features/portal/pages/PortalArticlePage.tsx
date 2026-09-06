import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useT, formatDate } from '../../../i18n';
import { usePortalArticle } from '../hooks/usePortalFaq';
import { PortalEmpty, PortalError, PortalSkeleton } from '../components/PortalStates';

/**
 * Story 17 (WIS-16) — AC6, one published article. Public, no session.
 */
export const PortalArticlePage: React.FC = () => {
  const { t } = useT('portal');
  const { slug } = useParams<{ slug: string }>();
  const query = usePortalArticle(slug);

  const notFound = (query.error as AxiosError | undefined)?.response?.status === 404;

  return (
    <div className="portal-card portal-wide">
      <p className="portal-footer-note" style={{ textAlign: 'start' }}>
        <Link to="/portal/faq" className="portal-link">
          {t('faq.backToList')}
        </Link>
      </p>

      {query.isPending && <PortalSkeleton rows={4} label={t('faq.loading')} />}

      {query.isError &&
        (notFound ? (
          <PortalEmpty
            message={t('faq.notFound')}
            action={
              <Link to="/portal/faq" className="portal-link">
                {t('faq.backToList')}
              </Link>
            }
          />
        ) : (
          <PortalError message={t('faq.error')} onRetry={() => query.refetch()} />
        ))}

      {query.isSuccess && (
        <article>
          <h1 className="portal-heading" dir="auto">
            {query.data.title}
          </h1>
          {query.data.published_at && (
            <p className="portal-hint">{t('faq.publishedOn', { date: formatDate(query.data.published_at) })}</p>
          )}
          {/* dangerouslySetInnerHTML is safe HERE and only here: body_html is
              never client-authored. App\Services\MarkdownRenderer (Story 09)
              is the single write path for this column and sanitizes on write,
              so the API never returns unsanitized markup. Every other body on
              the portal (ticket messages) is rendered as plain text. */}
          <div
            className="portal-prose"
            dir="auto"
            dangerouslySetInnerHTML={{ __html: query.data.body_html ?? '' }}
          />
        </article>
      )}
    </div>
  );
};
