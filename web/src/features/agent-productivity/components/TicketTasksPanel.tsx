import { useState } from 'react';
import { useT } from '../../../i18n';
import { useTicketTasks, useCompleteTask } from '../hooks/useTicketTasks';
import { dueStateLabel } from '../model/dueStateLabel';
import { AddTaskForm } from './AddTaskForm';
import type { TicketTask } from '../model/task';

/**
 * The ticket-detail sidebar panel (`10.WisalTicketTasks` artboards). All
 * four async states ship; `due_state` is read straight off the resource,
 * never re-derived from a raw timestamp.
 */
export function TicketTasksPanel({ ticketId }: { ticketId: number }) {
  const { t } = useT('productivity');
  const { data, isPending, isError, refetch } = useTicketTasks(ticketId);
  const completeTask = useCompleteTask(ticketId);
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="tasks-panel">
      <div className="tasks-panel-head">
        <p className="meta-section-label">
          {data ? t('tasksPanel.headingWithCount', { count: data.length }) : t('tasksPanel.heading')}
        </p>
        {!isPending && !isError && (
          <button type="button" className="link-btn fv" onClick={() => setShowForm((s) => !s)}>
            {showForm ? t('tasksPanel.cancel') : t('tasksPanel.addTask')}
          </button>
        )}
      </div>

      {showForm && (
        <AddTaskForm
          ticketId={ticketId}
          onDone={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isError ? (
        <div className="tasks-panel-state">
          <p className="tasks-panel-state-title">{t('tasksPanel.loadErrorTitle')}</p>
          <p className="tasks-panel-state-body">{t('tasksPanel.loadErrorBody')}</p>
          <button type="button" className="tq-btn-outline fv" onClick={() => refetch()}>
            {t('tasksPanel.retry')}
          </button>
        </div>
      ) : isPending ? (
        <ul className="task-list" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="task-row">
              <span className="sk task-skeleton-cb" />
              <span className="sk task-skeleton-line" />
            </li>
          ))}
        </ul>
      ) : (data ?? []).length === 0 ? (
        !showForm && (
          <div className="tasks-panel-state">
            <p className="tasks-panel-state-title">{t('tasksPanel.emptyTitle')}</p>
            <p className="tasks-panel-state-body">{t('tasksPanel.emptyBody')}</p>
            <button type="button" className="tq-btn-outline fv" onClick={() => setShowForm(true)}>
              {t('tasksPanel.addFirstTask')}
            </button>
          </div>
        )
      ) : (
        <ul className="task-list">
          {(data ?? []).map((task: TicketTask) => (
            <li key={task.id} className="task-row">
              <input
                type="checkbox"
                className="task-cb fv"
                checked={task.status === 'completed'}
                disabled={task.status !== 'open' || completeTask.isPending}
                aria-label={t('tasksPanel.markComplete', { title: task.title })}
                onChange={() => completeTask.mutate(task.id)}
              />
              <div className="task-row-body">
                <span className={`task-title${task.status !== 'open' ? ' task-title-done' : ''}`}>
                  {task.title}
                </span>
                <span className={`task-due-state task-due-state--${task.due_state}`}>
                  {dueStateLabel(task, t)}
                </span>
              </div>
              {task.assignee && (
                <span className="task-assignee-avatar" title={task.assignee.name}>
                  {task.assignee.initials}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
