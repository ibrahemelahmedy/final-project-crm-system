import React from 'react';
import { Link } from 'react-router-dom';
import type { ArticleSummary } from '../model/article';

/**
 * The rail's "MOST VIEWED" block — WisalKBIndex-LightLTR.dc.html lines 72-78.
 *
 * The artboard renders these as tabbable divs. They are real <Link>s here: an
 * element that navigates must be a link, or keyboard and screen-reader users
 * get a control that announces nothing and does not respond to Enter.
 */
export const MostViewedList: React.FC<{
  articles: ArticleSummary[];
  isLoading?: boolean;
}> = ({ articles, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="kb-most-viewed">
        <div className="kb-rail-label">MOST VIEWED</div>
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="sk kb-most-viewed-skeleton" />
        ))}
      </div>
    );
  }

  // No published articles yet — the block is omitted rather than rendered as
  // an empty heading with nothing under it.
  if (articles.length === 0) {
    return null;
  }

  return (
    <nav className="kb-most-viewed" aria-label="Most viewed articles">
      <div className="kb-rail-label" id="kb-most-viewed-label">
        MOST VIEWED
      </div>
      <ul className="kb-most-viewed-list" aria-labelledby="kb-most-viewed-label">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link className="kb-most-viewed-item fv" to={`/knowledge-base/${article.slug}`}>
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
