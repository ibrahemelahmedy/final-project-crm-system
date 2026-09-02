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
const TARGET_ATTRS = new Set([
  'title',
  'aria-label',
  'placeholder',
  'alt',
  'label',
  'body',
  'heading',
  'message',
  'caption',
  'cta',
  'confirmLabel',
  'emptyMessage',
  'errorMessage',
  'emptySummary',
  'emptyTitle',
  'emptyBody',
  'subtitle',
  'description',
]);

// Story 16 (WIS-17), Decision 1(d): a `.ts` file has no JSX, so scanning it is
// inert unless we can see a string-valued object-literal property. Two
// triggers: the property value itself reads as prose, OR the enclosing
// exported `const`'s name matches a label-map-shaped identifier (catches
// single-word values like `'Low'` / `'Open'` that no prose heuristic can).
const LABEL_MAP_NAME = /(LABELS?|COPY|STRINGS|MESSAGES|OPTIONS|PRESENTATION)$/i;
// A path or URL, or an all-lowercase hyphenated token list (`dt-btn dt-btn-primary fv`,
// a CSS class string) — real prose almost always ends in punctuation or has
// mixed case, so those two shapes are excluded structurally rather than by
// blanket-banning `.`/`:`, which would also reject every sentence-ending period.
const LOOKS_LIKE_PATH = /[/\\]/;
const LOOKS_LIKE_CLASS_LIST = /^[a-z0-9]+(-[a-z0-9]+)*(\s+[a-z0-9]+(-[a-z0-9]+)*)*$/;

export function isAllowed(text) {
  const t = String(text).trim();
  if (t.length === 0) return true;
  if (allowLiterals.has(t)) return true;
  if (allowPatterns.some((re) => re.test(t))) return true;
  // Needs a run of at least two letters of actual prose to count.
  if (!WORD_RUN.test(t)) return true;
  return false;
}

// Story 16 (WIS-17), Decision 1(d): a standalone prose literal — used for
// object-literal property values, which carry no surrounding JSX context to
// lean on. Requires a space AND two separate letter-runs, and excludes
// punctuation that marks a class name / path / enum-ish token rather than a
// sentence or phrase.
function looksLikeStandaloneProse(text) {
  const t = String(text).trim();
  if (t.length === 0) return false;
  if (allowLiterals.has(t)) return false;
  if (allowPatterns.some((re) => re.test(t))) return false;
  if (!/\s/.test(t)) return false;
  if (LOOKS_LIKE_PATH.test(t)) return false;
  if (LOOKS_LIKE_CLASS_LIST.test(t)) return false;
  const runs = t.match(/\p{L}{2,}/gu) ?? [];
  return runs.length >= 2;
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
    } else if (
      (entry.endsWith('.tsx') || entry.endsWith('.ts')) &&
      !entry.endsWith('.test.tsx') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.d.ts') &&
      // Story 16 (WIS-17): test-only fixture/helper modules, e.g.
      // `testFixtures.ts` / `testUtils.tsx` — mock data and render helpers
      // consumed only by `*.test.tsx`, never rendered to a real user.
      !/^test(Fixtures|Utils)\.tsx?$/.test(entry)
    ) {
      out.push(full);
    }
  }
}

/** Unwraps `expr as const` / `expr satisfies T` / parens to the underlying expression. */
function unwrapExpression(expr) {
  let e = expr;
  while (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e))) {
    e = e.expression;
  }
  return e;
}

/**
 * Collects prose string literals reachable from an expression: bare string
 * literals, both branches of a conditional, and every literal chunk of a
 * template expression. Story 16 (WIS-17), Decision 1(c) — the previous rule
 * stopped at `ts.isStringLiteral`, missing every ternary and template.
 */
function collectProseLiterals(expr, out) {
  const e = unwrapExpression(expr);
  if (!e) return;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    out.push({ text: e.text, pos: e.getStart() });
  } else if (ts.isConditionalExpression(e)) {
    collectProseLiterals(e.whenTrue, out);
    collectProseLiterals(e.whenFalse, out);
  } else if (ts.isTemplateExpression(e)) {
    if (e.head.text.trim().length > 0) out.push({ text: e.head.text, pos: e.head.getStart() });
    for (const span of e.templateSpans) {
      if (span.literal.text.trim().length > 0) out.push({ text: span.literal.text, pos: span.literal.getStart() });
    }
  }
}

// Story 16 (WIS-17), Decision 1(d): inside a label-map const, a property
// counts as "the label" — and so is flagged even as a single bare word — when
// it is a DIRECT value of the map (`ROLE_LABELS = { agent: 'Agent' }`, depth
// 0) or its own key reads as a label field (`{ label: 'Email', icon: 'email',
// tint: 'indigo' }`, depth 1+). Everything else at depth 1+ (an enum tag, an
// icon name, a colour token) only gets flagged if it independently reads as
// prose — this is what keeps `icon: 'email'` / `tint: 'indigo'` clean.
const LABEL_LIKE_KEY = /^(label|labels?|title|text|name)$/i;

function scanLabelMapObject(obj, violations, sf, depth) {
  if (!ts.isObjectLiteralExpression(obj)) return;
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const propName = ts.isIdentifier(prop.name) ? prop.name.text : null;
    const value = unwrapExpression(prop.initializer);
    if (!value) continue;
    if (ts.isObjectLiteralExpression(value)) {
      scanLabelMapObject(value, violations, sf, depth + 1);
    } else if (ts.isArrayLiteralExpression(value)) {
      for (const el of value.elements) {
        const ue = unwrapExpression(el);
        if (ue && ts.isObjectLiteralExpression(ue)) scanLabelMapObject(ue, violations, sf, depth + 1);
      }
    } else if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
      const text = value.text;
      const isLabelField = depth === 0 || (propName !== null && LABEL_LIKE_KEY.test(propName));
      if (isLabelField ? !isAllowed(text) : looksLikeStandaloneProse(text)) {
        violations.push({ kind: 'object-literal', text: text.trim(), pos: value.getStart(sf) });
      }
    }
  }
}

/** True when a call chain's leftmost identifier is `z` (a Zod schema builder). */
function chainRootIsZod(expr) {
  let e = expr;
  while (e && (ts.isCallExpression(e) || ts.isPropertyAccessExpression(e))) {
    e = e.expression;
  }
  return !!e && ts.isIdentifier(e) && e.text === 'z';
}

export function scanSource(fileName, source) {
  const isTsx = fileName.endsWith('.tsx');
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations = [];

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.text;
      if (!isAllowed(text)) {
        violations.push({ kind: 'jsx-text', text: text.trim(), pos: node.getStart(sf) });
      }
    } else if (ts.isJsxAttribute(node) && node.name && TARGET_ATTRS.has(node.name.getText(sf))) {
      const attrName = node.name.getText(sf);
      const init = node.initializer;
      const found = [];
      if (init && ts.isStringLiteral(init)) {
        found.push({ text: init.text, pos: init.getStart(sf) });
      } else if (init && ts.isJsxExpression(init) && init.expression) {
        collectProseLiterals(init.expression, found);
      }
      for (const f of found) {
        if (!isAllowed(f.text)) {
          violations.push({ kind: `attr:${attrName}`, text: f.text.trim(), pos: f.pos });
        }
      }
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      !(ts.isJsxElement(node.parent) && node.parent.openingElement.tagName.getText(sf) === 'style')
    ) {
      // A JSX child expression container, e.g. `{cond ? 'a' : 'b'}` — not an
      // attribute, so the branch above never sees it. Excludes `<style>{...}
      // </style>` template blocks (CSS text, not user-facing prose).
      const found = [];
      collectProseLiterals(node.expression, found);
      for (const f of found) {
        if (!isAllowed(f.text)) {
          violations.push({ kind: 'jsx-text', text: f.text.trim(), pos: f.pos });
        }
      }
    } else if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      for (const decl of node.declarationList.declarations) {
        const initializer = decl.initializer ? unwrapExpression(decl.initializer) : undefined;
        const nameMatches = ts.isIdentifier(decl.name) && LABEL_MAP_NAME.test(decl.name.text);
        if (isExported && nameMatches && initializer && ts.isObjectLiteralExpression(initializer)) {
          scanLabelMapObject(initializer, violations, sf, 0);
          continue;
        }
        if (decl.initializer) visit(decl.initializer);
      }
      return; // declarations already visited explicitly above
    } else if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const valueExpr = ts.isPropertyAssignment(node) ? unwrapExpression(node.initializer) : null;
      if (valueExpr && (ts.isStringLiteral(valueExpr) || ts.isNoSubstitutionTemplateLiteral(valueExpr))) {
        const propName = ts.isIdentifier(node.name) ? node.name.text : null;
        // navItems.tsx precedent: a `label` sibling to `labelKey` is the
        // i18next `defaultValue` companion (`t(labelKey, { defaultValue:
        // item.label })`), not a bare literal — it already renders through
        // `t()`.
        const isLabelKeyDefault =
          propName === 'label' &&
          ts.isObjectLiteralExpression(node.parent) &&
          node.parent.properties.some(
            (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'labelKey'
          );
        const text = valueExpr.text;
        if (!isLabelKeyDefault && looksLikeStandaloneProse(text)) {
          violations.push({ kind: 'object-literal', text: text.trim(), pos: valueExpr.getStart(sf) });
        }
      }
    } else if (ts.isCallExpression(node) && chainRootIsZod(node)) {
      // A Zod validator message passed positionally, e.g. `.min(1, 'Email is
      // required')` — not an object-literal property, so the branch above
      // never sees it.
      for (const arg of node.arguments) {
        const a = unwrapExpression(arg);
        if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && looksLikeStandaloneProse(a.text)) {
          violations.push({ kind: 'zod-message', text: a.text.trim(), pos: a.getStart(sf) });
        }
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
