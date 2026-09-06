<?php

namespace App\Services;

use App\Exceptions\PortalCodeUnusableException;
use App\Models\Customer;
use App\Models\PortalAccessCode;
use App\Models\PortalSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Story 17 (WIS-16, Customer Portal). The whole OTP state machine, so no
 * controller holds policy. See ADR-005 and the story plan's Decision 1 for
 * why OTP was chosen over a magic link.
 */
final class PortalAccess
{
    public const MAX_ATTEMPTS = 5;

    public const RESEND_COOLDOWN_SECONDS = 60;

    public const CODE_TTL_MINUTES = 10;

    public const SESSION_TTL_HOURS = 24;

    public function __construct(private PortalCodeNotifier $notifier) {}

    /**
     * Normalises, resolves a live customer, issues + delivers a code. Silent
     * (no row written, no exception) when nothing matches — the caller's 202
     * must be identical either way, so an identifier is never enumerable.
     */
    public function requestCode(string $identifier, ?string $ip): void
    {
        $normalized = self::normalize($identifier);

        if ($normalized === null) {
            return;
        }

        $customer = $this->resolveCustomer($normalized);

        if ($customer === null) {
            return;
        }

        if ($this->cooldownRemaining($normalized) > 0) {
            return;
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($customer, $normalized, $code, $ip) {
            // Exactly one code is live per customer at a time.
            PortalAccessCode::query()
                ->where('customer_id', $customer->id)
                ->whereNull('consumed_at')
                ->update(['consumed_at' => now()]);

            PortalAccessCode::create([
                'customer_id' => $customer->id,
                'identifier' => $normalized,
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
                'consumed_at' => null,
                'request_ip' => $ip,
            ]);
        });

        // After the transaction commits — a delivery failure must not roll
        // back an issued code and leave the customer holding one the
        // database has never seen.
        $this->notifier->send($customer, $code, $normalized);
    }

    /**
     * @return PortalSession|null  null = wrong code (caller reports attempts_remaining)
     *
     * @throws PortalCodeUnusableException when the newest code for this
     *   identifier is missing, consumed, expired, or attempt-exhausted.
     */
    public function verify(string $identifier, string $code, ?string $userAgent): ?PortalSession
    {
        $normalized = self::normalize($identifier);

        if ($normalized === null) {
            return null;
        }

        $row = PortalAccessCode::query()
            ->where('identifier', $normalized)
            ->orderByDesc('id')
            ->first();

        if ($row === null || ! $row->isUsable()) {
            throw new PortalCodeUnusableException();
        }

        if (! Hash::check($code, $row->code_hash)) {
            $row->increment('attempts');

            return null;
        }

        return DB::transaction(function () use ($row, $userAgent) {
            $affected = PortalAccessCode::query()
                ->whereKey($row->getKey())
                ->whereNull('consumed_at')
                ->update(['consumed_at' => now()]);

            if ($affected === 0) {
                // A concurrent verify already consumed this code.
                throw new PortalCodeUnusableException();
            }

            $plaintext = Str::random(64);

            $session = PortalSession::create([
                'customer_id' => $row->customer_id,
                'token_hash' => PortalSession::hashToken($plaintext),
                'expires_at' => now()->addHours(self::SESSION_TTL_HOURS),
                'last_used_at' => null,
                'revoked_at' => null,
                'user_agent' => $userAgent,
            ]);

            $session->setAttribute('plaintext_token', $plaintext);

            return $session;
        });
    }

    public static function normalize(string $identifier): ?string
    {
        $identifier = trim($identifier);

        if ($identifier === '') {
            return null;
        }

        if (self::isEmail($identifier)) {
            return filter_var($identifier, FILTER_VALIDATE_EMAIL) ? Str::lower($identifier) : null;
        }

        return Customer::normalizePhone($identifier);
    }

    public static function isEmail(string $identifier): bool
    {
        return str_contains($identifier, '@');
    }

    /** Never reveals more than the first character of an email local part or the last two digits of a phone. */
    public static function mask(string $identifier): string
    {
        $identifier = trim($identifier);

        if (self::isEmail($identifier)) {
            [$local, $domain] = array_pad(explode('@', $identifier, 2), 2, '');
            $first = mb_substr($local, 0, 1);

            return $first.str_repeat('•', 3).($domain !== '' ? '@'.$domain : '');
        }

        $digits = preg_replace('/\D+/', '', $identifier) ?? '';
        $lastTwo = mb_substr($digits, -2);

        return str_repeat('•', max(strlen($digits) - 2, 3)).$lastTwo;
    }

    public function attemptsRemaining(string $identifier): int
    {
        $normalized = self::normalize($identifier);

        if ($normalized === null) {
            return 0;
        }

        $row = PortalAccessCode::query()
            ->where('identifier', $normalized)
            ->orderByDesc('id')
            ->first();

        if ($row === null) {
            return 0;
        }

        return max(self::MAX_ATTEMPTS - $row->attempts, 0);
    }

    public function cooldownRemaining(string $identifier): int
    {
        $normalized = self::normalize($identifier);

        if ($normalized === null) {
            return 0;
        }

        $latest = PortalAccessCode::query()
            ->where('identifier', $normalized)
            ->orderByDesc('created_at')
            ->first();

        if ($latest === null) {
            return 0;
        }

        // Absolute diff: Carbon 3's diffInSeconds() is signed by default and
        // returns a NEGATIVE value here (created_at is in the past), which made
        // the cooldown never expire. The explicit `true` is absolute on both
        // Carbon 2 and 3.
        $elapsed = $latest->created_at->diffInSeconds(now(), true);
        $remaining = self::RESEND_COOLDOWN_SECONDS - $elapsed;

        return max((int) $remaining, 0);
    }

    /**
     * One query, both stored phone forms. `Customer` uses SoftDeletes, so the
     * default scope already excludes trashed rows — withTrashed() must never
     * appear here. No branch creates a `customers` row (Decision 5).
     */
    private function resolveCustomer(string $normalized): ?Customer
    {
        return Customer::query()
            ->when(
                self::isEmail($normalized),
                fn ($q) => $q->where('email', $normalized),
                fn ($q) => $q->whereIn('phone_normalized', Customer::phoneMatchCandidates($normalized))
            )
            ->first();
    }
}
