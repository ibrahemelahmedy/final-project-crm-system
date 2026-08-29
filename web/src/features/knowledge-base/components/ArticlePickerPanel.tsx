import React, { useEffect, useState } from 'react';
import { useKbSearch } from '../hooks/useKbQueries';
import { articleReference, type ArticleSummary } from '../model/article';

export type ArticlePickerPanelProps = {
  /**
   * Called with the Markdown reference to splice in. Story 05's ReplyComposer
   * hands its own caret-insert function down through TicketDetailPage, so the
   * reference lands at the caret rather than at the end of the draft.
   */
  onInsert: (markdown: string) => void;
  /** Optional close affordance when the panel is mounted in a popover. */
  onClose?: () => void;
  /** Labels the panel for the surface it is mounted on. */
  heading?: string;
  autoFocus?: boolean;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Search the Knowledge Base and insert an article reference — WITHOUT leaving
 * the ticket. Story 09 owns this component and the reference format; Story 05
 * mounts it in the reply composer.
 *
 * It is deliberately self-contained and takes only a callback, so it is usable
 * standalone from the KB index too. It does not import anything from the
 * tickets feature and never touches the composer's internals.
 */
export const ArticlePickerPanel: React.FC<ArticlePickerPanelProps> = ({
  onInsert,
  onClose,
  heading = 'Insert a Knowledge Base article',
  autoFocus = false,
}) => {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 250);
  const { data, isFetching, isError, refetch } = useKbSearch(debounced);

  const results = data?.data ?? [];
  const hasQuery = debounced.trim().length > 0;

  const insert = (article: ArticleSummary) => {
    // ONE definition of the reference format, imported from the model — the
    // template is never re-typed at a call site.
    onInsert(articleReference(article));
    onClose?.();
  };

  return (
    <div className="kb-picker">
      <div className="kb-picker-head">
        <h2 className="kb-picker-title">{heading}</h2>
        {onClose && (
          <button type="button" className="dt-icon-btn fv" aria-label="Close article picker" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <label className="tq-sr-only" htmlFor="kb-picker-search">
        Search knowledge base articles
      </label>
      <input
        id="kb-picker-search"
        className="search-input kb-picker-input"
        type="search"
        autoFocus={autoFocus}
        placeholder="Search articles, guides, and FAQs…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      {/* Result count is announced, so a screen-reader user is told the list
          changed rather than having to re-read it. */}
      <div className="tq-sr-only" role="status" aria-live="polite">
        {hasQuery && !isFetching ? `${results.length} articles found` : ''}
      </div>

      {isError ? (
        <div className="kb-picker-state">
          <p>Articles could not be loaded.</p>
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : !hasQuery ? (
        <p className="kb-picker-state kb-picker-hint">
          Type to search the Knowledge Base. Choosing a result inserts a link into your reply.
        </p>
      ) : isFetching && results.length === 0 ? (
        <div className="kb-picker-list" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="sk kb-picker-skeleton" />
          ))}
        </div>
      ) : results.length === 0 ? (
        // Never a blank list, and never a spinner that resolves to nothing —
        // the query is quoted back and a broader search is suggested.
        <div className="kb-picker-state">
          <p className="kb-picker-empty-title">No articles match “{data?.query ?? debounced}”</p>
          <p className="kb-picker-empty-body">
            Try a broader search — fewer words, or a more general term.
          </p>
        </div>
      ) : (
        <ul className="kb-picker-list">
          {results.map((article) => (
            <li key={article.slug}>
              <button type="button" className="kb-picker-result fv" onClick={() => insert(article)}>
                <span className="kb-picker-result-head">
                  <span className="kb-picker-result-title">{article.title}</span>
                  {/* An editor's own drafts appear in their search, labelled,
                      so they can tell unpublished guidance apart at a glance. */}
                  {article.status !== 'published' && (
                    <span className="kb-picker-result-status">{article.status_label}</span>
                  )}
                </span>
                {article.category && (
                  <span className="kb-picker-result-category">{article.category.name}</span>
                )}
                {article.excerpt && <span className="kb-picker-result-excerpt">{article.excerpt}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
