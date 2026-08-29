import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema, type TaskFormValues } from '../model/taskSchema';
import { useCreateTicketTask } from '../hooks/useTicketTasks';
import { useMentionableUsers } from '../hooks/useMentionableUsers';
import { useAuth } from '../../auth/AuthContext';

type Props = { ticketId: number; onDone: () => void; onCancel: () => void };

/** The "New task" form (`10.WisalTicketTasks` · "Add task form" artboard). */
export function AddTaskForm({ ticketId, onDone, onCancel }: Props) {
  const { user } = useAuth();
  const { data: colleagues } = useMentionableUsers(ticketId, true);
  const createTask = useCreateTicketTask(ticketId);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', due_at: '', assignee_id: user?.id ?? null },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createTask.mutateAsync({
        ...values,
        due_at: values.due_at || null,
        assignee_id: values.assignee_id ?? undefined,
      });
      onDone();
    } catch {
      setServerError('The task could not be saved. Try again.');
    }
  });

  return (
    <form className="add-task-form" onSubmit={onSubmit}>
      <p className="add-task-form-title">New task</p>

      <label className="add-task-field">
        <span>Task</span>
        <input
          type="text"
          className="fv"
          placeholder="e.g. Call customer back on Thursday"
          {...register('title')}
        />
        {errors.title && <span className="add-task-error">{errors.title.message}</span>}
      </label>

      <label className="add-task-field">
        <span>Due date &amp; time</span>
        <input type="datetime-local" className="fv" {...register('due_at')} />
      </label>

      <label className="add-task-field">
        <span>Assignee</span>
        <select className="fv" {...register('assignee_id', { valueAsNumber: true })}>
          {user && <option value={user.id}>{user.name} (me)</option>}
          {colleagues?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {serverError && <p className="add-task-error">{serverError}</p>}

      <div className="add-task-actions">
        <button type="button" className="tq-btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="tq-btn-primary" disabled={isSubmitting}>
          Save task
        </button>
      </div>
    </form>
  );
}
