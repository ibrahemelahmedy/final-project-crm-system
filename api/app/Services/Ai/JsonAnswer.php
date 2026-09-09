<?php

namespace App\Services\Ai;

/**
 * Story 24 (WIS-23), Decision 1. The seam returns TEXT; both new call kinds
 * ask the model for one JSON object. This is the only place that text is
 * turned into an array, and it NEVER throws — an unparseable answer is
 * information (low confidence / unavailable), not an exception.
 */
final class JsonAnswer
{
    /** @return array<string, mixed>|null */
    public static function parse(string $content): ?array
    {
        $text = trim($content);

        // Strip a ```json … ``` fence if the model added one anyway.
        if (str_starts_with($text, '```')) {
            $text = preg_replace('/^```[a-zA-Z]*\s*/', '', $text) ?? $text;
            $text = preg_replace('/\s*```$/', '', $text) ?? $text;
        }

        // Take the outermost object, so a stray "Here you go:" prefix or a
        // trailing sentence does not defeat the decode.
        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        $decoded = json_decode(substr($text, $start, $end - $start + 1), true);

        return is_array($decoded) ? $decoded : null;
    }
}
