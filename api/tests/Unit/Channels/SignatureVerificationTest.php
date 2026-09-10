<?php

use App\Enums\Channel;
use App\Enums\ChannelProvider;
use App\Models\ChannelConnection;
use App\Services\Channels\EmailWebhookAdapter;
use App\Services\Channels\TwilioSmsAdapter;
use App\Services\Channels\WhatsappCloudAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Story 26 (WIS-22), Decision 3 / Test Plan §A. Pure signature checks: a
 * hand-computed HMAC digest driving the REAL verify(), never a stub. Uses
 * connectChannel() (api/tests/Pest.php) for a real encrypted secret.
 */
uses(RefreshDatabase::class);

function whatsappRequest(string $body, ?string $signatureHeader): Request
{
    $server = ['CONTENT_TYPE' => 'application/json'];
    if ($signatureHeader !== null) {
        $server['HTTP_X_HUB_SIGNATURE_256'] = $signatureHeader;
    }

    return Request::create('/api/webhooks/channels/whatsapp_cloud', 'POST', [], [], [], $server, $body);
}

function emailRequest(string $body, ?string $signatureHeader): Request
{
    $server = ['CONTENT_TYPE' => 'application/json'];
    if ($signatureHeader !== null) {
        $server['HTTP_X_WISAL_SIGNATURE'] = $signatureHeader;
    }

    return Request::create('/api/webhooks/channels/email_webhook', 'POST', [], [], [], $server, $body);
}

it('whatsapp_cloud accepts a correctly-computed X-Hub-Signature-256 over the raw body', function () {
    [$connection, $secret] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $body = '{"a":1,"b":2}';
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    $request = whatsappRequest($body, $signature);

    expect((new WhatsappCloudAdapter)->verify($request, $connection))->toBeTrue();
});

it('whatsapp_cloud rejects a valid digest computed over a re-encoded body', function () {
    [$connection, $secret] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $original = '{"a":1,"b":2}';
    $reencoded = '{"b":2,"a":1}'; // same data, different key order/bytes

    $signature = 'sha256='.hash_hmac('sha256', $reencoded, $secret);
    $request = whatsappRequest($original, $signature);

    expect((new WhatsappCloudAdapter)->verify($request, $connection))->toBeFalse();
});

it('whatsapp_cloud rejects a missing header, an empty header, and a sha1= prefix', function () {
    [$connection, $secret] = connectChannel(Channel::Whatsapp, ChannelProvider::WhatsappCloud);
    $body = '{"a":1}';
    $adapter = new WhatsappCloudAdapter;

    expect($adapter->verify(whatsappRequest($body, null), $connection))->toBeFalse();
    expect($adapter->verify(whatsappRequest($body, ''), $connection))->toBeFalse();

    $sha1 = 'sha1='.hash_hmac('sha1', $body, $secret);
    expect($adapter->verify(whatsappRequest($body, $sha1), $connection))->toBeFalse();
});

it('twilio_sms accepts a correctly-computed X-Twilio-Signature over URL + sorted params', function () {
    [$connection, $secret] = connectChannel(Channel::Sms, ChannelProvider::TwilioSms);

    $url = 'https://wisal.example.com/api/webhooks/channels/twilio_sms';
    $params = ['Body' => 'Hello', 'From' => '+15005550006'];

    $data = $url;
    $sorted = $params;
    ksort($sorted);
    foreach ($sorted as $k => $v) {
        $data .= $k.$v;
    }
    $signature = base64_encode(hash_hmac('sha1', $data, $secret, true));

    $request = Request::create($url, 'POST', $params);
    $request->headers->set('X-Twilio-Signature', $signature);

    expect((new TwilioSmsAdapter)->verify($request, $connection))->toBeTrue();
});

it('twilio_sms rejects the same signature when the URL differs by one character', function () {
    [$connection, $secret] = connectChannel(Channel::Sms, ChannelProvider::TwilioSms);

    $url = 'https://wisal.example.com/api/webhooks/channels/twilio_sms';
    $params = ['Body' => 'Hello', 'From' => '+15005550006'];

    $data = $url;
    $sorted = $params;
    ksort($sorted);
    foreach ($sorted as $k => $v) {
        $data .= $k.$v;
    }
    $signature = base64_encode(hash_hmac('sha1', $data, $secret, true));

    $differentUrl = 'https://wisal.example.com/api/webhooks/channels/twilio_smss';
    $request = Request::create($differentUrl, 'POST', $params);
    $request->headers->set('X-Twilio-Signature', $signature);

    expect((new TwilioSmsAdapter)->verify($request, $connection))->toBeFalse();
});

it('email_webhook accepts X-Wisal-Signature in the exact OutboundHttpClient shape and rejects a one-byte-different digest', function () {
    [$connection, $secret] = connectChannel(Channel::Email, ChannelProvider::EmailWebhook);
    $body = '{"message_id":"abc"}';
    $signature = 'sha256='.hash_hmac('sha256', $body, $secret);

    $request = emailRequest($body, $signature);
    expect((new EmailWebhookAdapter)->verify($request, $connection))->toBeTrue();

    $tampered = substr($signature, 0, -1).(substr($signature, -1) === 'a' ? 'b' : 'a');
    $request2 = emailRequest($body, $tampered);
    expect((new EmailWebhookAdapter)->verify($request2, $connection))->toBeFalse();
});

it('every adapter returns false, and does not throw, when secret is null', function () {
    $whatsapp = ChannelConnection::factory()->whatsapp()->create(['secret' => null]);
    $sms = ChannelConnection::factory()->sms()->create(['secret' => null]);
    $email = ChannelConnection::factory()->email()->create(['secret' => null]);

    expect((new WhatsappCloudAdapter)->verify(whatsappRequest('{}', 'sha256=deadbeef'), $whatsapp))->toBeFalse();

    $request = Request::create('https://x.test/webhooks/channels/twilio_sms', 'POST', ['Body' => 'x']);
    $request->headers->set('X-Twilio-Signature', 'deadbeef');
    expect((new TwilioSmsAdapter)->verify($request, $sms))->toBeFalse();

    expect((new EmailWebhookAdapter)->verify(emailRequest('{}', 'sha256=deadbeef'), $email))->toBeFalse();
});

it('a DecryptException while reading secret yields false, not a 500', function () {
    $connection = ChannelConnection::factory()->whatsapp()->create();

    // Corrupt the stored ciphertext directly so the `encrypted` cast throws
    // DecryptException on read, simulating an APP_KEY rotation.
    ChannelConnection::withoutEvents(function () use ($connection) {
        DB::table('channel_connections')
            ->where('id', $connection->id)
            ->update(['secret' => 'not-valid-ciphertext']);
    });

    $fresh = ChannelConnection::find($connection->id);

    $request = whatsappRequest('{}', 'sha256=deadbeef');
    expect((new WhatsappCloudAdapter)->verify($request, $fresh))->toBeFalse();
});
