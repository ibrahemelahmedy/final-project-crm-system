export type AssistArtifact = {
  content: string;
  locale: string;
  model: string;
  created_at: string | null;
  updated_at: string | null;
  dismissed: boolean;
};

export type TicketAssist = {
  enabled: boolean;
  summary: AssistArtifact | null;
  suggestion: AssistArtifact | null;
};

/** The six states from the design reference. `idle` and `dismissed` render the same control but are distinct. */
export type AssistState = 'idle' | 'generating' | 'ready' | 'used' | 'dismissed' | 'failed';
