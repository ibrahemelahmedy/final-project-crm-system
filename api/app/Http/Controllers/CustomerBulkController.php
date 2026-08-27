<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkCustomerRequest;
use App\Models\Customer;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

class CustomerBulkController extends Controller
{
    use AuthorizesRequests;

    public function __invoke(BulkCustomerRequest $request): JsonResponse
    {
        $ids = $request->validated('ids');

        if ($request->validated('action') === 'delete') {
            $this->authorize('deleteAny', Customer::class);
            $affected = Customer::whereIn('id', $ids)->delete();
        } else {
            $this->authorize('updateAny', Customer::class);
            $affected = Customer::whereIn('id', $ids)->update(['tier' => $request->validated('tier')]);
        }

        // affected is contractual — the frontend's toast reads it, not the
        // length of the id array it sent. A record deleted by someone else
        // between selection and submission must not be counted.
        return response()->json(['action' => $request->validated('action'), 'affected' => $affected]);
    }
}
