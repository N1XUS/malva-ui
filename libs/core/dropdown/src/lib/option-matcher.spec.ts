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

/** Pre-change `matchSegments` — always folds the label per code point. */
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
      ['emoji before the match', '🍎 Apple pie', 'apple'],
      ['a surrogate pair as the query', 'a🍎b', '🍎'],
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

    it('reproduces the pre-change surrogate-pair over-selection', () => {
      // PRE-EXISTING QUIRK, deliberately preserved: the slow path grows
      // `folded` by code *units* but `originIndex` by code *points* (the
      // `for…of` over the folded character), so a query containing a surrogate
      // pair maps one code point too far and over-selects. Locked in here
      // because this change is required to be output-identical; fixing it is a
      // separate behavioural change.
      expect(matchSegments('a🍎b', '🍎')).toEqual([
        { text: 'a', matched: false },
        { text: '🍎b', matched: true },
      ]);
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
