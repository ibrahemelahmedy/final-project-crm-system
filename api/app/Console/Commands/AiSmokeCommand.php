<?php

namespace App\Console\Commands;

use App\Exceptions\AssistUnavailableException;
use App\Models\Ticket;
use App\Services\Ai\AssistGenerator;
use App\Services\Ai\AssistTranscript;
use App\Services\Ai\ChatPrompt;
use App\Services\Ai\ClassificationPrompt;
use App\Services\Ai\JsonAnswer;
use App\Services\Ai\KbGrounding;
use Illuminate\Console\Command;

/**
 * Story 22 (WIS-26), Decision 10 — the one new console command. It resolves
 * `AssistGenerator` from the container (so it exercises the REAL binding, not
 * a hand-built object), builds a real prompt, calls the configured provider
 * once, and prints what came back.
 *
 * Story 24 (WIS-23) adds --kind=classify|chat. Neither writes to the database
 * — ai:smoke stays read-only.
 *
 * Auto-discovered from app/Console/Commands — this project has no
 * app/Console/Kernel.php and one must not be created.
 */
class AiSmokeCommand extends Command
{
    protected $signature = 'ai:smoke {--kind=summary : summary|reply|classify|chat} {--ticket= : ticket id; defaults to the newest ticket that has messages} {--question= : the customer question, for --kind=chat}';

    protected $description = 'Call the configured AI provider once and print what came back.';

    public function handle(AssistTranscript $transcript): int
    {
        $provider = (string) config('ai.provider');

        if (! config('ai.enabled')) {
            $this->error("AI assist is disabled (no key for provider \"{$provider}\").");

            return self::FAILURE;
        }

        $kind = $this->option('kind');
        $generator = app(AssistGenerator::class);

        if ($kind === 'chat') {
            return $this->chat($generator, $provider);
        }

        $ticket = $this->resolveTicket();
        if ($ticket === null) {
            $this->error('No ticket with messages found. Run: php artisan migrate:fresh --seed');

            return self::FAILURE;
        }

        if ($kind === 'classify') {
            return $this->classify($generator, $provider, $ticket);
        }

        $kind = $kind === 'reply' ? 'reply' : 'summary';
        [$system, $prompt] = $kind === 'reply'
            ? $transcript->forReply($ticket, app()->getLocale())
            : $transcript->forSummary($ticket, app()->getLocale());

        try {
            $result = $generator->generate($system, $prompt);
        } catch (AssistUnavailableException $e) {
            $this->error("Provider unavailable: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->info("provider: {$provider}");
        $this->info('generator: '.get_class($generator));
        $this->info("ticket: #{$ticket->id} ({$kind})");
        $this->info("model: {$result->model}");
        $this->info("input_tokens: {$result->inputTokens}");
        $this->info("output_tokens: {$result->outputTokens}");
        $this->line('');
        $this->line($result->content);

        return self::SUCCESS;
    }

    private function classify(AssistGenerator $generator, string $provider, Ticket $ticket): int
    {
        [$system, $prompt] = app(ClassificationPrompt::class)->forTicket($ticket->loadMissing('customer'));

        try {
            $result = $generator->generate($system, $prompt);
        } catch (AssistUnavailableException $e) {
            $this->error("Provider unavailable: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->info("provider: {$provider}");
        $this->info('generator: '.get_class($generator));
        $this->info("ticket: #{$ticket->id} (classify)");
        $this->info("model: {$result->model}");
        $this->line('');
        $this->line('raw: '.$result->content);
        $this->line('parsed: '.json_encode(JsonAnswer::parse($result->content)));

        return self::SUCCESS;
    }

    private function chat(AssistGenerator $generator, string $provider): int
    {
        $question = (string) $this->option('question');

        if (trim($question) === '') {
            $this->error('--kind=chat requires --question="…"');

            return self::FAILURE;
        }

        $grounding = app(KbGrounding::class);
        $articles = $grounding->forQuestion($question);

        $this->info("provider: {$provider}");
        $this->info('generator: '.get_class($generator));
        $this->info('grounding articles: '.$articles->count().' ['.$articles->pluck('slug')->implode(', ').']');

        if ($articles->isEmpty()) {
            $this->line('');
            $this->line('No published KB article matched — the chatbot would return the canned refusal, no provider call.');

            return self::SUCCESS;
        }

        [$system, $prompt] = app(ChatPrompt::class)->build(
            $grounding->render($articles), collect(), $question, app()->getLocale()
        );

        try {
            $result = $generator->generate($system, $prompt);
        } catch (AssistUnavailableException $e) {
            $this->error("Provider unavailable: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->line('');
        $this->line('raw: '.$result->content);
        $this->line('parsed: '.json_encode(JsonAnswer::parse($result->content)));

        return self::SUCCESS;
    }

    private function resolveTicket(): ?Ticket
    {
        $ticketId = $this->option('ticket');

        return $ticketId
            ? Ticket::query()->find($ticketId)
            : Ticket::query()->whereHas('messages')->latest('id')->first();
    }
}
