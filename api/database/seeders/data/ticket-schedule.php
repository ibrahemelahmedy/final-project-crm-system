<?php

/**
 * Story 21 (WIS-25) — the schedule: 64 ticket instances in four status blocks.
 *
 * Loaded with `require` (NOT autoloaded). Every row references a `key` from
 * data/ticket-scenarios.php; a scenario may appear more than once. `note` is
 * informational only.
 *
 * Age model (plan Decision 4): open/pending rows carry ['hours' => N] and the
 * exact offset is preserved so the SLA verdict is deterministic. resolved/closed
 * rows carry ['days' => N, 'resolve_hours' => N, ...] and the time of day is
 * jittered.
 *
 * Encoded invariants (asserted in SeededDataRealismTest):
 *  - 64 tickets: open 20, pending 12, resolved 14, closed 18
 *  - channel: email 30, chat 14, web_form 9, whatsapp 8, sms 3
 *  - assignee: agent1 29, agent2 27, unassigned 8 (all unassigned are Open)
 *  - 2 zero-message tickets (A-19, A-20), both Open
 *  - oldest created_at 42 days (D-08); newest 1 hour (A-19)
 *  - running-clock verdicts: breached 3, at_risk 3 (Open only)
 *  - finished-clock verdicts: breached 2 (C-07, D-09)
 */

return [
    // ================= Block A — open, 20 rows =========================
    // A-01..A-08 unassigned, customer-only threads (nobody has replied).
    ['key' => 'tech-03', 'status' => 'open', 'priority' => 'normal', 'channel' => 'web_form', 'assignee' => null, 'age' => ['hours' => 5], 'turns' => 1, 'note' => 'ok'],
    ['key' => 'gen-01', 'status' => 'open', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => null, 'age' => ['hours' => 30], 'turns' => 1, 'note' => 'ok'],
    ['key' => 'feat-01', 'status' => 'open', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => null, 'age' => ['hours' => 52], 'turns' => 2, 'note' => 'ok'],
    ['key' => 'acct-08', 'status' => 'open', 'priority' => 'low', 'channel' => 'email', 'assignee' => null, 'age' => ['hours' => 9], 'turns' => 1, 'note' => 'ok'],
    ['key' => 'gen-04', 'status' => 'open', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => null, 'age' => ['hours' => 76], 'turns' => 1, 'note' => 'ok'],
    ['key' => 'feat-04', 'status' => 'open', 'priority' => 'low', 'channel' => 'email', 'assignee' => null, 'age' => ['hours' => 21], 'turns' => 2, 'note' => 'ok'],
    ['key' => 'bill-07', 'status' => 'open', 'priority' => 'normal', 'channel' => 'email', 'assignee' => null, 'age' => ['hours' => 3], 'turns' => 1, 'note' => 'ok'],
    ['key' => 'gen-06', 'status' => 'open', 'priority' => 'low', 'channel' => 'chat', 'assignee' => null, 'age' => ['hours' => 14], 'turns' => 1, 'note' => 'ok'],
    ['key' => 'tech-01', 'status' => 'open', 'priority' => 'high', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['hours' => 9], 'turns' => 4, 'note' => 'breached'],
    ['key' => 'tech-06', 'status' => 'open', 'priority' => 'urgent', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['hours' => 5], 'turns' => 3, 'note' => 'breached'],
    ['key' => 'tech-09', 'status' => 'open', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['hours' => 20], 'turns' => 4, 'note' => 'at_risk'],
    ['key' => 'tech-12', 'status' => 'open', 'priority' => 'high', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['hours' => 7], 'turns' => 3, 'note' => 'at_risk'],
    ['key' => 'acct-04', 'status' => 'open', 'priority' => 'normal', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['hours' => 6], 'turns' => 3, 'note' => 'ok'],
    ['key' => 'gen-03', 'status' => 'open', 'priority' => 'low', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['hours' => 40], 'turns' => 2, 'note' => 'ok'],
    ['key' => 'bill-01', 'status' => 'open', 'priority' => 'high', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['hours' => 10], 'turns' => 4, 'note' => 'breached'],
    ['key' => 'bill-04', 'status' => 'open', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['hours' => 22], 'turns' => 5, 'note' => 'at_risk'],
    ['key' => 'bill-08', 'status' => 'open', 'priority' => 'normal', 'channel' => 'whatsapp', 'assignee' => 'agent2', 'age' => ['hours' => 4], 'turns' => 3, 'note' => 'ok'],
    ['key' => 'acct-01', 'status' => 'open', 'priority' => 'urgent', 'channel' => 'sms', 'assignee' => 'agent2', 'age' => ['hours' => 2], 'turns' => 3, 'note' => 'ok'],
    ['key' => 'acct-05', 'status' => 'open', 'priority' => 'urgent', 'channel' => 'chat', 'assignee' => 'agent2', 'age' => ['hours' => 1], 'turns' => 0, 'note' => 'empty-state: just arrived, no reply yet'],
    ['key' => 'feat-06', 'status' => 'open', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => 'agent2', 'age' => ['hours' => 6], 'turns' => 0, 'note' => 'empty-state: just arrived, no reply yet'],

    // ================= Block B — pending, 12 rows ======================
    ['key' => 'tech-04', 'status' => 'pending', 'priority' => 'high', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['hours' => 26], 'turns' => 5],
    ['key' => 'tech-05', 'status' => 'pending', 'priority' => 'normal', 'channel' => 'whatsapp', 'assignee' => 'agent1', 'age' => ['hours' => 34], 'turns' => 4],
    ['key' => 'tech-07', 'status' => 'pending', 'priority' => 'normal', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['hours' => 18], 'turns' => 4],
    ['key' => 'tech-10', 'status' => 'pending', 'priority' => 'low', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['hours' => 60], 'turns' => 3],
    ['key' => 'acct-02', 'status' => 'pending', 'priority' => 'normal', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['hours' => 12], 'turns' => 4],
    ['key' => 'gen-05', 'status' => 'pending', 'priority' => 'low', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['hours' => 48], 'turns' => 3],
    ['key' => 'feat-02', 'status' => 'pending', 'priority' => 'low', 'channel' => 'whatsapp', 'assignee' => 'agent1', 'age' => ['hours' => 70], 'turns' => 3],
    ['key' => 'bill-03', 'status' => 'pending', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['hours' => 30], 'turns' => 5],
    ['key' => 'bill-05', 'status' => 'pending', 'priority' => 'high', 'channel' => 'whatsapp', 'assignee' => 'agent2', 'age' => ['hours' => 16], 'turns' => 4],
    ['key' => 'bill-06', 'status' => 'pending', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['hours' => 44], 'turns' => 4],
    ['key' => 'acct-03', 'status' => 'pending', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['hours' => 25], 'turns' => 4],
    ['key' => 'acct-07', 'status' => 'pending', 'priority' => 'high', 'channel' => 'chat', 'assignee' => 'agent2', 'age' => ['hours' => 11], 'turns' => 3],

    // ================= Block C — resolved, 14 rows =====================
    // resolved_at = created_at + resolve_hours; closed_at stays null.
    ['key' => 'tech-02', 'status' => 'resolved', 'priority' => 'high', 'channel' => 'whatsapp', 'assignee' => 'agent1', 'age' => ['days' => 6, 'resolve_hours' => 5], 'turns' => 5, 'note' => 'mixed-channel'],
    ['key' => 'tech-08', 'status' => 'resolved', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 11, 'resolve_hours' => 18], 'turns' => 6, 'note' => 'internal-note'],
    ['key' => 'tech-11', 'status' => 'resolved', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 15, 'resolve_hours' => 20], 'turns' => 5],
    ['key' => 'acct-06', 'status' => 'resolved', 'priority' => 'low', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 9, 'resolve_hours' => 40], 'turns' => 4],
    ['key' => 'gen-02', 'status' => 'resolved', 'priority' => 'low', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['days' => 4, 'resolve_hours' => 2], 'turns' => 3],
    ['key' => 'feat-03', 'status' => 'resolved', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => 'agent1', 'age' => ['days' => 19, 'resolve_hours' => 60], 'turns' => 4],
    ['key' => 'tech-09', 'status' => 'resolved', 'priority' => 'high', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['days' => 8, 'resolve_hours' => 9], 'turns' => 5, 'note' => 'breached (target 8h)'],
    ['key' => 'bill-02', 'status' => 'resolved', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['days' => 7, 'resolve_hours' => 6], 'turns' => 5],
    ['key' => 'bill-04', 'status' => 'resolved', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['days' => 13, 'resolve_hours' => 22], 'turns' => 6],
    ['key' => 'bill-08', 'status' => 'resolved', 'priority' => 'low', 'channel' => 'whatsapp', 'assignee' => 'agent2', 'age' => ['days' => 5, 'resolve_hours' => 30], 'turns' => 4],
    ['key' => 'acct-01', 'status' => 'resolved', 'priority' => 'urgent', 'channel' => 'sms', 'assignee' => 'agent2', 'age' => ['days' => 3, 'resolve_hours' => 2], 'turns' => 4],
    ['key' => 'acct-05', 'status' => 'resolved', 'priority' => 'high', 'channel' => 'chat', 'assignee' => 'agent2', 'age' => ['days' => 17, 'resolve_hours' => 5], 'turns' => 5],
    ['key' => 'gen-01', 'status' => 'resolved', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => 'agent2', 'age' => ['days' => 21, 'resolve_hours' => 70], 'turns' => 3],
    ['key' => 'feat-05', 'status' => 'resolved', 'priority' => 'low', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['days' => 24, 'resolve_hours' => 90], 'turns' => 4],

    // ================= Block D — closed, 18 rows =======================
    // resolved_at = created_at + resolve_hours; closed_at = resolved_at + close_days.
    ['key' => 'tech-01', 'status' => 'closed', 'priority' => 'high', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 28, 'resolve_hours' => 6, 'close_days' => 2], 'turns' => 36, 'note' => 'the long thread (Task 6)'],
    ['key' => 'tech-03', 'status' => 'closed', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 31, 'resolve_hours' => 15, 'close_days' => 2], 'turns' => 5],
    ['key' => 'tech-06', 'status' => 'closed', 'priority' => 'urgent', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['days' => 26, 'resolve_hours' => 3, 'close_days' => 1], 'turns' => 6, 'note' => 'internal-note'],
    ['key' => 'tech-12', 'status' => 'closed', 'priority' => 'high', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 35, 'resolve_hours' => 7, 'close_days' => 3], 'turns' => 5],
    ['key' => 'acct-02', 'status' => 'closed', 'priority' => 'normal', 'channel' => 'chat', 'assignee' => 'agent1', 'age' => ['days' => 23, 'resolve_hours' => 10, 'close_days' => 2], 'turns' => 5],
    ['key' => 'acct-04', 'status' => 'closed', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 38, 'resolve_hours' => 20, 'close_days' => 2], 'turns' => 4],
    ['key' => 'gen-03', 'status' => 'closed', 'priority' => 'low', 'channel' => 'email', 'assignee' => 'agent1', 'age' => ['days' => 40, 'resolve_hours' => 50, 'close_days' => 3], 'turns' => 4],
    ['key' => 'feat-01', 'status' => 'closed', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => 'agent1', 'age' => ['days' => 42, 'resolve_hours' => 100, 'close_days' => 3], 'turns' => 5, 'note' => 'the oldest ticket'],
    ['key' => 'tech-07', 'status' => 'closed', 'priority' => 'high', 'channel' => 'whatsapp', 'assignee' => 'agent1', 'age' => ['days' => 29, 'resolve_hours' => 12, 'close_days' => 2], 'turns' => 6, 'note' => 'breached (target 8h)'],
    ['key' => 'bill-01', 'status' => 'closed', 'priority' => 'high', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['days' => 27, 'resolve_hours' => 5, 'close_days' => 2], 'turns' => 6, 'note' => 'mixed-channel (Task 6)'],
    ['key' => 'bill-03', 'status' => 'closed', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['days' => 33, 'resolve_hours' => 16, 'close_days' => 2], 'turns' => 5],
    ['key' => 'bill-05', 'status' => 'closed', 'priority' => 'high', 'channel' => 'whatsapp', 'assignee' => 'agent2', 'age' => ['days' => 25, 'resolve_hours' => 4, 'close_days' => 1], 'turns' => 5],
    ['key' => 'bill-06', 'status' => 'closed', 'priority' => 'normal', 'channel' => 'sms', 'assignee' => 'agent2', 'age' => ['days' => 36, 'resolve_hours' => 21, 'close_days' => 3], 'turns' => 4],
    ['key' => 'bill-07', 'status' => 'closed', 'priority' => 'low', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['days' => 39, 'resolve_hours' => 65, 'close_days' => 2], 'turns' => 4],
    ['key' => 'acct-03', 'status' => 'closed', 'priority' => 'normal', 'channel' => 'email', 'assignee' => 'agent2', 'age' => ['days' => 30, 'resolve_hours' => 19, 'close_days' => 2], 'turns' => 5],
    ['key' => 'acct-07', 'status' => 'closed', 'priority' => 'urgent', 'channel' => 'chat', 'assignee' => 'agent2', 'age' => ['days' => 22, 'resolve_hours' => 3, 'close_days' => 1], 'turns' => 5],
    ['key' => 'gen-04', 'status' => 'closed', 'priority' => 'low', 'channel' => 'web_form', 'assignee' => 'agent2', 'age' => ['days' => 41, 'resolve_hours' => 80, 'close_days' => 3], 'turns' => 3],
    ['key' => 'feat-04', 'status' => 'closed', 'priority' => 'low', 'channel' => 'chat', 'assignee' => 'agent2', 'age' => ['days' => 37, 'resolve_hours' => 110, 'close_days' => 4], 'turns' => 4],
];
