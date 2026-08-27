import { useEffect, useState } from 'react';
import type { TicketMeta } from '../model/ticket';
import type { FacetKey, TicketFilters } from '../model/ticketFilters';
import { FACET_LABELS } from '../model/display';
import { FilterChip } from './FilterChip';

type Props = {
  filters: TicketFilters;
  meta: TicketMeta | undefined;
  activeCount: number;
  onFacetChange: (key: FacetKey, next: string[]) => void;
  onSearchChange: (q: string) => void;
  onClearAll: () => void;
};

const UNASSIGNED_OPTION = { value: 'unassigned', label: 'Unassigned' };

export function FilterBar({
  filters,
  meta,
  activeCount,
  onFacetChange,
  onSearchChange,
  onClearAll,
}: Props) {
  // The input is a local text buffer feeding a debounced URL write; the URL
  // remains the single source of truth for `q`. Re-syncing on every external
  // filters.q change is what keeps Back/Forward and Clear-all consistent with
  // it — without that, the box would show stale text after a Back.
  //
  // Done by adjusting state during render, not in an effect, so the input
  // never paints one frame with the old value.
  const [text, setText] = useState(filters.q);
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q);
  }

  // Debounce the URL WRITE by 300ms — TanStack Query keys off the URL-derived
  // filters, so debouncing here covers both the history and the request.
  useEffect(() => {
    if (text === filters.q) return;
    const timer = setTimeout(() => onSearchChange(text), 300);
    return () => clearTimeout(timer);
  }, [text, filters.q, onSearchChange]);

  const agentOptions = [UNASSIGNED_OPTION, ...(meta?.agents ?? [])];

  const facets: { key: FacetKey; options: { value: string; label: string }[] }[] = [
    { key: 'priority', options: meta?.priorities ?? [] },
    { key: 'status', options: meta?.statuses ?? [] },
    { key: 'channel', options: meta?.channels ?? [] },
    { key: 'assigned_to', options: agentOptions },
    { key: 'category', options: meta?.categories ?? [] },
  ];

  return (
    <div className="tq-filters">
      {facets.map(({ key, options }) => (
        <FilterChip
          key={key}
          label={FACET_LABELS[key]}
          options={options}
          selected={filters[key]}
          onChange={(next) => onFacetChange(key, next)}
          onClear={() => onFacetChange(key, [])}
        />
      ))}

      <input
        type="search"
        className="tq-search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search subjects…"
        aria-label="Search ticket subjects"
      />

      {activeCount > 0 && (
        <button type="button" className="tq-clear-all" onClick={onClearAll}>
          Clear all
        </button>
      )}
    </div>
  );
}
