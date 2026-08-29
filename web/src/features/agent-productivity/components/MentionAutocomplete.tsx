import React, { useEffect, useMemo, useState } from 'react';
import { useMentionableUsers } from '../hooks/useMentionableUsers';
import type { MentionableUser } from '../model/mentionableUser';

export type MentionAutocompleteProps = {
  ticketId: number;
  /** Text typed after the triggering "@" (no leading "@"). */
  query: string;
  onSelect: (user: MentionableUser) => void;
  onDismiss: () => void;
};

/**
 * The `@mention` autocomplete panel (`11.WisalInternalNote` artboard's
 * "COLLEAGUES" list). Rendered only while the composer is in internal-note
 * mode and the caret sits inside an unfinished "@token".
 */
export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  ticketId,
  query,
  onSelect,
  onDismiss,
}) => {
  const { data, isLoading } = useMentionableUsers(ticketId, true);
  const [activeIndex, setActiveIndex] = useState(0);
  // Reset the highlighted row during render when the query changes — the
  // React-recommended way to adjust state from a prop change without an
  // extra effect-triggered render (react/set-state-in-effect).
  const [trackedQuery, setTrackedQuery] = useState(query);
  if (query !== trackedQuery) {
    setTrackedQuery(query);
    setActiveIndex(0);
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data ?? [];
    return q ? all.filter((u) => u.name.toLowerCase().includes(q)) : all;
  }, [data, query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const target = matches[activeIndex];
        if (target) {
          e.preventDefault();
          onSelect(target);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [matches, activeIndex, onSelect, onDismiss]);

  if (!isLoading && matches.length === 0) return null;

  return (
    <div className="mention-panel" role="listbox" aria-label="Mention a colleague">
      <span className="mention-panel-label">COLLEAGUES</span>
      {isLoading ? (
        <span className="sk mention-skeleton" />
      ) : (
        <ul className="mention-panel-list">
          {matches.map((user, index) => (
            <li key={user.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`mention-row${index === activeIndex ? ' mention-row-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelect(user)}
              >
                <span className="mention-row-avatar">{user.initials}</span>
                <span className="mention-row-name">{user.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mention-panel-keys" aria-hidden="true">
        <span>↑↓ navigate</span>
        <span>Enter insert</span>
      </div>
    </div>
  );
};
