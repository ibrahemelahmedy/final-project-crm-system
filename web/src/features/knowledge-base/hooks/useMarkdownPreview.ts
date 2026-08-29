import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { previewMarkdown } from '../api/kbApi';

/**
 * The editor's live preview, rendered by the SERVER.
 *
 * Markdown is deliberately NOT rendered in the browser: the reader displays
 * server-sanitized `body_html`, so a client-side preview would be a second,
 * differently-behaved renderer — and a payload that the client renderer let
 * through would appear safe in the preview while the stored copy differed.
 * One pipeline, one output.
 *
 * Debounced, because this fires per keystroke otherwise.
 */
export function useMarkdownPreview(body: string, delayMs = 400) {
  const [debounced, setDebounced] = useState(body);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(body), delayMs);
    return () => window.clearTimeout(id);
  }, [body, delayMs]);

  return useQuery({
    queryKey: ['kb', 'preview', debounced],
    queryFn: () => previewMarkdown(debounced),
    // An empty body has an empty render — do not round-trip for it.
    enabled: debounced.trim().length > 0,
    // Keeps the last render on screen while the next one is in flight, so the
    // preview pane does not blank out on every pause in typing.
    placeholderData: keepPreviousData,
  });
}
