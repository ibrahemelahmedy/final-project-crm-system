<?php

use Tests\TestCase;

// Unit tests that touch Eloquent models/factories (e.g. QuickReplyRendererTest)
// need the app bootstrapped the same way Feature tests do — a plain
// PHPUnit\Framework\TestCase has no facade root and no database connection.
pest()->extend(TestCase::class)->in('Feature', 'Unit');
