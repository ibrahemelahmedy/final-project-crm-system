// Story 13 — shared vocabulary with the API (App\Enums\CsatSurveyState).

export type CsatState = 'outstanding' | 'answered' | 'expired';

export type CsatTicketRef = { number: string; subject: string };

/** The PUBLIC survey payload — GET /api/csat/{uuid}. Never carries internal data. */
export type CsatSurvey = {
  state: CsatState;
  ticket: CsatTicketRef | null;
  rating: number | null;
  comment: string | null;
  responded_at: string | null;
};

/** The AGENT payload — GET /api/tickets/{ticket}/csat. `none` = no survey yet. */
export type TicketCsat =
  | { state: 'none' }
  | {
      state: CsatState;
      resolution_cycle: number;
      resolved_at: string | null;
      expires_at: string | null;
      share_url: string;
      rating: number | null;
      comment: string | null;
      responded_at: string | null;
    };

export type CsatSubmission = { rating: number; comment?: string };
