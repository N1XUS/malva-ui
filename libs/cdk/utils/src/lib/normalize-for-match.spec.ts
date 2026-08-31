import { normalizeForMatch } from './normalize-for-match';

/**
 * The pre-change implementation, kept verbatim as an oracle so the ASCII fast
 * path can be asserted byte-identical to the pipeline it short-circuits.
 */
function normalizeForMatchOracle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase();
}

/**
 * Runs `run` with `String.prototype.normalize` traced, returning how many times
 * it was called. The count is read **before** the spy is restored, because
 * `mockRestore()` also clears the recorded calls — asserting afterwards would
 * silently pass no matter what happened.
 */
function traceNormalize<T>(run: () => T): { result: T; calls: number } {
  const spy = vi.spyOn(String.prototype, 'normalize');
  try {
    return { result: run(), calls: spy.mock.calls.length };
  } finally {
    spy.mockRestore();
  }
}

const ORACLE_CASES = [
  ['empty string', ''],
  ['pure ASCII', 'Hello World 123'],
  ['ASCII already lower-case', 'hello world'],
  ['ASCII punctuation and tab', 'a\t~!@#'],
  // U+005E and U+0060 are the only two ASCII code points with `Diacritic=Yes`,
  // so the full pipeline strips them. The fast path must not short-circuit them.
  ['ASCII caret (U+005E, Diacritic=Yes)', 'x^2 + y^2'],
  ['ASCII backtick (U+0060, Diacritic=Yes)', '`code` span'],
  ['both ASCII diacritic characters, mixed case', 'A^B`C'],
  ['a caret next to a combining mark', 'é^É'],
  ['precomposed accents', 'Café ÅNGSTRÖM Zürich'],
  ['combining marks already in NFD', 'Cafe\u0301 A\u030angstro\u0308m'],
  ['emoji / surrogate pairs', '🍎 Apple 🇫🇷'],
  ['Turkish dotted capital I', 'İstanbul'],
  ['Turkish dotless i', 'Iğdır'],
  ['German sharp s', 'STRASSE Straße'],
  ['Greek final sigma', 'ΟΔΥΣΣΕΥΣ Οδυσσεύς'],
  ['ASCII and non-ASCII mixed', 'naive naïve'],
  ['a lone combining mark', '\u0301'],
] as const;

describe('normalizeForMatch', () => {
  it('lower-cases and strips diacritics', () => {
    expect(normalizeForMatch('Café')).toBe('cafe');
    expect(normalizeForMatch('ÅNGSTRÖM')).toBe('angstrom');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeForMatch('')).toBe('');
  });

  it.each(ORACLE_CASES)(
    'agrees with the pre-change implementation: %s',
    (_name, input) => {
      expect(normalizeForMatch(input)).toBe(normalizeForMatchOracle(input));
    },
  );

  it('takes the ASCII fast path — no String.prototype.normalize call', () => {
    const { result, calls } = traceNormalize(() =>
      normalizeForMatch('Hello World'),
    );
    expect(calls).toBe(0);
    expect(result).toBe('hello world');
  });

  it('still NFD-folds a string carrying a non-ASCII code unit', () => {
    const { result, calls } = traceNormalize(() => normalizeForMatch('Café'));
    expect(calls).toBe(1);
    expect(result).toBe('cafe');
  });

  it('strips the two ASCII characters that carry Diacritic=Yes', () => {
    // Regression guard. `\p{Diacritic}` matches U+005E (^) and U+0060 (`),
    // which are inside the ASCII range — so "ASCII implies nothing to strip"
    // is false. A fast path that skips the pipeline for these would silently
    // change search results everywhere `normalizeForMatch` is used
    // (MlvArrayDataSource, filter-expression, smart-filter-bar, view-variant,
    // and every option control).
    expect(normalizeForMatch('a^b')).toBe('ab');
    expect(normalizeForMatch('a`b')).toBe('ab');
    expect(normalizeForMatch('X^2')).toBe('x2');
  });

  it('routes the two ASCII diacritic characters down the full pipeline', () => {
    for (const input of ['a^b', 'a`b']) {
      const { calls } = traceNormalize(() => normalizeForMatch(input));
      expect(calls).toBe(1);
    }
    // …while a caret-free ASCII string still short-circuits.
    expect(traceNormalize(() => normalizeForMatch('ab')).calls).toBe(0);
  });

  it('branches on the exact ASCII boundary (U+007F fast, U+0080 slow)', () => {
    for (const code of [0x7e, 0x7f, 0x80, 0xff]) {
      const input = `A${String.fromCharCode(code)}Z`;
      expect(normalizeForMatch(input)).toBe(normalizeForMatchOracle(input));
    }
  });

  it('is stable across repeated and interleaved calls', () => {
    // Guards the non-global ASCII probe: a `g`-flagged regex would carry
    // `lastIndex` between `.test()` calls and alternate branches.
    expect([1, 2, 3, 4].map(() => normalizeForMatch('Hello'))).toEqual([
      'hello',
      'hello',
      'hello',
      'hello',
    ]);
    expect(['A', 'Á', 'B', 'É', 'C'].map((s) => normalizeForMatch(s))).toEqual([
      'a',
      'a',
      'b',
      'e',
      'c',
    ]);
  });
});
