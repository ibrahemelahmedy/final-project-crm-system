<?php

namespace App\Services\Channels;

use App\Models\Customer;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Story 26 (WIS-22), Decision 7. Match order: email (exact, lower-cased by
 * the mutator) then Customer::phoneMatchCandidates() against
 * phone_normalized. On no match, create THROUGH THE MODEL so setEmailAttribute
 * / setPhoneAttribute still derive phone_normalized.
 */
class InboundCustomerResolver
{
    public function resolve(InboundMessage $message): Customer
    {
        if ($message->fromEmail !== null && $message->fromEmail !== '') {
            $customer = Customer::query()->where('email', mb_strtolower(trim($message->fromEmail)))->first();

            if ($customer !== null) {
                return $customer;
            }
        }

        if ($message->fromPhone !== null && $message->fromPhone !== '') {
            $candidates = Customer::phoneMatchCandidates($message->fromPhone);

            if ($candidates !== []) {
                $customer = Customer::query()->whereIn('phone_normalized', $candidates)->first();

                if ($customer !== null) {
                    return $customer;
                }
            }
        }

        $name = $message->fromName ?: ($message->fromEmail ?? $message->fromPhone ?? __('channels.inbound.unknown_customer'));

        $attributes = [
            'name' => $name,
            'email' => $message->fromEmail,
            'phone' => $message->fromPhone,
            'created_by' => null,
        ];

        try {
            return DB::transaction(fn () => Customer::create($attributes));
        } catch (QueryException $e) {
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }

            // A duplicate arrived concurrently — one of the two partial
            // unique indexes fired. Re-query and return the winner; never
            // abort ingestion for a duplicate.
            $winner = null;

            if ($message->fromEmail !== null) {
                $winner = Customer::query()->where('email', mb_strtolower(trim($message->fromEmail)))->first();
            }

            if ($winner === null && $message->fromPhone !== null) {
                $winner = Customer::query()
                    ->whereIn('phone_normalized', Customer::phoneMatchCandidates($message->fromPhone))
                    ->first();
            }

            return $winner ?? Customer::create($attributes);
        }
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $sqlState = $e->errorInfo[0] ?? null;

        return $sqlState === '23000' || $sqlState === '23505';
    }
}
