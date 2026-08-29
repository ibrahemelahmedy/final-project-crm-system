import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ticket } from '../../model/ticket';
import { replySchema } from '../../model/replySchema';
import { ComposerChannelBadge } from './ComposerChannelBadge';
import { MentionAutocomplete } from '../../../agent-productivity/components/MentionAutocomplete';
import type { MentionableUser } from '../../../agent-productivity/model/mentionableUser';

type ComposerMode = 'public' | 'internal';

type ReplyComposerProps = {
  ticket: Ticket;
  onSend: (body: string) => Promise<unknown>;
  isSending: boolean;
  /**
   * Story 09 mounts ArticlePickerPanel against this. The composer calls it once
   * with its own caret-insert function; the panel then invokes that to splice a
   * reference at the caret. Story 09 supplies the string and owns its format.
   */
  onInsertAtCaret?: (insert: (text: string) => void) => void;
  /** Story 10 mounts QuickReplyPicker (and its trigger) in this row. */
  toolbarSlot?: React.ReactNode;
  /**
   * Story 10: submits an INTERNAL NOTE — never visible to the customer.
   * Omitting this prop hides the "Internal note" mode entirely, so an
   * unrelated composer mount is unaffected.
   */
  onSendNote?: (body: string, mentionedUserIds: number[]) => Promise<unknown>;
};

const ARROW_LTR = 'M5 12h14 M13 6l6 6-6 6';
const ARROW_RTL = 'M19 12H5 M11 6l-6 6 6 6';

function isRtl(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
}

/** The unfinished "@token" ending at `caret`, or null if the caret isn't inside one. */
function activeMentionQuery(value: string, caret: number): string | null {
  const upToCaret = value.slice(0, caret);
  const at = upToCaret.lastIndexOf('@');
  if (at === -1) return null;
  const token = upToCaret.slice(at + 1);
  if (/\s/.test(token)) return null; // the @ belongs to an earlier, finished token
  return token;
}

export function ReplyComposer({
  ticket,
  onSend,
  isSending,
  onInsertAtCaret,
  toolbarSlot,
  onSendNote,
}: ReplyComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('public');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<Map<number, string>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCaret = useCallback((text: string) => {
    const ta = taRef.current;
    if (!ta) {
      setValue((v) => v + text);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    setValue((v) => v.slice(0, start) + text + v.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + text.length;
      ta.setSelectionRange(caret, caret);
    });
  }, []);

  useEffect(() => {
    onInsertAtCaret?.(insertAtCaret);
  }, [onInsertAtCaret, insertAtCaret]);

  const reset = () => {
    setValue('');
    setMentionedUsers(new Map());
    setMentionQuery(null);
  };

  const submitPublic = useCallback(async () => {
    const parsed = replySchema.safeParse({ body: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Write a reply before sending.');
      return;
    }
    setError(null);
    setFailed(false);
    try {
      await onSend(parsed.data.body);
      reset(); // cleared on success ONLY
    } catch {
      setFailed(true);
      taRef.current?.focus();
    }
  }, [value, onSend]);

  const submitNote = useCallback(async () => {
    const parsed = replySchema.safeParse({ body: value });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Write a note before saving.');
      return;
    }
    if (!onSendNote) return;
    setError(null);
    setFailed(false);
    // Only mentions whose "@Name" text is still present survive a later edit.
    const survivingIds = Array.from(mentionedUsers.entries())
      .filter(([, name]) => parsed.data.body.includes(`@${name}`))
      .map(([id]) => id);
    try {
      await onSendNote(parsed.data.body, survivingIds);
      reset(); // the note text is preserved on failure, per the artboard
    } catch {
      setFailed(true);
      taRef.current?.focus();
    }
  }, [value, onSendNote, mentionedUsers]);

  const submit = mode === 'internal' ? submitNote : submitPublic;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
      // MentionAutocomplete owns these keys via its own window listener.
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    if (error) setError(null);
    if (mode === 'internal') {
      setMentionQuery(activeMentionQuery(next, e.target.selectionStart ?? next.length));
    }
  };

  const selectMention = useCallback(
    (user: MentionableUser) => {
      const ta = taRef.current;
      const caret = ta?.selectionStart ?? value.length;
      const upToCaret = value.slice(0, caret);
      const at = upToCaret.lastIndexOf('@');
      if (at === -1) return;
      const before = value.slice(0, at);
      const after = value.slice(caret);
      const insertion = `@${user.name} `;
      const next = before + insertion + after;
      setValue(next);
      setMentionedUsers((m) => new Map(m).set(user.id, user.name));
      setMentionQuery(null);
      requestAnimationFrame(() => {
        ta?.focus();
        const newCaret = before.length + insertion.length;
        ta?.setSelectionRange(newCaret, newCaret);
      });
    },
    [value]
  );

  const trimmedEmpty = value.trim().length === 0;
  const arrow = isRtl() ? ARROW_RTL : ARROW_LTR;
  const showModeTabs = Boolean(onSendNote);

  const placeholder = useMemo(
    () => (mode === 'internal' ? 'Add an internal note…' : 'Type a reply…'),
    [mode]
  );

  return (
    <div className="thread-composer" data-mode={mode}>
      {/* AI-suggested reply (design export lines 120-125) is NOT built in this story.
          The intake defers AI; this node reserves the position so the feature lands
          without moving another element. It renders nothing: no pill, no disabled
          button, no "Coming soon". A suggestion the product cannot generate must not
          be depicted. */}
      <div className="thread-assist-slot" />

      <div className="composer-toolbar-row">
        <ComposerChannelBadge channel={ticket.channel} label={ticket.channel_label} />
        {showModeTabs && (
          <div className="composer-mode-tabs" role="tablist" aria-label="Composer mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'public'}
              className={`mode-tab${mode === 'public' ? ' mode-tab-active-reply' : ''}`}
              onClick={() => {
                setMode('public');
                setError(null);
                setFailed(false);
              }}
            >
              Reply to customer
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'internal'}
              className={`mode-tab${mode === 'internal' ? ' mode-tab-active-note' : ''}`}
              onClick={() => {
                setMode('internal');
                setError(null);
                setFailed(false);
              }}
            >
              Internal note
            </button>
          </div>
        )}
      </div>

      {mode === 'internal' && (
        <div className="composer-note-banner" role="status">
          Not visible to customer
        </div>
      )}

      {toolbarSlot}

      <div className="composer-card" data-mode={mode}>
        <label className="tq-sr-only" htmlFor="reply-body">
          {mode === 'internal' ? `Internal note on ticket #${ticket.id}` : `Reply to ticket #${ticket.id}`}
        </label>
        <div className="composer-textarea-wrap">
          <textarea
            id="reply-body"
            ref={taRef}
            className="composer-textarea"
            rows={2}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
          {mode === 'internal' && mentionQuery !== null && (
            <MentionAutocomplete
              ticketId={ticket.id}
              query={mentionQuery}
              onSelect={selectMention}
              onDismiss={() => setMentionQuery(null)}
            />
          )}
        </div>
        <div className="composer-actions">
          {mode === 'internal' && <span className="composer-note-footer">Internal only · agents see this</span>}
          <button
            type="button"
            className="composer-send"
            onClick={() => void submit()}
            disabled={trimmedEmpty || isSending}
          >
            {mode === 'internal' ? 'Add internal note' : 'Send'}
            {mode === 'public' && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={arrow} />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && !failed && <p className="composer-error">{error}</p>}

      {failed && (
        <div className="composer-error" role="alert">
          <span>
            {mode === 'internal'
              ? "Couldn't save — your note is still here. Check your connection and retry."
              : 'Your reply could not be sent.'}
          </span>
          <button type="button" className="tq-btn-outline" onClick={() => void submit()}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export type { ReplyComposerProps };
