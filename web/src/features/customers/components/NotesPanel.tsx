import React, { useState } from 'react';
import { useCreateCustomerNote, useCustomerNotes } from '../hooks/useCustomerNotes';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// Notes are append-only in this story: no edit, no delete. Rendered as
// TEXT (JSX escapes {note.body}) — never dangerouslySetInnerHTML.
export const NotesPanel: React.FC<{ customerId: number }> = ({ customerId }) => {
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
    <section className="profile-panel" aria-label="Notes">
      <h2>Notes</h2>
      <form onSubmit={submit} className="note-form">
        <textarea
          aria-label="Add a note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note for the team…"
        />
        <button type="submit" className="dt-btn dt-btn-primary fv" disabled={createNote.isPending || body.trim() === ''}>
          {createNote.isPending ? 'Adding…' : 'Add note'}
        </button>
      </form>

      {isLoading && <p className="dt-empty-body">Loading notes…</p>}
      {isError && (
        <div>
          <p className="dt-empty-body">Something went wrong loading notes.</p>
          <button type="button" className="dt-btn dt-btn-outline fv" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}
      {!isLoading && !isError && (data?.data.length ?? 0) === 0 && <p className="dt-empty-body">No notes yet.</p>}

      <ul className="note-list">
        {data?.data.map((note) => (
          <li key={note.id} className="note-row">
            <div className="note-meta">
              <span className="note-author">{note.author.name}</span>
              <span dir="ltr" className="note-date">
                {dateFormatter.format(new Date(note.created_at))}
              </span>
            </div>
            <p className="note-body">{note.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
