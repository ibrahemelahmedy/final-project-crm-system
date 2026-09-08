<?php

namespace App\Console\Commands;

use App\Exceptions\AssistUnavailableException;
use App\Models\Ticket;
use App\Services\Ai\AssistGenerator;
use App\Services\Ai\AssistTranscript;
use Illuminate\Console\Command;

/**
 * Story 22 (WIS-26), Decision 10 — the one new console command. It resolves
 * `AssistGenerator` from the container (so it exercises the REAL binding, not
 * a hand-built object), builds a real prompt through `AssistTranscript`, calls
 * the configured provider once, and prints what came back. This is how the
 * owner discharges Done Criteria 1 and 2 after pasting a free key.
 *
 * Auto-discovered from app/Console/Commands — this project has no
 * app/Console/Kernel.php and one must not be created.
 */
class AiSmokeCommand extends Command
{
    protected $signature = 'ai:smoke {--kind=summary : summary|reply} {--ticket= : ticket id; defaults to the newest ticket that has messages}';

    protected $description = 'Call the configured AI provider once against a real ticket and print what came back.';

    public function handle(AssistTranscript $transcript): int
    {
        $provider = (string) config('ai.provider');

        if (! config('ai.enabled')) {
            $this->error("AI assist is disabled (no key for provider \"{$provider}\").");

            return self::FAILURE;
        }

        $ticketId = $this->option('ticket');
        $ticket = $ticketId
            ? Ticket::query()->find($ticketId)
            : Ticket::query()->whereHas('messages')->latest('id')->first();

        if ($ticket === null) {
            $this->error('No ticket with messages found. Run: php artisan migrate:fresh --seed');

            return self::FAILURE;
        }

        $kind = $this->option('kind') === 'reply' ? 'reply' : 'summary';
        [$system, $prompt] = $kind === 'reply'
            ? $transcript->forReply($ticket, app()->getLocale())
            : $transcript->forSummary($ticket, app()->getLocale());

        $generator = app(AssistGenerator::class);

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
}
