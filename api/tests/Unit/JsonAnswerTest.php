<?php

use App\Services\Ai\JsonAnswer;

/** Story 24 (WIS-23), Test Plan C. JsonAnswer::parse() is defensive and never throws. */
it('parses a plain JSON object', function () {
    expect(JsonAnswer::parse('{"a":1,"b":"x"}'))->toBe(['a' => 1, 'b' => 'x']);
});

it('parses a fenced ```json block', function () {
    expect(JsonAnswer::parse("```json\n{\"a\":1}\n```"))->toBe(['a' => 1]);
});

it('parses through a prose prefix and suffix', function () {
    expect(JsonAnswer::parse('Here you go: {"a":1} — hope that helps'))->toBe(['a' => 1]);
});

it('returns null on garbage', function () {
    expect(JsonAnswer::parse('I think this is billing.'))->toBeNull();
});

it('returns null for a top-level JSON array', function () {
    expect(JsonAnswer::parse('[1,2,3]'))->toBeNull();
});

it('returns null for an empty string', function () {
    expect(JsonAnswer::parse(''))->toBeNull();
});
