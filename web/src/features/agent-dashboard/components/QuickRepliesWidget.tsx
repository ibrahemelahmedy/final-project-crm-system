import { useQuickReplies } from '../hooks/useDashboardQueries';
import { DashboardWidget } from './DashboardWidget';
import { widgetState, emptyList } from '../model/widgetState';

/**
 * Quick Replies — canned-response shortcuts. Story 10 (Agent Productivity)
 * owns the data model and ships after this story; until then
 * `GET /api/quick-replies` may 404 and this renders its Empty state. The
 * widget is never deleted and never shows invented data — Story 10 makes it
 * live without changing this contract.
 */
export function QuickRepliesWidget() {
  const query = useQuickReplies();
  const state = widgetState(query, emptyList);
  const replies = query.data ?? [];

  return (
    <DashboardWidget
      title="Quick Replies"
      state={state}
      onRetry={() => query.refetch()}
      errorMessage="Quick replies couldn't load."
      emptyMessage="No quick replies yet. Saved responses you create will appear here for one-click insert."
    >
      <div className="quick-replies-list">
        {replies.map((r) => (
          <button key={r.id} type="button" className="quick-reply-btn" title={r.body ?? r.title}>
            {r.title}
          </button>
        ))}
      </div>
    </DashboardWidget>
  );
}
