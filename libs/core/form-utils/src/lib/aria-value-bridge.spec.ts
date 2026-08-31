import { fromAriaValues, toAriaValues } from './aria-value-bridge';

describe('aria value bridge', () => {
  describe('toAriaValues', () => {
    it('wraps a single value in a one-element array', () => {
      expect(toAriaValues('a')).toEqual(['a']);
      expect(toAriaValues(0)).toEqual([0]);
      expect(toAriaValues(false)).toEqual([false]);
    });

    it('maps null/undefined to an empty array (cleared selection)', () => {
      expect(toAriaValues(null)).toEqual([]);
      expect(toAriaValues(undefined)).toEqual([]);
    });

    it('returns a shallow copy of an incoming array', () => {
      const source = ['a', 'b'];
      const result = toAriaValues(source);
      expect(result).toEqual(['a', 'b']);
      expect(result).not.toBe(source);
    });

    it('preserves an empty multi-select array', () => {
      expect(toAriaValues<string>([])).toEqual([]);
    });
  });

  describe('fromAriaValues', () => {
    it('returns the first value in single-select mode', () => {
      expect(fromAriaValues(['a'], false)).toBe('a');
    });

    it('returns null for an empty array in single-select mode', () => {
      expect(fromAriaValues([], false)).toBeNull();
      expect(fromAriaValues(null, false)).toBeNull();
      expect(fromAriaValues(undefined, false)).toBeNull();
    });

    it('returns a shallow copy of the array in multi-select mode', () => {
      const source = ['a', 'b'];
      const result = fromAriaValues(source, true);
      expect(result).toEqual(['a', 'b']);
      expect(result).not.toBe(source);
    });

    it('returns an empty array for empty/null input in multi-select mode', () => {
      expect(fromAriaValues([], true)).toEqual([]);
      expect(fromAriaValues(null, true)).toEqual([]);
    });
  });

  describe('round trip', () => {
    it('single-select value survives a round trip', () => {
      const original = 'banana';
      expect(fromAriaValues(toAriaValues(original), false)).toBe(original);
    });

    it('single-select null/clear survives a round trip', () => {
      expect(fromAriaValues(toAriaValues(null), false)).toBeNull();
      expect(fromAriaValues(toAriaValues(undefined), false)).toBeNull();
    });

    it('multi-select array survives a round trip', () => {
      const original = ['apple', 'cherry'];
      expect(fromAriaValues(toAriaValues(original), true)).toEqual(original);
    });

    it('multi-select empty (cleared) survives a round trip', () => {
      expect(fromAriaValues(toAriaValues([]), true)).toEqual([]);
      expect(fromAriaValues(toAriaValues(null), true)).toEqual([]);
    });

    it('preserves falsy primitive values through single-select round trip', () => {
      expect(fromAriaValues(toAriaValues(0), false)).toBe(0);
      expect(fromAriaValues(toAriaValues(''), false)).toBe('');
      expect(fromAriaValues(toAriaValues(false), false)).toBe(false);
    });
  });
});
