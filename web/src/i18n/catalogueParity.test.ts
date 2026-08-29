import { describe, it, expect } from 'vitest';
import { resources, NAMESPACES } from './instance';

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Json, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const AR_PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

// English needs only _one/_other; Arabic needs all six. So for the exact
// key-set comparison, collapse any plural-suffixed key to its base.
function collapsePlurals(keys: string[]): string[] {
  return [...new Set(keys.map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort();
}

describe('i18n catalogue parity', () => {
  for (const ns of NAMESPACES) {
    const en = flatten(resources.en[ns] as Json);
    const ar = flatten(resources.ar[ns] as Json);

    it(`[${ns}] en and ar have identical key sets`, () => {
      const enKeys = collapsePlurals(Object.keys(en));
      const arKeys = collapsePlurals(Object.keys(ar));
      const missingInAr = enKeys.filter((k) => !arKeys.includes(k));
      const missingInEn = arKeys.filter((k) => !enKeys.includes(k));
      expect({ missingInAr, missingInEn }).toEqual({ missingInAr: [], missingInEn: [] });
    });

    it(`[${ns}] no value is an empty string`, () => {
      const empties = Object.entries({ ...en, ...ar })
        .filter(([, v]) => v === '')
        .map(([k]) => k);
      expect(empties).toEqual([]);
    });

    it(`[${ns}] every count-bearing key carries all six Arabic CLDR plural forms`, () => {
      // A key is count-bearing when EITHER locale defines `<base>_one` or
      // `<base>_other`.
      const bases = new Set<string>();
      for (const key of [...Object.keys(en), ...Object.keys(ar)]) {
        const m = key.match(/^(.*)_(one|other)$/);
        if (m) bases.add(m[1]);
      }
      const incomplete: string[] = [];
      for (const base of bases) {
        for (const suffix of AR_PLURAL_SUFFIXES) {
          if (!(base + suffix in ar)) incomplete.push(base + suffix);
        }
      }
      expect(incomplete).toEqual([]);
    });
  }
});
