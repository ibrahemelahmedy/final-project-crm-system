<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

it('validates password policy rules', function (string $password, bool $shouldPass, array $expectedErrors = []) {
    $validator = Validator::make(
        ['password' => $password],
        ['password' => ['required', Password::defaults()]]
    );

    expect($validator->passes())->toBe($shouldPass);

    if (!$shouldPass && !empty($expectedErrors)) {
        $messages = implode(' ', $validator->errors()->all());
        foreach ($expectedErrors as $expectedError) {
            expect($messages)->toContain($expectedError);
        }
    }
})->with([
    ['short1!', false, ['at least 8 characters']],
    ['alllowercase1!', false, ['uppercase']],
    ['ALLUPPERCASE1!', false, ['lowercase']],
    ['NoNumbersHere!', false, ['number']],
    ['X9#qL7$mP2!zV', true],
]);

it('rejects compromised passwords via uncompromised check', function () {
    // Sha1 hash prefix for "password" is 5BAA6...
    Http::fake([
        'https://api.pwnedpasswords.com/range/*' => Http::response(
            "1E4C9B93F3F0682250B6CF8331B7EE68FD8:1000\r\n" // SHA1 suffix matching "password"
        ),
    ]);

    $validator = Validator::make(
        ['password' => 'password'],
        ['password' => ['required', Password::min(8)->uncompromised()]]
    );

    expect($validator->fails())->toBeTrue();
    expect($validator->errors()->first('password'))->toContain('data leak');
});
