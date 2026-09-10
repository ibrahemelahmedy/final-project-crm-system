import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../i18n';
import type { ChatCitation } from '../model/portalChat';

/**
 * Story 24 (WIS-23), Done Criterion 3's visible half. Each citation links to
 * the existing public /portal/faq/{slug} route.
 *
 * Story 27 (WIS-28) styles this list; the empty-array early return is frozen.
 */
export const ChatCitations: React.FC<{ citations: ChatCitation[] }> = ({ citations }) => {
  const { t } = useT('portal');

  if (citations.length === 0) return null;

  return (
    <div className="portal-chat-citations">
      <p className="portal-chat-citations-label">{t('chat.sources')}</p>
      <ul className="portal-chat-citations-list">
        {citations.map((c) => (
          <li key={c.id}>
            <Link
              className="portal-link portal-chat-citation-link"
              to={`/portal/faq/${c.slug}`}
              dir="auto"
            >
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
