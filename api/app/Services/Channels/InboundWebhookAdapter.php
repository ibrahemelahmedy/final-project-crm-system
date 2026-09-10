<?php

namespace App\Services\Channels;

use App\Models\ChannelConnection;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Story 26 (WIS-22), Decision 3. Three methods and no others. This interface
 * IS the whole threat model.
 */
interface InboundWebhookAdapter
{
    /**
     * Constant-time signature check over the RAW body
     * ($request->getContent()), compared with hash_equals(). Never throws
     * and never logs the signature or the secret.
     */
    public function verify(Request $request, ChannelConnection $connection): bool;

    /** Provider subscription handshake. Null when the provider has none. */
    public function challenge(Request $request, ChannelConnection $connection): ?Response;

    /**
     * @return list<InboundMessage> Zero or more; never throws on malformed input.
     */
    public function parse(Request $request, ChannelConnection $connection): array;
}
