import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useT } from '../../../i18n';
import { useKbArticle } from '../hooks/useKbQueries';
import { ArticleStatusBadge } from '../components/ArticleStatusBadge';
import { ArticleToc } from '../components/ArticleToc';
import { formatArticleDate } from '../model/columns';

/**
 * The reader — WisalKBArticle-*.dc.html.
 *
 * Breadcrumb, category eyebrow, the meta line, the sanitized body, and the
 * "ON THIS PAGE" table of contents.
 *
 * "Was this article helpful?" appears in the artboard. Ratings are explicitly
 * out of scope for this story, and depicting a control the product cannot
 * honour is worse than omitting it — so it is OMITTED, not shipped inert. The
 * same call Story 05 made for the AI-suggested-reply slot. No ratings table
 * exists either way.
 */
export const ArticleReaderPage: React.FC = () => {
  const { t } = useT('knowledge');
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: article, isPending, isError, error, refetch } = useKbArticle(slug);

  const isEditor = user?.role === 'team_lead' || user?.role === 'administrator';

  if (isPending) {
    return (
      <div className="kb-reader" aria-busy="true">
        <span className="sk" style={{ width: 320, height: 14 }} />
        <span className="sk" style={{ width: 480, height: 30, marginTop: 16 }} />
        <span className="sk" style={{ width: 200, height: 12, marginTop: 10 }} />
        <span className="sk" style={{ width: '100%', height: 220, marginTop: 22, borderRadius: 10 }} />
      </div>
    );
  }

  if (isError) {
    // A 404 here means "no such slug, or a draft this reader may not see" —
    // the server deliberately does not distinguish the two, and neither does
    // this message. A "you are not allowed to see this draft" copy would leak
    // exactly what the 404 exists to hide.
    const status = (error as { response?: { status?: number } })?.response?.status;

    if (status === 404) {
      return (
        <div className="kb-reader kb-reader-state">
          <h1>{t('reader.notFoundTitle')}</h1>
          <p>{t('reader.notFoundBody')}</p>
          <Link className="dt-btn dt-btn-primary fv" to="/knowledge-base">
            {t('reader.backToKb')}
          </Link>
        </div>
      );
    }

    return (
      <div className="kb-reader kb-reader-state">
        <h1>{t('reader.errorTitle')}</h1>
        <p>{t('reader.errorBody')}</p>
        <button type="button" className="dt-btn dt-btn-primary fv" onClick={() => refetch()}>
          {t('reader.tryAgain')}
        </button>
      </div>
    );
  }

  const hasBody = Boolean(article.body_html && article.body_html.trim() !== '');

  return (
    <article className="kb-reader">
      <nav className="kb-breadcrumb" aria-label={t('reader.breadcrumbLabel')}>
        <Link className="kb-breadcrumb-link fv" to="/knowledge-base">
          {t('reader.kbLink')}
        </Link>
        {article.category && (
          <>
            {/* The chevron mirrors under RTL via a CSS transform on the
                container's direction — one glyph, not two hard-coded paths. */}
            <span className="kb-breadcrumb-sep" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
            <Link
              className="kb-breadcrumb-link fv"
              to={`/knowledge-base?category[]=${encodeURIComponent(article.category.slug)}`}
            >
              {article.category.name}
            </Link>
          </>
        )}
        <span className="kb-breadcrumb-sep" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
        <span className="kb-breadcrumb-current" aria-current="page">
          {article.title}
        </span>
      </nav>

      <div className="kb-reader-split">
        <div className="kb-reader-main">
          <header className="kb-reader-head">
            <div className="kb-reader-eyebrow-row">
              {article.category && (
                <span className="kb-category-eyebrow">{article.category.name}</span>
              )}
              {/* A draft an editor is previewing must say so, plainly. */}
              {article.status !== 'published' && (
                <ArticleStatusBadge status={article.status} label={article.status_label} />
              )}
              {isEditor && (
                <button
                  type="button"
                  className="dt-btn dt-btn-outline fv kb-reader-edit"
                  onClick={() => navigate(`/knowledge-base/${article.slug}/edit`)}
                >
                  {t('reader.edit')}
                </button>
              )}
            </div>

            <h1 className="kb-reader-title" dir={article.direction}>
              {article.title}
            </h1>

            {/* The staleness signal agents rely on. The date is always LTR —
                a numeral run must not reverse inside an RTL sentence. */}
            <p className="kb-reader-meta">
              {t('reader.lastUpdated')} <span dir="ltr">{formatArticleDate(article.updated_at)}</span>
              {' · '}
              <span dir="ltr">{article.read_minutes}</span> {t('reader.minRead')}
              {article.version_count > 0 && (
                <>
                  {' · '}
                  {t('reader.revisionCount', { count: article.version_count })}
                </>
              )}
            </p>
          </header>

          {hasBody ? (
            <div
              className="kb-article-body"
              data-testid="kb-article-body"
              // dir comes from the article's OWN content, not the app-wide
              // direction: an Arabic article read by an English-UI user still
              // renders RTL inside the body. The Arabic line-height rule
              // (brief.md line 120) is applied by [dir="rtl"] in index.css.
              dir={article.direction}
              lang={article.direction === 'rtl' ? 'ar' : undefined}
              // SAFE: body_html is sanitized SERVER-SIDE on write by
              // App\Services\MarkdownRenderer, against an element and
              // attribute allow-list. `article.body` — the raw Markdown — is
              // never passed here, and client-side sanitization alone was
              // explicitly ruled insufficient.
              dangerouslySetInnerHTML={{ __html: article.body_html as string }}
            />
          ) : (
            <p className="kb-reader-empty-body">
              {t('reader.emptyBody')}
              {isEditor ? ` ${t('reader.emptyBodyEditorHint')}` : ''}
            </p>
          )}
        </div>

        <ArticleToc entries={article.toc} />
      </div>
    </article>
  );
};
