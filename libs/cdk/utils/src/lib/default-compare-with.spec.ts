import { defaultCompareWith } from './default-compare-with';

/**
 * `defaultCompareWith` is `===`, and its two divergences from the neighbouring
 * equality relations are load-bearing rather than incidental:
 *
 * |                             | `NaN` vs `NaN` | `+0` vs `-0` |
 * | --------------------------- | -------------- | ------------ |
 * | `===` (this)                | not equal      | equal        |
 * | `Object.is`                 | equal          | not equal    |
 * | SameValueZero (`Set`/`Map`) | equal          | equal        |
 *
 * `@malva-ui/core/dropdown`'s `hazardOf` derives "`NaN` is the one value on
 * which a `Set` may not stand in for this comparator" directly from the first
 * row. Quietly promoting this to `Object.is` — a plausible-looking tidy-up —
 * would leave that guard checking for the wrong hazard while every fast path
 * kept reporting answers.
 */
describe('defaultCompareWith', () => {
  it('is reference equality for objects, not structural', () => {
    const a = { id: 1 };
    const b = { id: 1 };
    expect(defaultCompareWith(a, a)).toBe(true);
    expect(defaultCompareWith(a, b)).toBe(false);
  });

  it('is `===`, not `Object.is`: NaN is not equal to itself', () => {
    expect(defaultCompareWith(Number.NaN, Number.NaN)).toBe(false);
    expect(Object.is(Number.NaN, Number.NaN)).toBe(true);
  });

  it('is `===`, not `Object.is`: +0 and -0 are equal', () => {
    expect(defaultCompareWith(0, -0)).toBe(true);
    expect(defaultCompareWith(-0, 0)).toBe(true);
    expect(Object.is(0, -0)).toBe(false);
  });

  it('agrees with `===` on the ordinary primitives', () => {
    expect(defaultCompareWith('a', 'a')).toBe(true);
    expect(defaultCompareWith('a', 'b')).toBe(false);
    expect(defaultCompareWith(1, 1)).toBe(true);
    expect(defaultCompareWith(null, null)).toBe(true);
    expect(defaultCompareWith(undefined, undefined)).toBe(true);
    expect(defaultCompareWith<unknown>(null, undefined)).toBe(false);
    expect(defaultCompareWith<unknown>(0, '')).toBe(false);
    expect(defaultCompareWith<unknown>(0, false)).toBe(false);
  });

  it('is one stable module-level reference, not a factory', () => {
    // The recognition mechanism rests on this being a value, not a factory: a
    // `defaultCompareWith()` that returned a fresh arrow would still satisfy
    // every behavioural test above while breaking every `===` recognition
    // site. Two separate imports of the module must yield the same binding.
    // (Asserting `defaultCompareWith === defaultCompareWith` would be a
    // tautology no mutation can fail, so re-import instead.)
    expect(typeof defaultCompareWith).toBe('function');
    expect(defaultCompareWith.length).toBe(2);
  });

  it('is the same binding when the module is imported again', async () => {
    const reimported = await import('./default-compare-with');
    expect(reimported.defaultCompareWith).toBe(defaultCompareWith);
  });
});
