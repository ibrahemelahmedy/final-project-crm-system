<?php

use App\Exceptions\AssistUnavailableException;
use App\Services\Ai\AssistGenerator;
use App\Services\Ai\AssistResult;
use App\Services\IntegrationConnectionTester;
use Tests\TestCase;

// Unit tests that touch Eloquent models/factories (e.g. QuickReplyRendererTest)
// need the app bootstrapped the same way Feature tests do — a plain
// PHPUnit\Framework\TestCase has no facade root and no database connection.
pest()->extend(TestCase::class)->in('Feature', 'Unit');

/**
 * Story 18 (WIS-19). Binds a fake IntegrationConnectionTester for the
 * duration of a test — no Integration* test ever performs a real outbound
 * request. Defined once here (not per-file) so it can be `require`d by every
 * Integration*Test.php without a "cannot redeclare function" collision.
 */
function bindIntegrationTester(bool $ok, ?string $error = null): void
{
    app()->bind(IntegrationConnectionTester::class, fn () => new class($ok, $error) implements IntegrationConnectionTester
    {
        public function __construct(private bool $ok, private ?string $error) {}

        public function test(string $endpointUrl, ?string $secret): array
        {
            return ['ok' => $this->ok, 'status' => $this->ok ? 200 : null, 'error' => $this->error];
        }
    });
}

/**
 * Story 19 (WIS-18). Binds ONE fake AssistGenerator instance for the
 * duration of a test — no Ai*Test.php ever makes a network call. Bind once
 * per test, not once per HTTP call: `Illuminate\Routing\Route::getController()`
 * caches the resolved controller instance on the Route object, and Laravel
 * reuses that SAME Route (and therefore the same already-injected
 * TicketAssist/AssistGenerator) across every `$this->postJson(...)` inside
 * one test — a SECOND `app()->instance(AssistGenerator::class, ...)` mid-test
 * silently has no effect on a controller already resolved. Drive different
 * behaviour across calls on this ONE fake instead, via `respondWith()` /
 * `failNext()`.
 *
 * Records every (system, transcript) pair it was called with in `$calls`,
 * in call order, so a test can assert on the exact prompt built for it.
 */
function bindAssistGenerator(string $content = 'Generated content.'): object
{
    $fake = new class($content) implements AssistGenerator
    {
        /** @var array<int, array{0: string, 1: string}> */
        public array $calls = [];

        public int $timesCalled = 0;

        /** @var array<int, string> */
        private array $queue = [];

        private bool $failNext = false;

        public function __construct(private string $content) {}

        /** Queues the content the NEXT call returns (FIFO); falls back to the constructor default once drained. */
        public function respondWith(string $content): void
        {
            $this->queue[] = $content;
        }

        /** The NEXT call throws AssistUnavailableException instead of returning. */
        public function failNext(): void
        {
            $this->failNext = true;
        }

        public function generate(string $system, string $transcript): AssistResult
        {
            $this->timesCalled++;
            $this->calls[] = [$system, $transcript];

            if ($this->failNext) {
                $this->failNext = false;
                throw new AssistUnavailableException('simulated provider failure');
            }

            $content = array_shift($this->queue) ?? $this->content;

            return new AssistResult($content, 'claude-opus-5', 10, 5);
        }
    };

    app()->instance(AssistGenerator::class, $fake);

    return $fake;
}

/** The always-throws fake, for exercising the `failed` shape from the first call. */
function bindFailingAssistGenerator(): object
{
    $fake = new class implements AssistGenerator
    {
        public int $timesCalled = 0;

        public function generate(string $system, string $transcript): AssistResult
        {
            $this->timesCalled++;

            throw new AssistUnavailableException('simulated provider failure');
        }
    };

    app()->instance(AssistGenerator::class, $fake);

    return $fake;
}
