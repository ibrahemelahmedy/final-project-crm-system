#!/usr/bin/env node
/**
 * Story 15 (WIS-11) — the no-hard-coded-strings check. Enforcement deliverable,
 * not a convention.
 *
 * Parses `.tsx` under the roots listed in scripts/i18n-allowlist.json with the
 * TypeScript compiler and flags:
 *   - JSX text nodes with two or more word characters
 *   - `title` / `aria-label` / `placeholder` / `alt` JSX attributes whose value
 *     is a bare string literal with two or more word characters
 *
 * Anything on the allowlist (with a recorded reason) is exempt. Exits non-zero
 * on any violation. Wired as `npm run i18n:check` AND asserted from
 * src/i18n/noHardcodedStrings.test.ts so `npx vitest run` fails too — a check
 * only CI runs is discovered late.
 *
 * Usage:
 *   node scripts/check-no-literals.mjs             # enforce configured roots
 *   node scripts/check-no-literals.mjs src/foo ... # enforce explicit paths
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

const config = JSON.parse(readFileSync(join(here, 'i18n-allowlist.json'), 'utf8'));
const allowLiterals = new Set((config.literals ?? []).map((e) => e.value.trim()));
const allowPatterns = (config.patterns ?? []).map((e) => new RegExp(e.value));

const WORD_RUN = /\p{L}{2,}/u;
const TARGET_ATTRS = new Set(['title', 'aria-label', 'placeholder', 'alt']);

export function isAllowed(text) {
  const t = String(text).trim();
  if (t.length === 0) return true;
  if (allowLiterals.has(t)) return true;
  if (allowPatterns.some((re) => re.test(t))) return true;
  // Needs a run of at least two letters of actual prose to count.
  if (!WORD_RUN.test(t)) return true;
  return false;
}

function collectFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__fixtures__') continue;
      collectFiles(full, out);
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
}

export function scanSource(fileName, source) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.text;
      if (!isAllowed(text)) {
        violations.push({ kind: 'jsx-text', text: text.trim(), pos: node.getStart(sf) });
      }
    } else if (ts.isJsxAttribute(node) && node.name && TARGET_ATTRS.has(node.name.getText(sf))) {
      const init = node.initializer;
      let literal = null;
      if (init && ts.isStringLiteral(init)) literal = init.text;
      else if (
        init &&
        ts.isJsxExpression(init) &&
        init.expression &&
        (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))
      ) {
        literal = init.expression.text;
      }
      if (literal !== null && !isAllowed(literal)) {
        violations.push({ kind: `attr:${node.name.getText(sf)}`, text: literal.trim(), pos: node.getStart(sf) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return violations.map((v) => {
    const { line } = sf.getLineAndCharacterOfPosition(v.pos);
    return { ...v, line: line + 1 };
  });
}

/**
 * Programmatic entry point for src/i18n/noHardcodedStrings.test.ts, so the
 * test needs no Node builtins of its own.
 * @param {string[]} [rootsArg] repo-relative roots; defaults to config.roots
 */
export function runCheck(rootsArg) {
  const roots = (rootsArg ?? config.roots).map((r) => resolve(webRoot, r));
  const files = [];
  for (const root of roots) collectFiles(root, files);
  const violations = [];
  for (const file of files) {
    for (const v of scanSource(file, readFileSync(file, 'utf8'))) {
      violations.push({ file: relative(webRoot, file), ...v });
    }
  }
  return { files: files.map((f) => relative(webRoot, f)), violations };
}

/** @param {string} absPath */
export function scanFileByPath(absPath) {
  return scanSource(absPath, readFileSync(absPath, 'utf8'));
}

// --- runner (skipped when imported by the test) --------------------------
const invokedDirectly = resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const explicit = process.argv.slice(2);
  const roots = (explicit.length ? explicit : config.roots).map((r) => resolve(webRoot, r));

  const files = [];
  for (const root of roots) collectFiles(root, files);

  let total = 0;
  for (const file of files) {
    for (const v of scanSource(file, readFileSync(file, 'utf8'))) {
      total += 1;
      console.error(`${relative(webRoot, file)}:${v.line}  [${v.kind}]  "${v.text}"`);
    }
  }

  if (total > 0) {
    console.error(
      `\n${total} hard-coded literal(s) found. Move them to an i18n catalogue, or add a documented exception to scripts/i18n-allowlist.json.`
    );
    process.exit(1);
  }
  console.log(`i18n:check — no hard-coded literals in ${files.length} file(s) across ${roots.length} root(s).`);
}

export { config, collectFiles, webRoot };
