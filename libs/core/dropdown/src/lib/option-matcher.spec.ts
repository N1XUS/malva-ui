import type { MlvSelectOption } from './select-option';
import type { MlvMatchSegment, MlvOptionMatcher } from './option-matcher';
import {
  defaultOptionMatcher,
  filterOptions,
  matchSegments,
  normalizeForMatch,
  rankPrefixMatchesFirst,
} from './option-matcher';

function opts(...labels: string[]): MlvSelectOption<string>[] {
  return labels.map((label) => ({ label, value: label }));
}

// ---------------------------------------------------------------------------
// Equivalence oracles: verbatim copies of the pre-change implementations, so
// the ASCII fast paths can be asserted byte-identical to what they replaced.
// ---------------------------------------------------------------------------

/** Pre-change `normalizeForMatch` — no ASCII fast path. */
function normalizeForMatchOracle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase();
}

/**
 * Pre-change `matchSegments` — always folds the label per code point.
 *
 * **Kept, but no longer a total oracle.** Its job is to prove the ASCII fast
 * path did not change the answer for the labels it can take (ASCII, accented,
 * `^`/`` ` ``), and that is still exactly what the table below asserts. It also
 * carries the surrogate-pair defect this file's astral tests now pin the fix
 * for: it pushes one `originIndex` entry per code *point* while growing
 * `folded` by code *units*, so the two desynchronise on an astral code point.
 * Astral inputs are therefore excluded from the equivalence table and asserted
 * against explicit expected output instead — see
 * `matchSegments — astral (surrogate-pair) code points`.
 */
function matchSegmentsOracle(label: string, query: string): MlvMatchSegment[] {
  const q = normalizeForMatchOracle(query.trim());
  if (!q) return [{ text: label, matched: false }];

  const chars = [...label];
  let folded = '';
  const originIndex: number[] = [];
  chars.forEach((char, index) => {
    const foldedChar = normalizeForMatchOracle(char);
    for (const unit of foldedChar) {
      folded += unit;
      originIndex.push(index);
    }
  });

  const start = folded.indexOf(q);
  if (start === -1) return [{ text: label, matched: false }];

  const originStart = originIndex[start];
  const originEnd = originIndex[start + q.length - 1];

  const before = chars.slice(0, originStart).join('');
  const match = chars.slice(originStart, originEnd + 1).join('');
  const after = chars.slice(originEnd + 1).join('');

  const segments: MlvMatchSegment[] = [];
  if (before) segments.push({ text: before, matched: false });
  segments.push({ text: match, matched: true });
  if (after) segments.push({ text: after, matched: false });
  return segments;
}

// ---------------------------------------------------------------------------
// Correct reference implementation, written independently of the production
// code for the differential fuzz below. It is *not* derived from either
// `matchSegments` or the oracle: it works purely in code points (arrays of
// them, never a string index), so a surrogate pair is atomic by construction
// and the code-unit/code-point desync the oracle carries cannot be expressed.
// ---------------------------------------------------------------------------

/** Folds `text` and returns it as an array of code points. */
function foldToCodePoints(text: string): string[] {
  // `for…of` / spread over a string yields whole code points.
  return [...normalizeForMatchOracle(text)];
}

/** Naive first-occurrence search of one code-point array inside another. */
function indexOfCodePoints(haystack: string[], needle: string[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Reference `matchSegments`. Same contract, no string indices anywhere: the
 * folded projection is a code-point array, the search is a code-point search,
 * and the origin map has exactly one entry per folded code point.
 */
function matchSegmentsReference(
  label: string,
  query: string,
): MlvMatchSegment[] {
  const q = foldToCodePoints(query.trim());
  if (q.length === 0) return [{ text: label, matched: false }];

  const chars = Array.from(label);
  const folded: string[] = [];
  const origin: number[] = [];
  chars.forEach((char, index) => {
    for (const cp of foldToCodePoints(char)) {
      folded.push(cp);
      origin.push(index);
    }
  });

  const start = indexOfCodePoints(folded, q);
  if (start === -1) return [{ text: label, matched: false }];

  const originStart = origin[start];
  const originEnd = origin[start + q.length - 1];

  const before = chars.slice(0, originStart).join('');
  const match = chars.slice(originStart, originEnd + 1).join('');
  const after = chars.slice(originEnd + 1).join('');

  const segments: MlvMatchSegment[] = [];
  if (before) segments.push({ text: before, matched: false });
  segments.push({ text: match, matched: true });
  if (after) segments.push({ text: after, matched: false });
  return segments;
}

/**
 * Runs `run` with `String.prototype.toLowerCase` traced, returning the receiver
 * of every call. `normalizeForMatch` ends in exactly one `toLowerCase()` per
 * invocation, so the trace counts how many times each individual string was
 * folded — the observable difference between folding a label once and folding
 * it twice (or once per code point).
 */
function traceFolds<T>(run: () => T): { result: T; receivers: string[] } {
  const receivers: string[] = [];
  const native = String.prototype.toLowerCase;
  const spy = vi
    .spyOn(String.prototype, 'toLowerCase')
    .mockImplementation(function (this: string): string {
      receivers.push(String(this));
      return native.call(this);
    });
  try {
    return { result: run(), receivers };
  } finally {
    spy.mockRestore();
  }
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

describe('option-matcher', () => {
  describe('normalizeForMatch', () => {
    it('lower-cases and strips diacritics', () => {
      expect(normalizeForMatch('Café')).toBe('cafe');
      expect(normalizeForMatch('CRÈME')).toBe('creme');
    });
  });

  describe('defaultOptionMatcher', () => {
    it('matches a case-insensitive substring on the label', () => {
      expect(defaultOptionMatcher({ label: 'Banana', value: 1 }, 'AN')).toBe(
        true,
      );
      expect(defaultOptionMatcher({ label: 'Banana', value: 1 }, 'xyz')).toBe(
        false,
      );
    });

    it('matches diacritic-insensitively both ways', () => {
      expect(defaultOptionMatcher({ label: 'Café', value: 1 }, 'cafe')).toBe(
        true,
      );
      expect(defaultOptionMatcher({ label: 'Cafe', value: 1 }, 'café')).toBe(
        true,
      );
    });

    it('matches every option for a blank query', () => {
      expect(defaultOptionMatcher({ label: 'Anything', value: 1 }, '   ')).toBe(
        true,
      );
    });
  });

  describe('filterOptions', () => {
    it('returns a shallow copy of all options for a blank query', () => {
      const source = opts('Apple', 'Banana');
      const result = filterOptions(source, '   ');
      expect(result).toEqual(source);
      expect(result).not.toBe(source);
    });

    it('filters by the default substring matcher', () => {
      expect(filterOptions(opts('Apple', 'Apricot', 'Banana'), 'ap')).toEqual(
        opts('Apple', 'Apricot'),
      );
    });

    it('supports a custom matcher', () => {
      const prefix = (o: MlvSelectOption<string>, q: string) =>
        o.label.toLowerCase().startsWith(q.toLowerCase());
      expect(filterOptions(opts('Apple', 'Snapple'), 'ap', prefix)).toEqual(
        opts('Apple'),
      );
    });

    it('ranks prefix matches above substring matches', () => {
      // Without ranking, "Grape" (substring "pe") would sort before "Pear".
      expect(
        filterOptions(opts('Grape', 'Pear', 'Pepper'), 'pe').map(
          (o) => o.label,
        ),
      ).toEqual(['Pear', 'Pepper', 'Grape']);
    });

    it('ranking also applies to custom-matcher results', () => {
      const contains = (o: MlvSelectOption<string>, q: string) =>
        o.label.toLowerCase().includes(q.toLowerCase());
      expect(
        filterOptions(opts('Snapple', 'Apple', 'Apricot'), 'ap', contains).map(
          (o) => o.label,
        ),
      ).toEqual(['Apple', 'Apricot', 'Snapple']);
    });
  });

  describe('rankPrefixMatchesFirst', () => {
    it('keeps the original relative order inside each partition (stable)', () => {
      expect(
        rankPrefixMatchesFirst(
          opts('Grape', 'Pear', 'Pepper', 'Ripe'), // Pear/Pepper prefixed
          'pe',
        ).map((o) => o.label),
      ).toEqual(['Pear', 'Pepper', 'Grape', 'Ripe']);
    });

    it('is diacritic- and case-insensitive', () => {
      expect(
        rankPrefixMatchesFirst(opts('Decaf', 'Café'), 'caf').map(
          (o) => o.label,
        ),
      ).toEqual(['Café', 'Decaf']);
    });

    it('ranks within each consecutive group run without moving or merging runs', () => {
      const grouped: MlvSelectOption<string>[] = [
        { label: 'Grapefruit', value: 'g1', group: 'Citrus' },
        { label: 'Pomelo', value: 'g2', group: 'Citrus' },
        { label: 'Grape', value: 'b1', group: 'Berries' },
        { label: 'Pear', value: 'b2', group: 'Berries' },
      ];
      // "p" ranks Pomelo first within Citrus and Pear first within Berries,
      // but Citrus still comes wholly before Berries (runs stay contiguous
      // for the panel's consecutive-run sticky-header rendering).
      expect(rankPrefixMatchesFirst(grouped, 'p').map((o) => o.label)).toEqual([
        'Pomelo',
        'Grapefruit',
        'Pear',
        'Grape',
      ]);
    });
  });

  describe('matchSegments', () => {
    it('returns one unmatched segment for a blank query', () => {
      expect(matchSegments('Apple', '')).toEqual([
        { text: 'Apple', matched: false },
      ]);
    });

    it('splits the label around the first match, preserving original casing', () => {
      expect(matchSegments('Pineapple', 'APP')).toEqual([
        { text: 'Pine', matched: false },
        { text: 'app', matched: true },
        { text: 'le', matched: false },
      ]);
    });

    it('marks a leading match without a preceding segment', () => {
      expect(matchSegments('Apple', 'app')).toEqual([
        { text: 'App', matched: true },
        { text: 'le', matched: false },
      ]);
    });

    it('keeps the highlighted slice aligned across diacritics', () => {
      // Query "cafe" matches "café" (folded), highlighting the accented original.
      expect(matchSegments('Le café', 'cafe')).toEqual([
        { text: 'Le ', matched: false },
        { text: 'café', matched: true },
      ]);
    });

    it('returns the whole label unmatched when the query is not found', () => {
      expect(matchSegments('Apple', 'z')).toEqual([
        { text: 'Apple', matched: false },
      ]);
    });
  });

  describe('matchSegments — equivalence with the pre-change implementation', () => {
    const CASES = [
      ['pure ASCII, mid-label match', 'Pineapple', 'APP'],
      ['accented label, ASCII query', 'Café', 'cafe'],
      ['accented query against an accented label', 'Café', 'é'],
      ['combining marks already in NFD', 'Cafe\u0301 latte', 'cafe'],
      // NB: no astral (surrogate-pair) case belongs in this table. The oracle
      // is *wrong* for those — it grows `folded` by code units but
      // `originIndex` by code points — and `matchSegments` deliberately no
      // longer agrees with it there. Astral inputs are asserted against
      // explicit expected output in the `matchSegments — astral
      // (surrogate-pair) code points` block below.
      ['match at index 0 — no before segment', 'Apple', 'app'],
      ['match ends at the last character — no after segment', 'Apple', 'le'],
      ['label is entirely the match — neither segment', 'Apple', 'apple'],
      ['accented label, match at index 0', 'Ångström', 'ang'],
      ['accented label, match at the end', 'Le café', 'fé'],
      ['empty label', '', 'a'],
      ['empty label and empty query', '', ''],
      ['empty query', 'Apple', ''],
      ['whitespace-only query', 'Apple', '   '],
      ['no match', 'Apple', 'z'],
      ['no match on an accented label', 'Café', 'zzz'],
      ['repeated substring — only the first is highlighted', 'banana', 'ana'],
      ['ASCII label, query folding to non-ASCII', 'Strasse', 'ß'],
      ['query that folds to nothing', 'Apple', '\u0301'],
      // U+005E and U+0060 are the only two ASCII code points with
      // `Diacritic=Yes`, so `normalizeForMatch` strips them and an ASCII label
      // containing either is NOT index-aligned with its folded form.
      ['ASCII caret in the label', 'x^2 + y^2', 'x2'],
      ['ASCII backtick in the label', 'a`b`c', 'abc'],
      ['caret inside the matched span', 'a^bc', 'ab'],
      ['caret before the match', '^abc', 'bc'],
      ['caret after the match', 'abc^', 'ab'],
      ['label is only a caret', '^', '^'],
      ['query is only a backtick', 'Apple', '`'],
      ['caret-bearing query against a caret-bearing label', 'x^2', 'x^2'],
    ] as const;

    it.each(CASES)('%s', (_name, label, query) => {
      expect(matchSegments(label, query)).toEqual(
        matchSegmentsOracle(label, query),
      );
    });

    it('highlights only the first of several occurrences', () => {
      expect(matchSegments('banana', 'ana')).toEqual([
        { text: 'b', matched: false },
        { text: 'ana', matched: true },
        { text: 'na', matched: false },
      ]);
    });
  });

  describe('matchSegments — astral (surrogate-pair) code points', () => {
    // Regression cover for the defect the equivalence oracle above still
    // carries: the folded projection grew by code *units* while `originIndex`
    // grew by code *points*, so every astral code point at or before the match
    // shifted the end-of-match lookup one entry too far. One astral code point
    // over-selected the following code point; a second ran the lookup off the
    // end of `originIndex` entirely, yielding `undefined` → an empty matched
    // segment and the whole label re-emitted as the trailing segment.

    it('highlights exactly the emoji the query asked for', () => {
      expect(matchSegments('a\u{1F34E}b', '\u{1F34E}')).toEqual([
        { text: 'a', matched: false },
        { text: '\u{1F34E}', matched: true },
        { text: 'b', matched: false },
      ]);
    });

    it('matches a bare astral query against a label of one astral code point', () => {
      expect(matchSegments('\u{1F34E}', '\u{1F34E}')).toEqual([
        { text: '\u{1F34E}', matched: true },
      ]);
    });

    it('keeps the slice aligned when an astral code point precedes the match', () => {
      expect(matchSegments('\u{1F34E}x abc', 'abc')).toEqual([
        { text: '\u{1F34E}x ', matched: false },
        { text: 'abc', matched: true },
      ]);
    });

    it('keeps the slice aligned across several astral code points before and inside the match', () => {
      // Two leading pairs plus one inside: a fix that only corrected a
      // single-code-point offset would still land in the wrong place here.
      expect(
        matchSegments('\u{1F34E}\u{1F34F}x a\u{1F350}bc d', 'a\u{1F350}bc'),
      ).toEqual([
        { text: '\u{1F34E}\u{1F34F}x ', matched: false },
        { text: 'a\u{1F350}bc', matched: true },
        { text: ' d', matched: false },
      ]);
    });

    it('highlights an astral code point that sits inside the matched slice', () => {
      expect(matchSegments('pre a\u{1F34E}b post', 'a\u{1F34E}b')).toEqual([
        { text: 'pre ', matched: false },
        { text: 'a\u{1F34E}b', matched: true },
        { text: ' post', matched: false },
      ]);
    });

    it('emits neither surrounding segment when an astral label is wholly matched', () => {
      // Starts at index 0 and ends on the last code point — no before, no after.
      expect(
        matchSegments('\u{1F34E}ab\u{1F34F}', '\u{1F34E}ab\u{1F34F}'),
      ).toEqual([{ text: '\u{1F34E}ab\u{1F34F}', matched: true }]);
    });

    it('folds accents and maps surrogate pairs in the same label', () => {
      // The accented code point folds to *two* code units (NFD: e + U+0301,
      // then the mark is stripped — net one), while the emoji is one code
      // point over two units: both length-changing paths run over one label.
      expect(matchSegments('Caf\u00e9 \u{1F34E} cr\u00e8me', 'creme')).toEqual([
        { text: 'Caf\u00e9 \u{1F34E} ', matched: false },
        { text: 'cr\u00e8me', matched: true },
      ]);
    });

    it('aligns a match that follows a decomposed accent and an emoji', () => {
      expect(matchSegments('Cafe\u0301\u{1F34E}latte', 'latte')).toEqual([
        { text: 'Cafe\u0301\u{1F34E}', matched: false },
        { text: 'latte', matched: true },
      ]);
    });

    it('segments a label made only of astral code points', () => {
      expect(matchSegments('\u{1F34E}\u{1F34F}\u{1F350}', '\u{1F34F}')).toEqual(
        [
          { text: '\u{1F34E}', matched: false },
          { text: '\u{1F34F}', matched: true },
          { text: '\u{1F350}', matched: false },
        ],
      );
    });

    it('is not emoji-specific — CJK extension B', () => {
      // U+2000B CJK UNIFIED IDEOGRAPH-2000B, a non-emoji astral code point.
      expect(matchSegments('\u{2000B}\u{2000B} tail', 'tail')).toEqual([
        { text: '\u{2000B}\u{2000B} ', matched: false },
        { text: 'tail', matched: true },
      ]);
    });

    it('is not emoji-specific — math alphanumerics', () => {
      // U+1D54F MATHEMATICAL DOUBLE-STRUCK CAPITAL X.
      expect(matchSegments('\u{1D54F} math', 'math')).toEqual([
        { text: '\u{1D54F} ', matched: false },
        { text: 'math', matched: true },
      ]);
    });

    it('reports no match without corrupting the label', () => {
      expect(matchSegments('\u{1F34E}\u{1F34F} abc', 'zzz')).toEqual([
        { text: '\u{1F34E}\u{1F34F} abc', matched: false },
      ]);
    });
  });

  describe('matchSegments — differential fuzz against a code-point reference', () => {
    /** Deterministic PRNG (mulberry32) so a failing seed is reproducible. */
    function rng(seed: number): () => number {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /**
     * Mixed alphabet: plain ASCII, the two ASCII `Diacritic=Yes` code points,
     * precomposed accents, the same accents already decomposed (NFD), a bare
     * combining mark, BMP CJK, and astral code points (emoji, CJK ext. B, math
     * alphanumerics) — so the length-changing fold path and the surrogate-pair
     * path interact within a single generated label.
     */
    const ALPHABET = [
      'a',
      'b',
      'c',
      'x',
      'A',
      'B',
      ' ',
      '1',
      '-',
      '^',
      '`',
      '\u00e9',
      '\u00e8',
      '\u00c5',
      '\u00f1',
      'e\u0301',
      'a\u030a',
      '\u0301',
      '\u6f22',
      '\u5b57',
      '\u{1F34E}',
      '\u{1F34F}',
      '\u{2000B}',
      '\u{1D54F}',
    ];

    interface FuzzCase {
      readonly seed: number;
      readonly label: string;
      readonly query: string;
    }

    /**
     * 500 deterministic cases. Most queries are code-point slices *of the
     * label* (so matches are common and the alignment maths is exercised);
     * the rest are independently generated, sometimes case-flipped, to cover
     * near-misses and outright no-matches.
     */
    function corpus(): FuzzCase[] {
      const cases: FuzzCase[] = [];
      for (let seed = 1; seed <= 500; seed++) {
        const rand = rng(seed);
        const pick = () => ALPHABET[Math.floor(rand() * ALPHABET.length)];

        const length = 1 + Math.floor(rand() * 12);
        let label = '';
        for (let i = 0; i < length; i++) label += pick();

        // Slice in code-point space: never splits a surrogate pair, so the
        // query is always well-formed text (a lone surrogate is not a case
        // either implementation claims to define).
        const points = Array.from(label);
        let query: string;
        if (rand() < 0.75 && points.length > 0) {
          const from = Math.floor(rand() * points.length);
          const to = from + 1 + Math.floor(rand() * (points.length - from));
          query = points.slice(from, to).join('');
          if (rand() < 0.3) query = query.toUpperCase();
        } else {
          const qLength = 1 + Math.floor(rand() * 3);
          query = '';
          for (let i = 0; i < qLength; i++) query += pick();
        }

        cases.push({ seed, label, query });
      }
      return cases;
    }

    const CORPUS = corpus();

    it('agrees with the reference on every generated case', () => {
      const mismatches: string[] = [];
      for (const { seed, label, query } of CORPUS) {
        const actual = matchSegments(label, query);
        const expected = matchSegmentsReference(label, query);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          mismatches.push(
            `seed ${seed}: ${JSON.stringify(label)} / ${JSON.stringify(query)}` +
              ` -> ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
          );
        }
      }
      expect(mismatches).toEqual([]);
    });

    it('emits segments that concatenate back to the exact label', () => {
      // Independent of the reference: the desync used to drop the matched
      // slice and re-emit the whole label as the trailing segment, which
      // breaks this invariant outright.
      const broken: string[] = [];
      for (const { seed, label, query } of CORPUS) {
        const joined = matchSegments(label, query)
          .map((segment) => segment.text)
          .join('');
        if (joined !== label)
          broken.push(`seed ${seed}: ${JSON.stringify(joined)}`);
      }
      expect(broken).toEqual([]);
    });

    it('emits at most one matched segment, and never an empty one', () => {
      const broken: string[] = [];
      for (const { seed, label, query } of CORPUS) {
        const segments = matchSegments(label, query);
        const matched = segments.filter((segment) => segment.matched);
        const empty = segments.filter((segment) => segment.text === '');
        // An empty label is the one case that legitimately yields empty text.
        if (matched.length > 1 || (label !== '' && empty.length > 0)) {
          broken.push(`seed ${seed}: ${JSON.stringify(segments)}`);
        }
      }
      expect(broken).toEqual([]);
    });

    it('catches the pre-fix implementation — the harness has teeth', () => {
      // Guard on the guard: run the same corpus through the buggy pre-change
      // implementation and require it to diverge. A fuzz that passes for both
      // proves nothing, so this test fails if the corpus ever stops covering
      // astral input.
      const divergent = CORPUS.filter(
        ({ label, query }) =>
          JSON.stringify(matchSegmentsOracle(label, query)) !==
          JSON.stringify(matchSegmentsReference(label, query)),
      );
      expect(divergent.length).toBeGreaterThan(0);
      // Every divergence must involve an astral code point — if the oracle
      // disagreed anywhere else, the fix would have changed more than intended.
      for (const { label, query } of divergent) {
        // A single code point is two UTF-16 units iff it is astral.
        expect(Array.from(label + query).some((cp) => cp.length > 1)).toBe(
          true,
        );
      }
    });
  });

  describe('matchSegments — ASCII fast path', () => {
    it('segments an ASCII label without a single String.prototype.normalize call', () => {
      const { result, calls } = traceNormalize(() =>
        matchSegments('Pineapple', 'app'),
      );
      expect(calls).toBe(0);
      expect(result).toEqual([
        { text: 'Pine', matched: false },
        { text: 'app', matched: true },
        { text: 'le', matched: false },
      ]);
    });

    it('folds the ASCII label once, not once per code point', () => {
      const { receivers } = traceFolds(() => matchSegments('Pineapple', 'app'));
      // Exactly two folds: the query, then the label. The pre-change
      // implementation folded the label once per code point (10 folds here).
      expect(receivers).toEqual(['app', 'Pineapple']);
    });

    it('routes a caret/backtick label down the folded-projection path', () => {
      // The fast path may only take labels whose fold is length-preserving.
      // `^` and `` ` `` are stripped, so these labels must not take it.
      const { result, calls } = traceNormalize(() =>
        matchSegments('x^2 + y^2', 'x2'),
      );
      expect(calls).toBeGreaterThan(0);
      expect(result).toEqual([
        { text: 'x^2', matched: true },
        { text: ' + y^2', matched: false },
      ]);
    });

    it('never routes a label containing an astral code point down it', () => {
      // An ASCII label cannot contain a surrogate pair, so an astral label
      // always takes the folded-projection path — the fast path is provably
      // never reached with astral input and needs no change for this fix.
      const { result, receivers } = traceFolds(() =>
        matchSegments('a\u{1F34E}b', '\u{1F34E}'),
      );
      // The fast path folds the whole label in one `toLowerCase()`; the folded
      // projection folds it one code point at a time. The absence of the whole
      // label as a receiver is the evidence that the fast path was not taken.
      expect(receivers).not.toContain('a\u{1F34E}b');
      expect(receivers).toEqual(['\u{1F34E}', 'a', '\u{1F34E}', 'b']);
      expect(result).toEqual([
        { text: 'a', matched: false },
        { text: '\u{1F34E}', matched: true },
        { text: 'b', matched: false },
      ]);
    });

    it('keeps an ASCII label on the fast path even when the query is astral', () => {
      // The other direction: an astral *query* cannot occur in an ASCII label,
      // so the fast path correctly reports no match without any projection.
      const { result, receivers } = traceFolds(() =>
        matchSegments('abc', '\u{1F34E}'),
      );
      expect(receivers).toEqual(['\u{1F34E}', 'abc']);
      expect(result).toEqual([{ text: 'abc', matched: false }]);
    });

    it('still folds per code point for a non-ASCII label', () => {
      const { result, calls } = traceNormalize(() =>
        matchSegments('Le café', 'cafe'),
      );
      // Only the one non-ASCII code point needs the NFD pipeline; the ASCII
      // ones take the fast path inside `normalizeForMatch`.
      expect(calls).toBe(1);
      expect(result).toEqual([
        { text: 'Le ', matched: false },
        { text: 'café', matched: true },
      ]);
    });
  });

  describe('filterOptions — folds each label once', () => {
    it('folds every label exactly once with the default matcher', () => {
      const source = opts('Apple', 'Apricot', 'Banana');
      const { result, receivers } = traceFolds(() =>
        filterOptions(source, 'ap'),
      );

      expect(result.map((o) => o.label)).toEqual(['Apple', 'Apricot']);
      // Pre-change, a surviving label was folded twice — once by
      // `defaultOptionMatcher` and again by `rankPrefixMatchesFirst`.
      for (const label of ['Apple', 'Apricot', 'Banana']) {
        expect(receivers.filter((r) => r === label)).toEqual([label]);
      }
      // And the query was folded once per option plus once for ranking.
      expect(receivers.filter((r) => r === 'ap')).toEqual(['ap']);
    });

    it('returns every option in order for a query that folds to nothing', () => {
      const source = opts('Apple', 'Banana');
      expect(filterOptions(source, '\u0301')).toEqual(source);
    });

    it('treats the two ASCII diacritic characters as strippable', () => {
      // Regression guard. `\p{Diacritic}` matches U+005E (^) and U+0060 (`),
      // so a query of either folds to '' and matches every option, and a label
      // carrying one matches a query written without it. A fast path keyed on
      // "is ASCII" alone silently breaks both.
      const source = opts('Alpha', 'Beta');
      expect(filterOptions(source, '^')).toEqual(source);
      expect(filterOptions(source, '`')).toEqual(source);

      const maths = opts('x^2 + y^2', 'plain');
      expect(filterOptions(maths, 'x2').map((o) => o.label)).toEqual([
        'x^2 + y^2',
      ]);
    });

    it('matches the pre-change result on accented labels', () => {
      const source = opts('Decaf', 'Café', 'Cafeteria', 'Tea');
      expect(filterOptions(source, 'caf').map((o) => o.label)).toEqual([
        'Café',
        'Cafeteria',
        'Decaf',
      ]);
    });
  });

  describe('filterOptions — custom matcher', () => {
    it('invokes the custom matcher once per option with the trimmed query', () => {
      const calls: [string, string][] = [];
      const contains: MlvOptionMatcher<string> = (option, query) => {
        calls.push([option.label, query]);
        return option.label.toLowerCase().includes(query.toLowerCase());
      };

      const result = filterOptions(
        opts('Snapple', 'Apple', 'Apricot', 'Banana'),
        '  ap  ',
        contains,
      );

      expect(calls).toEqual([
        ['Snapple', 'ap'],
        ['Apple', 'ap'],
        ['Apricot', 'ap'],
        ['Banana', 'ap'],
      ]);
      // Ranking still applies to a custom matcher's survivors.
      expect(result.map((o) => o.label)).toEqual([
        'Apple',
        'Apricot',
        'Snapple',
      ]);
    });

    it('honours a custom matcher that accepts what the default rejects', () => {
      const everything: MlvOptionMatcher<string> = () => true;
      expect(
        filterOptions(opts('Apple', 'Banana'), 'zzz', everything).map(
          (o) => o.label,
        ),
      ).toEqual(['Apple', 'Banana']);
    });
  });

  describe('rankPrefixMatchesFirst — group runs', () => {
    const grouped: MlvSelectOption<string>[] = [
      { label: 'Pomelo', value: 'a1', group: 'Citrus' },
      { label: 'Grapefruit', value: 'a2', group: 'Citrus' },
      { label: 'Grape', value: 'b1', group: 'Berries' },
      { label: 'Plum', value: 'b2', group: 'Berries' },
      { label: 'Grapefruit II', value: 'c1', group: 'Citrus' },
      { label: 'Pomelo II', value: 'c2', group: 'Citrus' },
    ];

    it('never merges two non-consecutive runs of the same group', () => {
      // If the two Citrus runs merged, c1/c2 would rank alongside a1/a2.
      expect(rankPrefixMatchesFirst(grouped, 'p').map((o) => o.value)).toEqual([
        'a1',
        'a2',
        'b2',
        'b1',
        'c2',
        'c1',
      ]);
    });

    it('applies the same run semantics through the fused default filter', () => {
      expect(filterOptions(grouped, 'p').map((o) => o.value)).toEqual([
        'a1',
        'a2',
        'b2',
        'b1',
        'c2',
        'c1',
      ]);
    });

    it('ranks the post-filter run structure, as it always has', () => {
      // Only Pomelo / Pomelo II survive "pom". Ranking runs *after* filtering
      // (unchanged from the pre-change two-pass shape), so the emptied Berries
      // run leaves the two Citrus entries adjacent and they rank as one run.
      expect(filterOptions(grouped, 'pom').map((o) => o.value)).toEqual([
        'a1',
        'c2',
      ]);
    });

    it('treats a missing group and an empty-string group as one run', () => {
      const mixed: MlvSelectOption<number>[] = [
        { label: 'Grape', value: 1 },
        { label: 'Pear', value: 2, group: '' },
      ];
      // One run → Pear (prefixed) ranks first. Two runs would keep 1 then 2.
      expect(rankPrefixMatchesFirst(mixed, 'pe').map((o) => o.value)).toEqual([
        2, 1,
      ]);
      expect(filterOptions(mixed, 'pe').map((o) => o.value)).toEqual([2, 1]);
    });

    it('returns an empty array for empty input', () => {
      expect(rankPrefixMatchesFirst([], 'p')).toEqual([]);
      expect(filterOptions([], 'p')).toEqual([]);
    });
  });
});
