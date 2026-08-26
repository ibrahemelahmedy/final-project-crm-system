# ticket-management — plan overview

Entry point for the **ticket-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| _add rows as stories are planned_ |

## Dependency notes

_Describe sequencing, shared contracts, or cross-feature dependencies here._

## Carried-forward debt from Story 01 (authentication)

`Ticket::scopeVisibleTo()` (`api/app/Models/Ticket.php`) implements Team Lead
/ Administrator visibility as "all tickets" because no `teams` table exists
yet. The first story here that introduces `teams` **must** narrow that
branch to the Team Lead's own team — see the comment on `canSeeTeamQueue()`
in the same file.
