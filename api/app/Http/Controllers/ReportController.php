<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReportSummaryRequest;
use App\Http\Resources\ReportSummaryResource;
use App\Services\ReportAggregator;

/**
 * Reports & Management Dashboards (Story 12 / WIS-7).
 *
 * One endpoint, one range, one payload: every widget on the Reports page
 * renders from this single response, which is structurally what guarantees no
 * widget can show a range different from its neighbours. Authorization is the
 * FormRequest's `view-reports` gate — an Agent gets 403, with no partial
 * payload for that role.
 */
class ReportController extends Controller
{
    public function summary(ReportSummaryRequest $request, ReportAggregator $aggregator): ReportSummaryResource
    {
        [$from, $to] = $request->range();

        return new ReportSummaryResource($aggregator->summary($from, $to));
    }
}
