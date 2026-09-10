import { screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatCitations } from './ChatCitations';
import { renderPortal } from '../testUtils';
import type { ChatCitation } from '../model/portalChat';

function cite(n: number): ChatCitation {
  return { id: n, slug: `article-${n}`, title: `Help article ${n}` };
}

describe('ChatCitations', () => {
  it('renders nothing for an empty citation array', () => {
    const { container } = renderPortal(<ChatCitations citations={[]} />);

    expect(container.querySelector('.portal-chat-citations')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('renders a labelled chip list, one link per citation, pointing at the public FAQ route', () => {
    const { container } = renderPortal(
      <ChatCitations citations={[cite(1), cite(2), cite(3), cite(4)]} />
    );

    expect(container.querySelector('.portal-chat-citations')).not.toBeNull();
    expect(screen.getByText('Sources')).toHaveClass('portal-chat-citations-label');

    const list = container.querySelector('.portal-chat-citations-list') as HTMLElement;
    expect(within(list).getAllByRole('link')).toHaveLength(4);

    const first = screen.getByRole('link', { name: 'Help article 1' });
    expect(first).toHaveAttribute('href', '/portal/faq/article-1');
    expect(first).toHaveClass('portal-link');
    expect(first).toHaveClass('portal-chat-citation-link');
    expect(first).toHaveAttribute('dir', 'auto');
  });
});
