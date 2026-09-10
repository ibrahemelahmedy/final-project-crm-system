<?php

use App\Enums\Channel;
use App\Models\Customer;
use App\Services\Channels\InboundCustomerResolver;
use App\Services\Channels\InboundMessage;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

/** Story 26 (WIS-22), Test Plan §P. */
uses(RefreshDatabase::class);

// Customer::creating() below registers a listener directly on the model's
// static event dispatcher, which is NOT reset by RefreshDatabase between
// tests — it must be flushed explicitly or it leaks into every later test
// in this process/worker that creates a Customer.
//
// The race test below ALSO inserts one row over a second, independent,
// autocommitting PDO connection specifically so it survives a rollback of
// the Laravel connection's own transaction — which means RefreshDatabase's
// rollback does NOT clean it up either. It must be deleted explicitly, via
// that same raw connection, or it permanently pollutes wisal_testing and
// every later test's Customer::count() assertions (it did).
afterEach(function () {
    Customer::flushEventListeners();

    // A DB::table()->delete() here would run INSIDE RefreshDatabase's own
    // wrapping transaction and be undone by its rollback along with
    // everything else — the leaked row needs a delete that is JUST AS
    // independent of that transaction as the insert was.
    $cfg = config('database.connections.'.config('database.default'));
    $raw = new PDO(
        "pgsql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}",
        $cfg['username'],
        $cfg['password']
    );
    $raw->exec("delete from customers where email = 'race@example.com'");
});

function inboundFrom(?string $email, ?string $phone, ?string $name = null): InboundMessage
{
    return new InboundMessage(
        providerMessageId: 'x-'.uniqid(),
        channel: Channel::Email,
        fromEmail: $email,
        fromPhone: $phone,
        fromName: $name,
        subject: '',
        body: 'hello',
        threadRefs: [],
        hadAttachment: false,
        occurredAt: CarbonImmutable::now(),
    );
}

it('matches an existing customer by email', function () {
    $customer = Customer::factory()->create(['email' => 'match@example.com']);

    $resolved = (new InboundCustomerResolver)->resolve(inboundFrom('match@example.com', null));

    expect($resolved->id)->toBe($customer->id);
});

it('matches an existing customer by phone via phoneMatchCandidates', function () {
    $customer = Customer::factory()->create(['phone' => '+15005550006', 'email' => null]);

    $resolved = (new InboundCustomerResolver)->resolve(inboundFrom(null, '15005550006'));

    expect($resolved->id)->toBe($customer->id);
});

it('creates a new customer through the model when nothing matches', function () {
    expect(Customer::count())->toBe(0);

    $resolved = (new InboundCustomerResolver)->resolve(inboundFrom('brand-new@example.com', null, 'Brand New'));

    expect(Customer::count())->toBe(1);
    expect($resolved->email)->toBe('brand-new@example.com');
    expect($resolved->name)->toBe('Brand New');
});

/**
 * A genuine race needs a REALLY independent commit: a `Customer::creating`
 * listener fires synchronously inside resolve()'s own Customer::create()
 * call — after resolve()'s SELECT already missed the row, but before its
 * INSERT executes — and inserts the colliding row over a second, fully
 * separate PDO connection with autocommit, so it survives even when
 * resolve()'s own (savepoint-scoped, RefreshDatabase-wrapped) attempt fails
 * and rolls back. A same-connection nested transaction would NOT survive
 * that rollback — Postgres SAVEPOINTs are hierarchical, not independent
 * commits — which is exactly why this needs a second connection.
 */
it('the duplicate-QueryException path returns the existing row rather than throwing', function () {
    $cfg = config('database.connections.'.config('database.default'));
    $raw = new PDO(
        "pgsql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['database']}",
        $cfg['username'],
        $cfg['password']
    );

    Customer::creating(function () use ($raw) {
        $stmt = $raw->prepare('insert into customers (tier, name, email, created_at, updated_at) values (?, ?, ?, now(), now())');
        $stmt->execute(['standard', 'Racer', 'race@example.com']);
    });

    $resolved = (new InboundCustomerResolver)->resolve(inboundFrom('race@example.com', null, 'Late Arrival'));

    expect(Customer::where('email', 'race@example.com')->count())->toBe(1);
    expect($resolved->email)->toBe('race@example.com');
    expect($resolved->name)->toBe('Racer'); // the winner of the race, not our attempt
});
