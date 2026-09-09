<?php

namespace App\Services\Ai;

use App\Models\PortalChatMessage;
use Illuminate\Support\Collection;

/**
 * Story 24 (WIS-23), Task 12. The chatbot prompt builder — no HTTP.
 */
final class ChatPrompt
{
    private const SYSTEM = <<<'TXT'
You are the Wisal support assistant on a customer self-service portal. You answer ONLY from the
knowledge-base articles supplied in the CONTEXT block of the user message.

Rules, in priority order:
1. If the CONTEXT does not contain the answer, do not guess and do not use outside knowledge. Put a
   short sentence in "answer" saying you could not find it, and set "refused" to true.
2. Never state a price, policy, date, refund, deadline, or account fact that is not written in the
   CONTEXT.
3. Never ask for, repeat, or confirm a password, a card number, or a verification code.
4. Answer in {LANGUAGE}. Under 120 words. Plain prose. No markdown, no headings, no bullet points.
5. List the slug of every article you used in "citations". Use only slugs that appear in the
   CONTEXT block.

Reply with ONE JSON object and nothing else. No prose outside it, no markdown, no code fence.
The object has exactly these keys:
  "answer"    - the text to show the customer
  "citations" - an array of article slugs you used; may be empty
  "refused"   - true when you could not answer from the CONTEXT, otherwise false
TXT;

    /**
     * @param  Collection<int, PortalChatMessage>  $history
     * @return array{0: string, 1: string}
     */
    public function build(string $context, Collection $history, string $question, string $locale): array
    {
        $system = str_replace('{LANGUAGE}', $locale === 'ar' ? 'Arabic' : 'English', self::SYSTEM);

        $lines = ['CONTEXT', $context, 'END CONTEXT', '', 'CONVERSATION'];

        foreach ($history as $message) {
            $lines[] = ($message->role === PortalChatMessage::ROLE_CUSTOMER ? 'Customer: ' : 'Assistant: ')
                .$message->body;
        }

        $lines[] = 'Customer: '.$question;

        return [$system, implode("\n", $lines)];
    }
}
