<?php

namespace App\Services\Integrations;

/**
 * Story 25 (WIS-24). The real OutboundUrlGuard — the four checks moved
 * verbatim from HttpIntegrationTester.php:21-48 (Decision 1). Every outbound
 * request in this application, in both directions, passes through here at
 * send time.
 */
class DnsOutboundUrlGuard implements OutboundUrlGuard
{
    public function validate(string $url): OutboundUrlVerdict
    {
        $parts = parse_url($url);
        $scheme = $parts['scheme'] ?? null;
        $host = $parts['host'] ?? null;

        // 1. Scheme guard. http, file, gopher, ftp — all rejected before any
        // DNS resolution.
        if ($scheme !== 'https' || $host === null) {
            return OutboundUrlVerdict::fail('integrations.error.scheme');
        }

        // 2. SSRF guard. Reject a bare-IP host and a hostname with no dot
        // (localhost, container names) outright, then resolve and reject a
        // private, loopback, link-local, or reserved address.
        if (! str_contains($host, '.') && ! str_contains($host, ':')) {
            return OutboundUrlVerdict::fail('integrations.error.blocked_host');
        }

        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);

        if ($ip === $host && ! filter_var($host, FILTER_VALIDATE_IP)) {
            // gethostbyname() returns the input unchanged when resolution
            // fails.
            return OutboundUrlVerdict::fail('integrations.error.unreachable');
        }

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return OutboundUrlVerdict::fail('integrations.error.blocked_host');
        }

        return OutboundUrlVerdict::pass($ip);
    }
}
