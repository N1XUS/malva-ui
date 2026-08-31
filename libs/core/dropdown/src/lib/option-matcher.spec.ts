import type { MlvSelectOption } from './select-option';
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
});
