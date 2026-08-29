import React from 'react';
import type { TocEntry } from '../model/article';

/**
 * "ON THIS PAGE" — WisalKBArticle-LightLTR.dc.html lines 118-126.
 *
 * The entries are generated server-side from the RENDERED headings and carry
 * the ids the sanitizer actually assigned, de-duplicated there. So an anchor
 * here can never point at a heading that does not exist, and two identically
 * titled sections cannot both link to the first one.
 *
 * The accent bar is an inline-start border, so it moves to the visual left
 * under RTL on its own — verified against WisalKBArticle-LightRTL.dc.html.
 */
export const ArticleToc: React.FC<{ entries: TocEntry[] }> = ({ entries }) => {
  // No headings means no table of contents — an empty "ON THIS PAGE" heading
  // over nothing is noise.
  if (entries.length === 0) {
    return null;
  }

  return (
    <nav className="kb-toc" aria-labelledby="kb-toc-label">
      <div className="kb-toc-inner">
        <div className="kb-toc-label" id="kb-toc-label">
          ON THIS PAGE
        </div>
        <ul className="kb-toc-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a className="kb-toc-link fv" data-level={entry.level} href={`#${entry.id}`}>
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};
