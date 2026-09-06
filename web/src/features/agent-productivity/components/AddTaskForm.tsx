import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useT } from '../../../i18n';
import { makeTaskSchema, type TaskFormValues } from '../model/taskSchema';
import { useCreateTicketTask } from '../hooks/useTicketTasks';
import { useMentionableUsers } from '../hooks/useMentionableUsers';
import { useAuth } from '../../auth/AuthContext';

type Props = { ticketId: number; onDone: () => void; onCancel: () => void };

/** The "New task" form (`10.WisalTicketTasks` · "Add task form" artboard). */
export function AddTaskForm({ ticketId, onDone, onCancel }: Props) {
  const { t } = useT('productivity');
  const taskSchema = useMemo(() => makeTaskSchema(t), [t]);
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
      setServerError(t('addTask.saveFailed'));
    }
  });

  return (
    <form className="add-task-form" onSubmit={onSubmit}>
      <p className="add-task-form-title">{t('addTask.title')}</p>

      <label className="add-task-field">
        <span>{t('addTask.taskLabel')}</span>
        <input
          type="text"
          className="fv"
          placeholder={t('addTask.placeholder')}
          {...register('title')}
        />
        {errors.title && <span className="add-task-error">{errors.title.message}</span>}
      </label>

      <label className="add-task-field">
        <span>{t('addTask.dueDateTime')}</span>
        <input type="datetime-local" className="fv" {...register('due_at')} />
      </label>

      <label className="add-task-field">
        <span>{t('addTask.assignee')}</span>
        <select className="fv" {...register('assignee_id', { valueAsNumber: true })}>
          {user && <option value={user.id}>{user.name} {t('addTask.me')}</option>}
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
          {t('addTask.cancel')}
        </button>
        <button type="submit" className="tq-btn-primary" disabled={isSubmitting}>
          {t('addTask.save')}
        </button>
      </div>
    </form>
  );
}
