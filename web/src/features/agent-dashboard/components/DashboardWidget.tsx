import React from 'react';
import type { WidgetState } from '../model/widgetState';

export type { WidgetState } from '../model/widgetState';

type Props = {
  title: React.ReactNode;
  state: WidgetState;
  /** Visual accent — 'warning' matches the SLA-breach artboard's amber card. */
  tone?: 'default' | 'warning';
  /** Empty-state copy. Must name a next action per the design brief. */
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  errorMessage?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
  className?: string;
};

/**
 * The one card frame + four-state switch every dashboard widget renders
 * inside. No widget hand-rolls a skeleton, an empty state, or an error state.
 *
 * A zero count is never an error and an error is never a zero: `empty` and
 * `error` are distinct explicit states chosen by the widget from its own
 * query result (`isError` vs. a 200 with an empty list).
 */
export function DashboardWidget({
  title,
  state,
  tone = 'default',
  emptyMessage,
  emptyAction,
  errorMessage,
  onRetry,
  children,
  className,
}: Props) {
  return (
    <section
      className={`dw${tone === 'warning' ? ' dw-warning' : ''}${className ? ` ${className}` : ''}`}
      aria-busy={state === 'loading'}
    >
      <h2 className="dw-title">{title}</h2>

      {state === 'loading' && (
        <div className="dw-skeleton" role="status">
          <span className="tq-sr-only">Loading {typeof title === 'string' ? title : 'widget'}…</span>
          <span className="dw-skeleton-row" />
          <span className="dw-skeleton-row" />
          <span className="dw-skeleton-row" />
        </div>
      )}

      {state === 'error' && (
        <div className="dw-state dw-state-error" role="alert">
          <p>{errorMessage ?? "This widget couldn't load."}</p>
          {onRetry && (
            <button type="button" className="dw-retry" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}

      {state === 'empty' && (
        <div className="dw-state dw-state-empty">
          <p>{emptyMessage}</p>
          {emptyAction}
        </div>
      )}

      {state === 'ready' && children}
    </section>
  );
}
