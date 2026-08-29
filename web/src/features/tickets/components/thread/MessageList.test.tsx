import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessageList } from './MessageList';
import { flattenChronological } from '../../hooks/useTicketMessages';
import { makeMessage } from './testUtils';

describe('MessageList / flattenChronological', () => {
  it('renders messages oldest -> newest across two API pages', () => {
    // API returns newest-first per page; page 0 is the newest slice.
    const page0 = { data: [makeMessage({ id: 5 }), makeMessage({ id: 4 }), makeMessage({ id: 3 })] };
    const page1 = { data: [makeMessage({ id: 2 }), makeMessage({ id: 1 })] };

    const flat = flattenChronological([page0, page1]);
    expect(flat.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);

    render(
      <MessageList
        messages={flat}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadEarlier={() => {}}
        scrollRef={null}
      />
    );

    const items = screen.getAllByRole('listitem').filter((li) => li.querySelector('.thread-bubble'));
    expect(items).toHaveLength(5);
  });

  it('hides "Load earlier messages" when hasNextPage is false and calls fetch once when true', () => {
    const onLoadEarlier = vi.fn();
    const { rerender } = render(
      <MessageList
        messages={[makeMessage()]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadEarlier={onLoadEarlier}
        scrollRef={null}
      />
    );
    expect(screen.queryByText('Load earlier messages')).not.toBeInTheDocument();

    rerender(
      <MessageList
        messages={[makeMessage()]}
        hasNextPage
        isFetchingNextPage={false}
        onLoadEarlier={onLoadEarlier}
        scrollRef={null}
      />
    );
    fireEvent.click(screen.getByText('Load earlier messages'));
    expect(onLoadEarlier).toHaveBeenCalledTimes(1);
  });
});
