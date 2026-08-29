import React from 'react';
import type { ArticleCategory } from '../model/article';

/**
 * The left rail — WisalKBIndex-LightLTR.dc.html lines 60-70.
 *
 * The rail is a single-select filter, not a multi-select facet: the artboard
 * shows one highlighted row with an "All Articles" reset above it, and the
 * underlying param is still the array the API takes, so nothing about the
 * contract changes if a future story turns it into a multi-select.
 *
 * It mirrors to the visual left under RTL for free — the surrounding flex row
 * is laid out in logical order and there is no second RTL-specific rule
 * anywhere. Verified against WisalKBIndex-LightRTL.dc.html.
 */
export const CategoryRail: React.FC<{
  categories: ArticleCategory[];
  total: number;
  selected: string[];
  onSelect: (slugs: string[]) => void;
  isLoading?: boolean;
}> = ({ categories, total, selected, onSelect, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="kb-rail">
        <div className="kb-rail-label">CATEGORIES</div>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="sk kb-rail-skeleton" />
        ))}
      </div>
    );
  }

  const allActive = selected.length === 0;

  return (
    <nav className="kb-rail" aria-label="Article categories">
      <div className="kb-rail-label" id="kb-rail-label">
        CATEGORIES
      </div>
      <ul className="kb-rail-list" aria-labelledby="kb-rail-label">
        <li>
          <button
            type="button"
            className="kb-rail-item fv"
            data-active={allActive}
            aria-current={allActive ? 'true' : undefined}
            onClick={() => onSelect([])}
          >
            <span>All Articles</span>
            <span className="kb-rail-count" dir="ltr">
              {total}
            </span>
          </button>
        </li>
        {categories.map((category) => {
          const active = selected.includes(category.slug);
          return (
            <li key={category.slug}>
              <button
                type="button"
                className="kb-rail-item fv"
                data-active={active}
                aria-current={active ? 'true' : undefined}
                // Clicking the active category clears it, so the rail can be
                // reset without hunting for "All Articles".
                onClick={() => onSelect(active ? [] : [category.slug])}
              >
                <span>{category.name}</span>
                <span className="kb-rail-count" dir="ltr">
                  {category.article_count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
