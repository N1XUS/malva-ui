import { defaultCompareWith } from '@malva-ui/cdk/utils';
import { MlvSelectionService } from './selection.service';

interface Item {
  id: number;
  name: string;
}

describe('MlvSelectionService', () => {
  it('uses reference equality for membership by default', () => {
    const service = new MlvSelectionService<Item>();
    const a = { id: 1, name: 'A' };
    service.setValues([a]);
    expect(service.isSelected(a)).toBe(true);
    // A structurally-equal but distinct object does not match by default.
    expect(service.isSelected({ id: 1, name: 'A' })).toBe(false);
  });

  describe('with a custom compareWith', () => {
    let service: MlvSelectionService<Item>;
    const a: Item = { id: 1, name: 'A' };
    const b: Item = { id: 2, name: 'B' };

    beforeEach(() => {
      service = new MlvSelectionService<Item>();
      service.compareWith.set((x, y) => x.id === y.id);
      service.setValues([a, b]);
    });

    it('isSelected matches by the comparator, not reference', () => {
      expect(service.isSelected({ id: 1, name: 'renamed' })).toBe(true);
      expect(service.isSelected({ id: 3, name: 'C' })).toBe(false);
    });

    it('deselect removes the comparator-matched value', () => {
      service.deselect({ id: 1, name: 'anything' });
      expect(service.selectedValues()).toEqual([b]);
    });

    it('toggle de-dups via the comparator in multi-select mode', () => {
      service.multiple.set(true);
      // Already present by id -> toggling removes it.
      service.toggle({ id: 1, name: 'anything' });
      expect(service.selectedValues()).toEqual([b]);
      // Not present -> toggling adds it.
      service.toggle({ id: 9, name: 'Z' });
      expect(service.selectedValues().map((v) => v.id)).toEqual([2, 9]);
    });
  });
});

// ─── The shared default comparator (issue #67) ──────────────────────────────

/**
 * The service used to declare its default `compareWith` as an inline
 * `(a, b) => a === b` at the `signal()` call, which gave **every service
 * instance its own function reference**. That is behaviourally identical to
 * `defaultCompareWith` and observationally identical to any caller that only
 * *invokes* the comparator — but not to one that *recognises* it.
 *
 * `@malva-ui/core/dropdown`'s `isReconciliationEmit`, `filteredOutCommitted`
 * and `valueIndex` all branch on `compare === defaultCompareWith` to swap a
 * nested pairwise scan for keyed membership, so an unrecognisable default is a
 * permanently disabled fast path that no result-level test can see.
 *
 * These assertions are therefore about the *reference*, not the behaviour —
 * the behavioural half is pinned by the oracle suite below, which must keep
 * passing unchanged.
 */
describe('MlvSelectionService — default compareWith is the shared reference', () => {
  it('defaults compareWith to `defaultCompareWith` itself, not a per-instance copy', () => {
    const service = new MlvSelectionService<Item>();
    expect(service.compareWith()).toBe(defaultCompareWith);
  });

  it('gives every instance the identical reference', () => {
    // Two instances holding two equal-but-distinct arrows compare unequal
    // here, which is exactly the state this replaces.
    expect(new MlvSelectionService().compareWith()).toBe(
      new MlvSelectionService().compareWith(),
    );
  });

  it('still lets a consumer override it, and restore the shared default', () => {
    const service = new MlvSelectionService<Item>();
    const custom = (x: Item, y: Item) => x.id === y.id;

    service.compareWith.set(custom);
    expect(service.compareWith()).toBe(custom);

    service.compareWith.set(defaultCompareWith);
    expect(service.compareWith()).toBe(defaultCompareWith);
  });
});

// ─── Behavioural equivalence with the inline arrow it replaces ──────────────

/**
 * The comparator the service declared inline before the move. Written out here
 * rather than imported, so the oracles below stay fixed even if the shared
 * constant is ever touched.
 */
const inlineDefault = (a: unknown, b: unknown): boolean => a === b;

/** Verbatim copy of `_indexOf` under the pre-change inline default. */
function oracleIndexOf(values: readonly unknown[], value: unknown): number {
  return values.findIndex((v) => inlineDefault(v, value));
}

/** Verbatim copy of `isSelected`. */
function oracleIsSelected(values: readonly unknown[], value: unknown): boolean {
  return oracleIndexOf(values, value) >= 0;
}

/** Verbatim copy of `deselect` — removes EVERY match. */
function oracleDeselect(values: readonly unknown[], value: unknown): unknown[] {
  return values.filter((v) => !inlineDefault(v, value));
}

/**
 * Verbatim copy of `select`. Note it removes only the **first** match where
 * `deselect` removes every one — a distinction the duplicate-heavy pool below
 * makes observable.
 */
function oracleSelect(
  values: readonly unknown[],
  value: unknown,
  multiple: boolean,
): unknown[] {
  if (!multiple) return [value];
  const index = oracleIndexOf(values, value);
  return index >= 0
    ? [...values.slice(0, index), ...values.slice(index + 1)]
    : [...values, value];
}

/** Verbatim copy of `toggle`. */
function oracleToggle(
  values: readonly unknown[],
  value: unknown,
  multiple: boolean,
): unknown[] {
  return oracleIsSelected(values, value)
    ? oracleDeselect(values, value)
    : oracleSelect(values, value, multiple);
}

/**
 * Order- and identity-sensitive array assertion. `toEqual` would let a `-0`
 * pass for a `+0` and a structurally-equal object stand in for the committed
 * instance; `Object.is` per element catches both, and comparing index by index
 * catches a reordering. Borrowed from `reconciliation.spec.ts`.
 *
 * Only booleans, numbers and short strings reach `expect` — never a service
 * instance, whose pretty-printer would stall a failing run for minutes.
 */
function expectSameValues(
  actual: readonly unknown[],
  expected: readonly unknown[],
  context = '',
) {
  expect(actual.length, `length: ${context}`).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(
      Object.is(actual[i], expected[i]),
      `index ${i}: ${String(actual[i])} !== ${String(expected[i])} ${context}`,
    ).toBe(true);
  }
}

/** Deterministic PRNG (mulberry32) so a failing seed is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const objA = { id: 1, tag: 'a' };
/** Structurally equal to `objA` but a distinct reference. */
const objADupe = { id: 1, tag: 'a' };
const objB = { id: 2, tag: 'b' };

/**
 * Deliberately loaded with every value on which the equality relations in play
 * disagree: `NaN` (`===` says not equal to itself; `Object.is` and SameValueZero
 * say equal), `+0`/`-0` (`===` and SameValueZero say equal; `Object.is` says
 * not), plus distinct-but-structurally-equal objects. Any drift of the default
 * away from `===` shows up here and essentially nowhere else.
 */
const POOL: readonly unknown[] = [
  Number.NaN,
  0,
  -0,
  1,
  -1,
  'a',
  'b',
  '',
  true,
  false,
  null,
  undefined,
  objA,
  objADupe,
  objB,
];

describe('MlvSelectionService — the default comparator still behaves as `===`', () => {
  // The pool holds 15 values and selections are 0-6 long, so the reachable
  // state space is small and saturates well before this; 400 seeds re-covered
  // the same states many times over.
  const SEEDS = 50;

  it(`matches the pre-change oracle over ${SEEDS} random selections and queries`, () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rnd = mulberry32(seed);
      const length = Math.floor(rnd() * 7); // 0..6, so duplicates are likely
      const values = Array.from(
        { length },
        () => POOL[Math.floor(rnd() * POOL.length)],
      );
      const query = POOL[Math.floor(rnd() * POOL.length)];
      const multiple = rnd() < 0.5;
      const context = `seed ${seed} / multiple=${multiple} / query=${String(
        query,
      )} / values=[${values.map(String).join(',')}]`;

      const fresh = () => {
        const service = new MlvSelectionService();
        service.multiple.set(multiple);
        service.setValues([...values]);
        return service;
      };

      expect(fresh().isSelected(query), `isSelected: ${context}`).toBe(
        oracleIsSelected(values, query),
      );

      const deselected = fresh();
      deselected.deselect(query);
      expectSameValues(
        deselected.selectedValues(),
        oracleDeselect(values, query),
        `deselect: ${context}`,
      );

      const selected = fresh();
      selected.select(query);
      expectSameValues(
        selected.selectedValues(),
        oracleSelect(values, query, multiple),
        `select: ${context}`,
      );

      const toggled = fresh();
      toggled.toggle(query);
      expectSameValues(
        toggled.selectedValues(),
        oracleToggle(values, query, multiple),
        `toggle: ${context}`,
      );
    }
  });

  it('keeps the two `===` quirks that separate it from Object.is and from a Set', () => {
    const service = new MlvSelectionService<number>();

    // `NaN === NaN` is false — SameValueZero (a `Set`) and `Object.is` say true.
    service.setValues([Number.NaN]);
    expect(service.isSelected(Number.NaN)).toBe(false);

    // `+0 === -0` is true — `Object.is` says false.
    service.setValues([0]);
    expect(service.isSelected(-0)).toBe(true);
    service.setValues([-0]);
    expect(service.isSelected(0)).toBe(true);
  });

  it('deselect removes every duplicate match, select removes only the first', () => {
    const service = new MlvSelectionService<string>();
    service.multiple.set(true);

    service.setValues(['B', 'A', 'B', 'C', 'A']);
    service.deselect('B');
    expectSameValues(service.selectedValues(), ['A', 'C', 'A']);

    service.setValues(['B', 'A', 'B', 'C', 'A']);
    service.select('B');
    expectSameValues(service.selectedValues(), ['A', 'B', 'C', 'A']);
  });

  it('a NaN in the selection is never removed by deselecting NaN', () => {
    // Under `===` nothing matches NaN, so `filter(v => !(v === NaN))` keeps it.
    // A Set-backed membership check would drop it — the hazard this pins.
    const service = new MlvSelectionService<number>();
    service.setValues([Number.NaN, 1]);
    service.deselect(Number.NaN);
    expectSameValues(service.selectedValues(), [Number.NaN, 1]);
  });
});
