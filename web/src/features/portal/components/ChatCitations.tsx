import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../i18n';
import type { ChatCitation } from '../model/portalChat';

/**
 * Story 24 (WIS-23), Done Criterion 3's visible half. Each citation links to
 * the existing public /portal/faq/{slug} route.
 */
export const ChatCitations: React.FC<{ citations: ChatCitation[] }> = ({ citations }) => {
  const { t } = useT('portal');

  if (citations.length === 0) return null;

  return (
    <div className="portal-chat-citations">
      <p className="portal-chat-citations-label">{t('chat.sources')}</p>
      <ul>
        {citations.map((c) => (
          <li key={c.id}>
            <Link className="portal-link" to={`/portal/faq/${c.slug}`}>
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
