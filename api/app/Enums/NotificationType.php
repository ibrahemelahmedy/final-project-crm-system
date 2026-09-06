<?php

namespace App\Enums;

/**
 * Notification Centre (Story 11) type registry. OWNED HERE. The `notifications.type`
 * column is a plain string; this enum is the single source of truth for every
 * value that can land in it. Framework class names — Laravel's own
 * notification classes, job classes, anything from `App\Notifications\*` —
 * must NEVER appear as a `type` value. Adding a producer is a new case here,
 * never a migration.
 */
enum NotificationType: string
{
    case SlaAtRisk = 'sla_at_risk';
    case SlaBreached = 'sla_breached';
    case Mention = 'mention';
    case TaskDue = 'task_due';
    // Story 17 (WIS-16): a customer replied to their portal request.
    case CustomerReplied = 'customer_replied';

    public function label(): string
    {
        return match ($this) {
            self::SlaAtRisk => 'SLA at risk',
            self::SlaBreached => 'SLA breached',
            self::Mention => 'Mention',
            self::TaskDue => 'Task due',
            self::CustomerReplied => 'Customer replied',
        };
    }

    /** The panel/page icon + tone key — WisalNotifications-*.dc.html rows. */
    public function tone(): string
    {
        return match ($this) {
            self::SlaAtRisk => 'warning',
            self::SlaBreached => 'danger',
            self::Mention => 'info',
            self::TaskDue => 'success',
            self::CustomerReplied => 'info',
        };
    }

    /** @return array<int, string> */
    public static function values(): array
    {
        return array_map(fn (self $c) => $c->value, self::cases());
    }
}
