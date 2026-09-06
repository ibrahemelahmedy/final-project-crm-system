import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { useTicketQuickReplies } from '../hooks/useTicketQuickReplies';
import type { TicketQuickReply } from '../model/quickReply';

export type QuickReplyPickerProps = {
  ticketId: number;
  /** Splices `body_rendered` into the composer at the caret — never sends anything. */
  onInsert: (body: string) => void;
  onClose: () => void;
};

/**
 * The in-composer picker (`9.WisalQuickReplyPicker` artboards). Search is
 * local — the ticket-scoped endpoint returns the whole active library for
 * one ticket, already rendered, so there is no server round trip per
 * keystroke. Implements the artboard's keyboard model (↑↓ navigate · Enter
 * insert · Esc close), a focus trap, and focus return to the composer on
 * close. It calls no send endpoint — selecting an item only inserts text.
 */
export const QuickReplyPicker: React.FC<QuickReplyPickerProps> = ({ ticketId, onInsert, onClose }) => {
  const { t } = useT('productivity');
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch } = useTicketQuickReplies(ticketId, true);

  const all = useMemo(() => data ?? [], [data]);
  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (qr) => qr.title.toLowerCase().includes(q) || qr.body_rendered.toLowerCase().includes(q)
    );
  }, [all, term]);

  // Group by category for the artboard's BILLING / GENERAL section headings.
  const grouped = useMemo(() => {
    const groups = new Map<string, TicketQuickReply[]>();
    for (const qr of results) {
      const key = qr.category || t('quickReplyPicker.generalCategory');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(qr);
    }
    return Array.from(groups.entries());
  }, [results, t]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset the highlighted row during render when the search term changes —
  // avoids an effect-triggered extra render (react/set-state-in-effect).
  const [trackedTerm, setTrackedTerm] = useState(term);
  if (term !== trackedTerm) {
    setTrackedTerm(term);
    setActiveIndex(0);
  }

  const flat = results;

  const select = (qr: TicketQuickReply) => {
    onInsert(qr.body_rendered);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = flat[activeIndex];
      if (target) select(target);
      return;
    }
    if (e.key === 'Tab') {
      // A minimal focus trap — the panel is the only interactive surface
      // while open, so Tab never escapes it.
      e.preventDefault();
    }
  };

  return (
    <div
      className="qr-picker"
      role="dialog"
      aria-label={t('quickReplyPicker.ariaLabel')}
      ref={panelRef}
      onKeyDown={onKeyDown}
    >
      <input
        ref={inputRef}
        type="search"
        className="search-input qr-picker-input"
        placeholder={t('quickReplyPicker.searchPlaceholder')}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-activedescendant={flat[activeIndex] ? `qr-row-${flat[activeIndex].id}` : undefined}
        role="combobox"
        aria-expanded
        aria-controls="qr-picker-list"
      />

      {isError ? (
        <div className="qr-picker-state">
          <p>{t('quickReplyPicker.loadError')}</p>
          <button type="button" className="tq-btn-outline fv" onClick={() => refetch()}>
            {t('quickReplyPicker.retry')}
          </button>
        </div>
      ) : isLoading ? (
        <div className="qr-picker-list" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="sk qr-picker-skeleton" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <div className="qr-picker-state">
          <p className="qr-picker-empty-title">{t('quickReplyPicker.emptyTitle')}</p>
          <p className="qr-picker-empty-body">{t('quickReplyPicker.emptyBody')}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="qr-picker-state">
          <p className="qr-picker-empty-title">{t('quickReplyPicker.noMatchTitle', { term })}</p>
          <p className="qr-picker-empty-body">{t('quickReplyPicker.noMatchBody')}</p>
          <button type="button" className="tq-btn-outline fv" onClick={() => setTerm('')}>
            {t('quickReplyPicker.clearSearch')}
          </button>
        </div>
      ) : (
        <ul className="qr-picker-list" id="qr-picker-list" role="listbox">
          {grouped.map(([category, items]) => (
            <li key={category} className="qr-picker-group">
              <span className="qr-picker-group-label">{category.toUpperCase()}</span>
              <ul className="qr-picker-group-list">
                {items.map((qr) => {
                  const index = flat.indexOf(qr);
                  return (
                    <li key={qr.id}>
                      <button
                        type="button"
                        id={`qr-row-${qr.id}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={`qr-row${index === activeIndex ? ' qr-row-active' : ''}`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => select(qr)}
                      >
                        <span className="qr-row-title">{qr.title}</span>
                        <span className="qr-row-preview">{qr.body_rendered}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <div className="qr-picker-keys" aria-hidden="true">
        <span>{t('keyboard.navigate')}</span>
        <span>{t('keyboard.insert')}</span>
        <span>{t('keyboard.close')}</span>
      </div>
    </div>
  );
};
