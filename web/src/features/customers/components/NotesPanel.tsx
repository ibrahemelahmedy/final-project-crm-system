import React, { useState } from 'react';
import { useT, formatDateTime } from '../../../i18n';
import { useCreateCustomerNote, useCustomerNotes } from '../hooks/useCustomerNotes';

// Notes are append-only in this story: no edit, no delete. Rendered as
// TEXT (JSX escapes {note.body}) — never dangerouslySetInnerHTML.
export const NotesPanel: React.FC<{ customerId: number }> = ({ customerId }) => {
  const { t } = useT('customers');
  const { data, isLoading, isError, refetch } = useCustomerNotes(customerId);
  const createNote = useCreateCustomerNote(customerId);
  const [body, setBody] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim() === '') return;
    await createNote.mutateAsync(body.trim());
    setBody('');
  };

  return (
    <section className="profile-panel" aria-label={t('notes.heading')}>
      <h2>{t('notes.heading')}</h2>
      <form onSubmit={submit} className="note-form">
        <textarea
          aria-label={t('notes.addLabel')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('notes.placeholder')}
        />
        <button type="submit" className="dt-btn dt-btn-primary fv" disabled={createNote.isPending || body.trim() === ''}>
          {createNote.isPending ? t('notes.adding') : t('notes.addButton')}
        </button>
      </form>

      {isLoading && <p className="dt-empty-body">{t('notes.loading')}</p>}
      {isError && (
        <div>
          <p className="dt-empty-body">{t('notes.error')}</p>
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => refetch()}>
            {t('notes.tryAgain')}
          </button>
        </div>
      )}
      {!isLoading && !isError && (data?.data.length ?? 0) === 0 && <p className="dt-empty-body">{t('notes.empty')}</p>}

      <ul className="note-list">
        {data?.data.map((note) => (
          <li key={note.id} className="note-row">
            <div className="note-meta">
              <span className="note-author">{note.author.name}</span>
              <span dir="ltr" className="note-date">
                {formatDateTime(note.created_at)}
              </span>
            </div>
            <p className="note-body">{note.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
