<?php

use App\Enums\UserRole;
use App\Models\KbArticle;
use App\Models\KbCategory;
use App\Models\User;
use App\Services\MarkdownRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->editor = User::factory()->create(['role' => UserRole::Administrator, 'is_active' => true]);
    $this->category = KbCategory::factory()->named('Notifications')->create();
});

const PAYLOAD_BODY = <<<'MD'
Intro paragraph.

<script>alert('xss')</script>
<img src="x" onerror="alert('xss')">
<iframe src="https://evil.example"></iframe>
<a href="javascript:alert('xss')">click me</a>

Trailing paragraph.
MD;

it('strips a script tag, an event handler, a javascript: href, and an iframe on write', function () {
    $response = $this->asUser($this->editor)->postJson('/api/kb/articles', [
        'title' => 'Payload article',
        'body' => PAYLOAD_BODY,
        'kb_category_id' => $this->category->id,
    ]);

    $response->assertCreated();

    $html = KbArticle::where('slug', 'payload-article')->value('body_html');

    expect($html)->not->toContain('<script')
        ->and($html)->not->toContain('onerror')
        ->and($html)->not->toContain('javascript:')
        ->and($html)->not->toContain('<iframe')
        ->and($html)->not->toContain('alert(');

    // The surrounding prose survives — sanitizing is not the same as
    // discarding the article.
    expect($html)->toContain('Intro paragraph')
        ->and($html)->toContain('Trailing paragraph');
});

it('retains the raw body unchanged so the article stays editable', function () {
    $this->asUser($this->editor)->postJson('/api/kb/articles', [
        'title' => 'Payload article',
        'body' => PAYLOAD_BODY,
        'kb_category_id' => $this->category->id,
    ])->assertCreated();

    expect(KbArticle::where('slug', 'payload-article')->value('body'))->toBe(PAYLOAD_BODY);
});

it('re-sanitizes on every edit, not only on create', function () {
    // A payload must not be able to enter through the PATCH path.
    $article = KbArticle::factory()->create([
        'body' => 'Clean.',
        'kb_category_id' => $this->category->id,
    ]);

    $this->asUser($this->editor)
        ->patchJson("/api/kb/articles/{$article->slug}", ['body' => PAYLOAD_BODY])
        ->assertOk();

    $html = $article->fresh()->body_html;

    expect($html)->not->toContain('<script')
        ->and($html)->not->toContain('onerror')
        ->and($html)->not->toContain('<iframe');
});

it('strips an unsafe href however it is cased or padded', function () {
    $renderer = app(MarkdownRenderer::class);

    // Case variation must not slip past the scheme check.
    expect($renderer->render('[x](JaVaScRiPt:alert(1))'))->not->toContain('href="JaVaScRiPt');

    // A leading-space variant: CommonMark still produces an href here.
    expect($renderer->render('[x](<  javascript:alert(1)>)'))->not->toContain('javascript:');

    // A tab INSIDE the scheme ("java\tscript:") is not a link to CommonMark at
    // all — it survives as literal text, which is inert. Asserted so a future
    // parser change that starts producing an href from it fails loudly here.
    expect($renderer->render("[x](java\tscript:alert(1))"))->not->toContain('<a ');
});

it('keeps safe markdown output intact', function () {
    $html = app(MarkdownRenderer::class)->render(
        "## A heading\n\n**bold** and `code`\n\n- one\n- two\n\n[link](/knowledge-base/other)"
    );

    expect($html)->toContain('<h2')
        ->toContain('<strong>')
        ->toContain('<code>')
        ->toContain('<li>')
        ->toContain('href="/knowledge-base/other"');
});

it('de-duplicates heading anchor ids so the TOC cannot link to the wrong section', function () {
    $renderer = app(MarkdownRenderer::class);
    $html = $renderer->render("## Overview\n\nOne.\n\n## Overview\n\nTwo.");

    $ids = collect($renderer->toc($html))->pluck('id');

    expect($ids->all())->toBe(['overview', 'overview-2'])
        ->and($ids->unique()->count())->toBe($ids->count());
});

it('detects Arabic body content as RTL and English as LTR', function () {
    $renderer = app(MarkdownRenderer::class);

    expect($renderer->direction('كيفية إعادة تعيين كلمة المرور الخاصة بك'))->toBe('rtl')
        ->and($renderer->direction('How to reset your password'))->toBe('ltr')
        // An Arabic article opening with an English product name is still Arabic.
        ->and($renderer->direction('Wisal — كيفية إعادة تعيين كلمة المرور الخاصة بحسابك'))->toBe('rtl');
});

it('renders the editor preview through the same pipeline, stripping the same payloads', function () {
    // The preview MUST be the server's own render. If it were a browser-side
    // renderer, a payload could look inert in the preview and behave
    // differently once stored.
    $response = $this->asUser($this->editor)
        ->postJson('/api/kb/preview', ['body' => PAYLOAD_BODY]);

    $response->assertOk()->assertJsonStructure(['body_html', 'toc', 'direction', 'read_minutes']);

    $html = $response->json('body_html');

    expect($html)->not->toContain('<script')
        ->and($html)->not->toContain('onerror')
        ->and($html)->not->toContain('javascript:')
        ->and($html)->not->toContain('<iframe');

    // Byte-for-byte identical to what a save would have stored.
    expect($html)->toBe(app(MarkdownRenderer::class)->render(PAYLOAD_BODY));
});

it('refuses the preview endpoint to an Agent', function () {
    // It writes nothing, but it renders arbitrary attacker-supplied Markdown,
    // so it carries the authoring gate rather than the read gate.
    $agent = \App\Models\User::factory()->create([
        'role' => \App\Enums\UserRole::Agent,
        'is_active' => true,
    ]);

    $this->asUser($agent)
        ->postJson('/api/kb/preview', ['body' => 'Hello.'])
        ->assertForbidden();
});

it('exposes body_html but never renders body as html in the reader payload', function () {
    $article = KbArticle::factory()->create([
        'body' => PAYLOAD_BODY,
        'body_html' => app(MarkdownRenderer::class)->render(PAYLOAD_BODY),
        'kb_category_id' => $this->category->id,
    ]);

    $payload = $this->asUser($this->editor)
        ->getJson("/api/kb/articles/{$article->slug}")
        ->assertOk()
        ->json('data');

    // Both fields ship — the editor needs the raw source — but only body_html
    // is sanitized, and the client contract says only body_html is rendered.
    expect($payload['body'])->toBe(PAYLOAD_BODY)
        ->and($payload['body_html'])->not->toContain('<script');
});
