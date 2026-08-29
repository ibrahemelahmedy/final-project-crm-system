<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

/**
 * Story 14 — validates the Channels overview period.
 *
 * `period` is a token (7d / 30d / 90d), never a pair of dates: the window is
 * resolved server-side in the application timezone so two clients in different
 * timezones see the same aggregate. An unrecognised token is a 422, not a
 * silent fallback; an ABSENT token defaults to 30d.
 *
 * Authorization is "any authenticated user" — the route already sits inside
 * `auth:sanctum`, so this only has to reject the unauthenticated case, which
 * the middleware has already done by the time we get here.
 */
class ChannelOverviewRequest extends FormRequest
{
    /** Accepted period token => window length in days. */
    public const PERIODS = ['7d' => 7, '30d' => 30, '90d' => 90];

    public const DEFAULT_PERIOD = '30d';

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'period' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::PERIODS))],
        ];
    }

    /** The resolved period token, defaulting to 30d when absent. */
    public function period(): string
    {
        $p = $this->query('period');

        return is_string($p) && isset(self::PERIODS[$p]) ? $p : self::DEFAULT_PERIOD;
    }

    /**
     * The [from, to] window for the resolved period, computed server-side.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function window(): array
    {
        $to = Carbon::now();
        $from = $to->copy()->subDays(self::PERIODS[$this->period()])->startOfDay();

        return [$from, $to];
    }
}
