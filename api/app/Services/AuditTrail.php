<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * The single write path for the audit trail (Story 08).
 *
 * Every story that logs a sensitive action calls this — no feature writes its
 * own audit rows and no feature calls AuditLog::record() directly any more
 * except Story 01's auth events, which predate this service and stay as they
 * are. Story 06 (SLA rules) and every later admin action come through here.
 *
 * The event-name constants are owned here. Later stories ADD constants; they
 * never rename one, because a renamed event silently orphans every historical
 * row that carries the old string.
 */
class AuditTrail
{
    public const USER_CREATED = 'user.created';
    public const USER_UPDATED = 'user.updated';
    public const USER_ROLE_CHANGED = 'user.role_changed';
    public const USER_DEACTIVATED = 'user.deactivated';
    public const USER_ACTIVATED = 'user.activated';
    public const SETTING_CHANGED = 'setting.changed';

    /** Story 01's auth events. Listed so the viewer's filter can offer them. */
    public const LOGIN_SUCCESS = 'login.success';
    public const LOGIN_FAILED = 'login.failed';
    public const LOGIN_INACTIVE = 'login.inactive';
    public const LOGOUT = 'logout';

    /** Story 06 writes SLA rule changes through this service. */
    public const SLA_RULE_CHANGED = 'sla_rule.changed';

    /**
     * Story 09 (Knowledge Base). Publish, unpublish, and archive are the three
     * article transitions worth an audit row — an ordinary edit is already
     * recoverable from kb_article_versions, so it does not write one here.
     */
    public const KB_ARTICLE_PUBLISHED = 'kb_article.published';

    public const KB_ARTICLE_UNPUBLISHED = 'kb_article.unpublished';

    public const KB_ARTICLE_ARCHIVED = 'kb_article.archived';

    /**
     * Every event name this application can write, for the viewer's filter.
     *
     * @return array<int, string>
     */
    public static function events(): array
    {
        return [
            self::USER_CREATED,
            self::USER_UPDATED,
            self::USER_ROLE_CHANGED,
            self::USER_DEACTIVATED,
            self::USER_ACTIVATED,
            self::SETTING_CHANGED,
            self::SLA_RULE_CHANGED,
            self::KB_ARTICLE_PUBLISHED,
            self::KB_ARTICLE_UNPUBLISHED,
            self::KB_ARTICLE_ARCHIVED,
            self::LOGIN_SUCCESS,
            self::LOGIN_FAILED,
            self::LOGIN_INACTIVE,
            self::LOGOUT,
        ];
    }

    public static function label(string $event): string
    {
        return match ($event) {
            self::USER_CREATED => 'User created',
            self::USER_UPDATED => 'User updated',
            self::USER_ROLE_CHANGED => 'Role changed',
            self::USER_DEACTIVATED => 'User deactivated',
            self::USER_ACTIVATED => 'User activated',
            self::SETTING_CHANGED => 'Setting changed',
            self::SLA_RULE_CHANGED => 'SLA rule changed',
            self::KB_ARTICLE_PUBLISHED => 'Article published',
            self::KB_ARTICLE_UNPUBLISHED => 'Article unpublished',
            self::KB_ARTICLE_ARCHIVED => 'Article archived',
            self::LOGIN_SUCCESS => 'Signed in',
            self::LOGIN_FAILED => 'Failed sign-in',
            self::LOGIN_INACTIVE => 'Blocked sign-in (deactivated)',
            self::LOGOUT => 'Signed out',
            default => $event,
        };
    }

    /**
     * Write one row. `$actor` is who did it; the target goes into `$context`
     * via target() so every consumer records it under the same keys.
     *
     * Wraps AuditLog::record(), which is what strips `password` and
     * `password_confirmation` from the context — that stripping must stay in
     * exactly one place.
     */
    public function record(string $event, ?User $actor, Request $request, array $context = []): void
    {
        AuditLog::record($event, $actor, $request, $context);
    }

    /**
     * Canonical target shape. `target_type` / `target_id` / `target_label` are
     * the three keys the audit viewer reads, so nothing may invent its own.
     *
     * @return array{target_type: string, target_id: int|string|null, target_label: string|null}
     */
    public static function target(string $type, int|string|null $id, ?string $label = null): array
    {
        return [
            'target_type' => $type,
            'target_id' => $id,
            'target_label' => $label,
        ];
    }
}
