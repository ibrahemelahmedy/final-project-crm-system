<?php

namespace App\Http\Controllers;

use App\Enums\CustomerTier;
use App\Http\Requests\IndexCustomerRequest;
use App\Http\Requests\StoreCustomerRequest;
use App\Http\Requests\UpdateCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\TicketResource;
use App\Models\Customer;
use App\Models\Ticket;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
    use AuthorizesRequests;

    public function index(IndexCustomerRequest $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Customer::class);

        $customers = Customer::query()
            ->withOpenTicketCount()
            ->search($request->query('q'))
            ->when($request->query('company'), fn ($q, $c) => $q->whereIn('company', (array) $c))
            ->when($request->query('tier'), fn ($q, $t) => $q->whereIn('tier', (array) $t))
            ->orderBy($request->query('sort', 'name'), $request->query('dir', 'asc'))
            // A secondary key keeps paging stable when the sort column ties.
            ->orderBy('id')
            ->paginate(min((int) $request->query('per_page', 25), 100))
            ->withQueryString();

        return CustomerResource::collection($customers);
    }

    public function facets(IndexCustomerRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        // Apply every filter except the one being faceted, or selecting a
        // company makes it the only company you can ever pick again.
        $baseForCompanies = Customer::query()
            ->search($request->query('q'))
            ->when($request->query('tier'), fn ($q, $t) => $q->whereIn('tier', (array) $t));

        $companies = (clone $baseForCompanies)
            ->whereNotNull('company')
            ->select('company')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('company')
            ->orderBy('company')
            ->limit(50)
            ->get()
            ->map(fn ($row) => ['value' => $row->company, 'count' => (int) $row->aggregate]);

        $baseForTiers = Customer::query()
            ->search($request->query('q'))
            ->when($request->query('company'), fn ($q, $c) => $q->whereIn('company', (array) $c));

        $tierCounts = (clone $baseForTiers)
            ->select('tier')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('tier')
            ->pluck('aggregate', 'tier');

        $tiers = collect(CustomerTier::cases())->map(fn ($tier) => [
            'value' => $tier->value,
            'label' => $tier->label(),
            'count' => (int) ($tierCounts[$tier->value] ?? 0),
        ]);

        $total = Customer::query()
            ->search($request->query('q'))
            ->when($request->query('company'), fn ($q, $c) => $q->whereIn('company', (array) $c))
            ->when($request->query('tier'), fn ($q, $t) => $q->whereIn('tier', (array) $t))
            ->count();

        return response()->json([
            'companies' => $companies,
            'tiers' => $tiers,
            'total' => $total,
        ]);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $this->authorize('create', Customer::class);

        try {
            $customer = Customer::create([
                ...$request->only(['name', 'email', 'phone', 'company', 'tier']),
                'created_by' => $request->user()->id,
            ]);
        } catch (QueryException $e) {
            return $this->duplicateResponseFromQueryException($e, $request->only(['email', 'phone']));
        }

        return (new CustomerResource($customer))->response()->setStatusCode(201);
    }

    public function show(Request $request, Customer $customer): CustomerResource
    {
        $this->authorize('view', $customer);

        return new CustomerResource(
            Customer::withOpenTicketCount()->whereKey($customer->id)->firstOrFail()
        );
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): CustomerResource|JsonResponse
    {
        $this->authorize('update', $customer);

        try {
            $customer->update($request->only(['name', 'email', 'phone', 'company', 'tier']));
        } catch (QueryException $e) {
            return $this->duplicateResponseFromQueryException($e, $request->only(['email', 'phone']));
        }

        return new CustomerResource($customer);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $this->authorize('delete', $customer);

        $customer->delete();

        return response()->json(null, 204);
    }

    /**
     * Interaction history — derived LIVE from the Ticket entity, never a
     * denormalized copy on the customers table. The Ticket Management story
     * (WIS-2) adds tickets.customer_id; until then this returns an empty
     * page and says so via meta.pending_story.
     *
     * Deliberately not scoped by Ticket::visibleTo() — a customer profile
     * shows that customer's whole history. Flagged for Story 04 to revisit.
     */
    public function tickets(Request $request, Customer $customer): JsonResponse|AnonymousResourceCollection
    {
        $this->authorize('view', $customer);

        if (! Schema::hasColumn('tickets', 'customer_id')) {
            return response()->json([
                'data' => [],
                'meta' => ['total' => 0, 'current_page' => 1, 'last_page' => 1, 'per_page' => 20, 'pending_story' => 'WIS-2'],
            ]);
        }

        return TicketResource::collection(
            Ticket::where('customer_id', $customer->id)->latest()->paginate(20)
        );
    }

    /**
     * Two agents can both pass validation for the same email/phone before
     * either insert commits. Catch the unique-index violation here rather
     * than surface a raw 500.
     */
    private function duplicateResponseFromQueryException(QueryException $e, array $submitted): JsonResponse
    {
        $email = $submitted['email'] ?? null;
        $phone = $submitted['phone'] ?? null;

        $existing = null;

        if ($email) {
            $existing = Customer::whereNull('deleted_at')->where('email', Str::lower(trim($email)))->first();
        }

        if (! $existing && $phone) {
            $normalized = Customer::normalizePhone($phone);
            if ($normalized) {
                $existing = Customer::whereNull('deleted_at')->where('phone_normalized', $normalized)->first();
            }
        }

        if (! $existing) {
            throw $e;
        }

        return response()->json([
            'message' => 'A customer with this email already exists.',
            'errors' => ['email' => ['A customer with this email already exists.']],
            'duplicate_customer_id' => $existing->id,
            'duplicate_customer_name' => $existing->name,
        ], 422);
    }
}
