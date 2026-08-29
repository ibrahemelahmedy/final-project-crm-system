<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Pins the exact Reports payload shape (Story 12). The aggregator already
 * returns this structure; the resource exists so the contract is one named
 * type the frontend generates against, and so Story 13 can later extend the
 * `csat` block without changing the response shape.
 *
 * `$wrap = null` keeps the payload a bare object — there is no `data` envelope.
 */
class ReportSummaryResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $data */
        $data = $this->resource;

        return [
            'range' => $data['range'],
            'ticket_volume' => $data['ticket_volume'],
            'sla' => $data['sla'],
            'channels' => $data['channels'],
            'agents' => $data['agents'],
            'csat' => $data['csat'],
        ];
    }
}
