<?php

namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use Illuminate\Support\Str;

/**
 * Markdown -> HTML -> allow-list sanitize. THE single write path for
 * kb_articles.body_html (Story 09).
 *
 * Sanitization happens on WRITE, not on render: the reader and the editor
 * preview both display the output of this class, so a payload cannot survive
 * by being previewed instead of saved. Client-side sanitization alone is
 * explicitly insufficient — the client never renders the raw `body`.
 *
 * Two independent layers, deliberately:
 *   1. CommonMark runs with html_input=strip and allow_unsafe_links=false, so
 *      raw HTML in the source never becomes markup at all.
 *   2. The DOM pass below re-checks the RESULT against an element/attribute
 *      allow-list. Layer 2 is what the story's threat model actually promises;
 *      layer 1 is defence in depth in case the converter's options change.
 */
class MarkdownRenderer
{
    /** Elements that may appear in a rendered body. Everything else is removed. */
    private const ALLOWED_ELEMENTS = [
        'p', 'br', 'hr',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'strong', 'em', 'del', 'code', 'pre',
        'blockquote', 'a',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ];

    /** Attributes allowed per element. Nothing global, and never `style`. */
    private const ALLOWED_ATTRIBUTES = [
        'a' => ['href', 'title'],
        'th' => ['colspan', 'rowspan'],
        'td' => ['colspan', 'rowspan'],
        'h1' => ['id'], 'h2' => ['id'], 'h3' => ['id'],
        'h4' => ['id'], 'h5' => ['id'], 'h6' => ['id'],
    ];

    /** Only these URL schemes survive on an href. `javascript:` is not one. */
    private const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

    /** Markdown source -> sanitized HTML, ready to be stored in body_html. */
    public function render(?string $markdown): string
    {
        if ($markdown === null || trim($markdown) === '') {
            return '';
        }

        $html = Str::markdown($markdown, [
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
        ]);

        return $this->sanitize($html);
    }

    /**
     * Plain-text excerpt for the article card, derived from the SANITIZED HTML
     * so it can never carry markup of its own.
     */
    public function excerpt(?string $bodyHtml, int $limit = 220): string
    {
        $text = Str::squish(html_entity_decode(strip_tags((string) $bodyHtml), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        return Str::limit($text, $limit);
    }

    /** ~200 words per minute, never below 1 — the reader's "N min read" line. */
    public function readMinutes(?string $bodyHtml): int
    {
        $text = trim(strip_tags((string) $bodyHtml));

        if ($text === '') {
            return 1;
        }

        return max(1, (int) ceil(str_word_count($text) / 200));
    }

    /**
     * The reader's "ON THIS PAGE" entries, read back off the ids this class
     * already assigned. Ids are de-duplicated during sanitize(), so a document
     * with two "Overview" headings can never produce two TOC links pointing at
     * the same section.
     *
     * @return array<int, array{id: string, text: string, level: int}>
     */
    public function toc(?string $bodyHtml): array
    {
        if (! $bodyHtml) {
            return [];
        }

        $doc = $this->loadFragment($bodyHtml);

        if (! $doc) {
            return [];
        }

        $entries = [];

        foreach ((new DOMXPath($doc))->query('//h2|//h3') as $heading) {
            /** @var DOMElement $heading */
            $id = $heading->getAttribute('id');
            $text = Str::squish($heading->textContent);

            // No id means sanitize() could not derive one — drop the entry
            // rather than emit a link that lands on the wrong section.
            if ($id === '' || $text === '') {
                continue;
            }

            $entries[] = [
                'id' => $id,
                'text' => $text,
                'level' => (int) substr($heading->nodeName, 1),
            ];
        }

        return $entries;
    }

    /**
     * Arabic (or any RTL) body text renders RTL in the reader regardless of the
     * app-wide direction. A threshold, not the first character: an Arabic
     * article that opens with an English product name is still Arabic.
     */
    public function direction(?string $text): string
    {
        $plain = strip_tags((string) $text);

        if ($plain === '') {
            return 'ltr';
        }

        // Arabic, Arabic Supplement/Extended-A, Hebrew, Arabic Presentation Forms.
        $rtl = preg_match_all('/[\x{0590}-\x{05FF}\x{0600}-\x{06FF}\x{0750}-\x{077F}\x{08A0}-\x{08FF}\x{FB50}-\x{FDFF}\x{FE70}-\x{FEFF}]/u', $plain);
        $letters = preg_match_all('/\p{L}/u', $plain);

        if (! $letters) {
            return 'ltr';
        }

        return ($rtl / $letters) > 0.25 ? 'rtl' : 'ltr';
    }

    /** Allow-list pass over already-rendered HTML. */
    private function sanitize(string $html): string
    {
        $doc = $this->loadFragment($html);

        if (! $doc) {
            return '';
        }

        $body = $doc->getElementsByTagName('body')->item(0);

        if (! $body) {
            return '';
        }

        $this->scrubNode($body);
        $this->assignHeadingIds($doc);

        $out = '';

        foreach ($body->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }

        return trim($out);
    }

    private function loadFragment(string $html): ?DOMDocument
    {
        $doc = new DOMDocument;
        $previous = libxml_use_internal_errors(true);

        // The meta charset is what makes DOMDocument treat the fragment as
        // UTF-8; without it an Arabic body comes back mojibake.
        $loaded = $doc->loadHTML(
            '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>'.$html.'</body></html>',
            LIBXML_NONET
        );

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return $loaded ? $doc : null;
    }

    /** Depth-first: drop disallowed elements, strip disallowed attributes. */
    private function scrubNode(DOMNode $node): void
    {
        // Snapshot first: removing a child mutates the live DOMNodeList
        // mid-iteration and silently skips the next sibling.
        $children = iterator_to_array($node->childNodes);

        foreach ($children as $child) {
            if ($child instanceof DOMElement) {
                $name = strtolower($child->nodeName);

                if (! in_array($name, self::ALLOWED_ELEMENTS, true)) {
                    // script/style/iframe/object carry no readable prose worth
                    // preserving — remove them whole rather than unwrapping
                    // their contents into the document.
                    $child->parentNode?->removeChild($child);

                    continue;
                }

                $this->scrubAttributes($child, $name);
                $this->scrubNode($child);

                continue;
            }

            // Comments can hide conditional markup; text nodes stay as text.
            if ($child->nodeType === XML_COMMENT_NODE) {
                $child->parentNode?->removeChild($child);
            }
        }
    }

    private function scrubAttributes(DOMElement $element, string $name): void
    {
        $allowed = self::ALLOWED_ATTRIBUTES[$name] ?? [];
        $attributes = iterator_to_array($element->attributes ?? []);

        foreach ($attributes as $attribute) {
            $attrName = strtolower($attribute->nodeName);

            // One rule catches every on* event handler — onerror, onclick,
            // onload — rather than enumerating them.
            if (str_starts_with($attrName, 'on') || ! in_array($attrName, $allowed, true)) {
                $element->removeAttribute($attribute->nodeName);

                continue;
            }

            if ($attrName === 'href' && ! $this->isSafeUrl($attribute->nodeValue)) {
                $element->removeAttribute($attribute->nodeName);
            }
        }

        // Anything leaving the app opens without handing the opener over.
        // Relative links (/knowledge-base/<slug>) stay in-app and are untouched.
        if ($name === 'a' && str_starts_with(strtolower((string) $element->getAttribute('href')), 'http')) {
            $element->setAttribute('rel', 'noopener noreferrer nofollow');
        }
    }

    private function isSafeUrl(?string $url): bool
    {
        $url = trim((string) $url);

        if ($url === '') {
            return false;
        }

        // Relative and in-page links carry no scheme and are always in-app.
        if (str_starts_with($url, '/') || str_starts_with($url, '#')) {
            return true;
        }

        // Percent-DECODE before matching the scheme. CommonMark encodes a
        // padded link destination, so "[x](<  javascript:…>)" arrives here as
        // "%20%20javascript:…" — which the scheme regex below would otherwise
        // read as a schemeless relative path and wave through.
        $decoded = rawurldecode($url);

        // Then strip whitespace and control characters, because
        // "java\tscript:alert(1)" is a live URL in several browsers.
        $normalized = strtolower(preg_replace('/[\s\x00-\x1F]/', '', $decoded) ?? '');

        if (! preg_match('/^([a-z0-9+.-]+):/', $normalized, $m)) {
            return true; // schemeless relative path
        }

        return in_array($m[1], self::ALLOWED_SCHEMES, true);
    }

    /**
     * Stable, de-duplicated anchor ids on h2/h3 so the TOC can link to them.
     * A repeated heading gets a "-2" suffix rather than a duplicate id.
     */
    private function assignHeadingIds(DOMDocument $doc): void
    {
        $seen = [];

        foreach ((new DOMXPath($doc))->query('//h2|//h3') as $heading) {
            /** @var DOMElement $heading */
            $base = Str::slug(Str::squish($heading->textContent));

            if ($base === '') {
                continue;
            }

            $id = $base;
            $n = 2;

            while (isset($seen[$id])) {
                $id = $base.'-'.$n;
                $n++;
            }

            $seen[$id] = true;
            $heading->setAttribute('id', $id);
        }
    }
}
