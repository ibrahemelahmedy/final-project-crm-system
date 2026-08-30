<?php

namespace App\Enums;

enum TicketStatus: string
{
    case Open = 'open';
    case Pending = 'pending';
    case Resolved = 'resolved';
    case Closed = 'closed';

    public function label(): string
    {
        return __('enums.ticket_status.'.$this->value);
    }

    /** A closed ticket is finished; a resolved one can still be reopened by a reply. */
    public function isClosed(): bool
    {
        return $this === self::Closed;
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open => [self::Pending, self::Resolved, self::Closed],
            self::Pending => [self::Open, self::Resolved, self::Closed],
            self::Resolved => [self::Open, self::Closed],
            self::Closed => [self::Open],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }

    /** @return array<int, array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases()
        );
    }
}
