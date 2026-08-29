<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Validator;

/**
 * Story 12 — validates the Reports range and carries the authorization gate.
 *
 * `authorize()` is the 403-for-Agent acceptance criterion: an Agent never gets
 * a partial payload. `from`/`to` are ISO dates in URL search params, the
 * single source of truth for the whole page; missing params default to the
 * last 30 days, matching the artboard's "Last 30 days".
 */
class ReportSummaryRequest extends FormRequest
{
    /** Widest window the endpoint aggregates in one request (a decade must not table-scan). */
    public const MAX_SPAN_DAYS = 366;

    private const DEFAULT_SPAN_DAYS = 30;

    public function authorize(): bool
    {
        return $this->user()?->can('view-reports') ?? false;
    }

    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $from = $this->input('from');
            $to = $this->input('to');

            if ($from !== null && $to !== null
                && Carbon::parse($from)->diffInDays(Carbon::parse($to)) > self::MAX_SPAN_DAYS) {
                $validator->errors()->add(
                    'to',
                    'The selected range must not exceed '.self::MAX_SPAN_DAYS.' days.'
                );
            }
        });
    }

    /**
     * The resolved [from, to] window. Deep-linking /reports?from=…&to=…
     * reproduces the exact page.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function range(): array
    {
        $to = $this->filled('to')
            ? Carbon::parse($this->input('to'))->endOfDay()
            : Carbon::now()->endOfDay();

        $from = $this->filled('from')
            ? Carbon::parse($this->input('from'))->startOfDay()
            : $to->copy()->subDays(self::DEFAULT_SPAN_DAYS - 1)->startOfDay();

        return [$from, $to];
    }
}
