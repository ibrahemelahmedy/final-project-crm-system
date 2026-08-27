import type { Ticket } from '../model/ticket';

import { TicketTableHeader } from './TicketTableHeader';
import { TicketRow } from './TicketRow';

import type { SortKey } from '../model/columns';

type Props = {
  tickets: Ticket[];
  sort: string;
  onSortChange: (key: SortKey) => void;
  selected: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  /** Dims the table while a page is in flight, per isPlaceholderData. */
  dimmed?: boolean;
};

/**
 * A real <table>/<thead>/<th scope="col">/<tr>/<td>. The exports use nested
 * <div style="display:grid">, which announces as nothing to a screen reader —
 * the grid metrics come from the design, the semantics come from the elements.
 */
export function TicketTable({
  tickets,
  sort,
  onSortChange,
  selected,
  onToggle,
  onToggleAll,
  dimmed = false,
}: Props) {
  const allSelected = tickets.length > 0 && tickets.every((t) => selected.includes(t.id));
  const someSelected = tickets.some((t) => selected.includes(t.id));

  return (
    <div className="tq-table-scroll">
      <table className="tq-table" data-dimmed={dimmed ? 'true' : 'false'}>
        <caption className="tq-sr-only">Ticket queue</caption>
        <TicketTableHeader
          sort={sort}
          onSortChange={onSortChange}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleAll={onToggleAll}
        />
        <tbody>
          {tickets.map((ticket, index) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              zebra={index % 2 === 1}
              selected={selected.includes(ticket.id)}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
