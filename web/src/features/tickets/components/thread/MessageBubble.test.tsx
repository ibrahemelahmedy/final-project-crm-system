import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageBubble } from './MessageBubble';
import { makeMessage } from './testUtils';

describe('MessageBubble', () => {
  it('aligns by author_type, not is_mine', () => {
    const { container: mine } = render(
      <ul>
        <MessageBubble message={makeMessage({ author_type: 'agent', is_mine: true })} />
      </ul>
    );
    expect(mine.querySelector('.thread-row--out')).toBeInTheDocument();

    const { container: other } = render(
      <ul>
        <MessageBubble message={makeMessage({ author_type: 'agent', is_mine: false })} />
      </ul>
    );
    expect(other.querySelector('.thread-row--out')).toBeInTheDocument();

    const { container: inbound } = render(
      <ul>
        <MessageBubble message={makeMessage({ author_type: 'customer' })} />
      </ul>
    );
    expect(inbound.querySelector('.thread-row--out')).not.toBeInTheDocument();
  });

  it('renders an HTML body as text, never as markup', () => {
    const { container } = render(
      <ul>
        <MessageBubble message={makeMessage({ body: '<img src=x onerror=alert(1)>' })} />
      </ul>
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
