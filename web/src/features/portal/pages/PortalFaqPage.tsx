import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useT } from '../../../i18n';
import { usePortalFaqList } from '../hooks/usePortalFaq';
import { PortalEmpty, PortalError, PortalSkeleton } from '../components/PortalStates';

/**
 * Story 17 (WIS-16) — AC6. Published KB articles, reachable WITHOUT a portal
 * session: this route sits outside RequirePortalSession because FAQs are
 * public content (§8), and /api/portal/faq has no `portal` middleware.
 * Undesigned screen (Decision 3).
 */
export const PortalFaqPage: React.FC = () => {
  const { t } = useT('portal');
  const [searchParams, setSearchParams] = useSearchParams();

  // The committed search term lives in the URL, so a shared FAQ search link
  // reopens the same results; the input itself is local until submit.
  const committedQuery = searchParams.get('q') ?? '';
  const [term, setTerm] = useState(committedQuery);
  const query = usePortalFaqList(committedQuery);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (term.trim() === '') params.delete('q');
    else params.set('q', term.trim());
    setSearchParams(params);
  };

  const clearSearch = () => {
    setTerm('');
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    setSearchParams(params);
  };

  return (
    <div className="portal-card portal-wide">
      <div className="portal-page-head">
        <h1 className="portal-heading">{t('faq.title')}</h1>
      </div>
      <p className="portal-subheading">{t('faq.intro')}</p>

      <form className="portal-search" onSubmit={onSearch} role="search">
        <label htmlFor="faq-search" className="portal-visually-hidden">
          {t('faq.searchLabel')}
        </label>
        <input
          id="faq-search"
          type="search"
          className="portal-input fv"
          dir="auto"
          placeholder={t('faq.searchPlaceholder')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <button type="submit" className="portal-btn portal-btn-inline fv">
          {t('faq.searchLabel')}
        </button>
      </form>

      {query.isPending && <PortalSkeleton label={t('faq.loading')} />}

      {query.isError && <PortalError message={t('faq.error')} onRetry={() => query.refetch()} />}

      {query.isSuccess &&
        (query.data.data.length === 0 ? (
          <PortalEmpty
            message={t('faq.empty')}
            actionLabel={committedQuery ? t('faq.emptyAction') : undefined}
            onAction={committedQuery ? clearSearch : undefined}
          />
        ) : (
          <ul className="portal-list">
            {query.data.data.map((article) => (
              <li key={article.slug}>
                <Link to={`/portal/faq/${article.slug}`} className="portal-list-row fv">
                  <strong dir="auto">{article.title}</strong>
                  {article.excerpt && (
                    <p className="portal-hint" dir="auto" style={{ marginBlockStart: '6px' }}>
                      {article.excerpt}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ))}

      <p className="portal-footer-note">
        <Link to="/portal" className="portal-link">
          {t('faq.signIn')}
        </Link>
      </p>
    </div>
  );
};
