import { describe, expect, it } from 'vitest';
import {
  defaultCompareWith,
  filteredOutCommitted,
  isReconciliationEmit,
} from './reconciliation';

const eq = (a: string, b: string) => a === b;

describe('isReconciliationEmit', () => {
  it('is true when nothing is added and every removed value is filtered out of view', () => {
    // committed A, B; visible only A (B filtered out); aria re-emits [A]
    expect(isReconciliationEmit(['A'], ['A', 'B'], ['A'], eq)).toBe(true);
  });

  it('is true when the emit exactly restates the committed selection', () => {
    expect(isReconciliationEmit(['A'], ['A'], ['A', 'B'], eq)).toBe(true);
  });

  it('is false when a value is added', () => {
    expect(isReconciliationEmit(['A', 'B'], ['A'], ['A', 'B'], eq)).toBe(false);
  });

  it('is false when a still-visible value is removed (genuine deselect)', () => {
    expect(isReconciliationEmit([], ['A'], ['A'], eq)).toBe(false);
  });

  it('is true for the empty-options initial-load case (value present, nothing rendered yet)', () => {
    expect(isReconciliationEmit([], ['A'], [], eq)).toBe(true);
  });
});

describe('filteredOutCommitted', () => {
  it('returns committed values that are neither incoming nor visible', () => {
    expect(filteredOutCommitted(['C'], ['A', 'B'], ['C'], eq)).toEqual([
      'A',
      'B',
    ]);
    expect(filteredOutCommitted(['A'], ['A', 'B'], ['A', 'B'], eq)).toEqual([]);
  });
});

// ─── Shared default comparator ──────────────────────────────────────────────

describe('defaultCompareWith', () => {
  it('is plain `===` — reference equality for objects, NOT structural', () => {
    const a = { id: 1 };
    const b = { id: 1 };
    expect(defaultCompareWith(a, a)).toBe(true);
    expect(defaultCompareWith(a, b)).toBe(false);
  });

  it('keeps the two `===` quirks that distinguish it from Object.is and Set', () => {
    // `NaN === NaN` is false — a `Set` would say true.
    expect(defaultCompareWith(Number.NaN, Number.NaN)).toBe(false);
    // `+0 === -0` is true — `Object.is` would say false.
    expect(defaultCompareWith(0, -0)).toBe(true);
  });
});

// ─── Differential oracle ────────────────────────────────────────────────────

/**
 * Verbatim copy of `isReconciliationEmit` as it stood before the `Set` fast
 * path was added. The optimisation is only correct if it is indistinguishable
 * from this.
 */
function oracleIsReconciliationEmit<T>(
  incoming: readonly T[],
  committed: readonly T[],
  visible: readonly T[],
  compare: (a: T, b: T) => boolean,
): boolean {
  const inArr = (arr: readonly T[], v: T) => arr.some((x) => compare(x, v));

  if (incoming.some((v) => !inArr(committed, v))) return false;

  return committed
    .filter((v) => !inArr(incoming, v))
    .every((v) => !inArr(visible, v));
}

/** Verbatim copy of `filteredOutCommitted` before the `Set` fast path. */
function oracleFilteredOutCommitted<T>(
  incoming: readonly T[],
  committed: readonly T[],
  visible: readonly T[],
  compare: (a: T, b: T) => boolean,
): T[] {
  return committed.filter(
    (v) =>
      !incoming.some((iv) => compare(iv, v)) &&
      !visible.some((vv) => compare(vv, v)),
  );
}

/**
 * Order- and identity-sensitive array assertion. `toEqual` would let a `-0`
 * pass for a `+0` and a structurally-equal object stand in for the committed
 * instance; `Object.is` per element catches both, and comparing index by index
 * catches a reordering.
 */
function expectSameValues<T>(actual: readonly T[], expected: readonly T[]) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    // `Object.is` is only the *assertion*'s equality here — never the helper's.
    expect(
      Object.is(actual[i], expected[i]),
      `index ${i}: ${String(actual[i])} !== ${String(expected[i])}`,
    ).toBe(true);
  }
}

// ─── Differential fuzz ──────────────────────────────────────────────────────

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
 * Deliberately loaded with every value on which the three equality relations
 * disagree: `NaN` (`===` vs `Set`), `+0`/`-0` (`Object.is` vs `Set`), plus
 * distinct-but-structurally-equal objects (`===` vs a by-id comparator).
 */
const POOL: unknown[] = [
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

/** A genuinely different equivalence relation: collapses objects by `id`. */
const byId = (a: unknown, b: unknown): boolean =>
  typeof a === 'object' && a !== null && typeof b === 'object' && b !== null
    ? (a as { id?: unknown }).id === (b as { id?: unknown }).id
    : Object.is(a, b);

const COMPARATORS: ReadonlyArray<
  readonly [string, (a: unknown, b: unknown) => boolean]
> = [
  ['defaultCompareWith', defaultCompareWith],
  ['Object.is', Object.is],
  ['custom byId', byId],
];

describe('reconciliation — differential fuzz against the pre-change oracle', () => {
  const SEEDS = 600;

  for (const [name, compare] of COMPARATORS) {
    it(`matches the oracle over ${SEEDS} random inputs under ${name}`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const rnd = mulberry32(seed);
        const draw = () => {
          const len = Math.floor(rnd() * 7); // 0..6
          return Array.from(
            { length: len },
            () => POOL[Math.floor(rnd() * POOL.length)],
          );
        };
        const incoming = draw();
        const committed = draw();
        const visible = draw();

        const context = `seed ${seed} / ${name}
  incoming:  ${JSON.stringify(incoming.map(String))}
  committed: ${JSON.stringify(committed.map(String))}
  visible:   ${JSON.stringify(visible.map(String))}`;

        expect(
          isReconciliationEmit(incoming, committed, visible, compare),
          context,
        ).toBe(
          oracleIsReconciliationEmit(incoming, committed, visible, compare),
        );

        expectSameValues(
          filteredOutCommitted(incoming, committed, visible, compare),
          oracleFilteredOutCommitted(incoming, committed, visible, compare),
        );
      }
    });
  }
});

// ─── The equality edge cases, explicitly ────────────────────────────────────

/**
 * A `Set` uses SameValueZero, which agrees with neither identity comparator:
 * against `===` it wrongly reports a committed `NaN` as present; against
 * `Object.is` it wrongly conflates `+0` and `-0`. These are the cases that
 * fail if the hazard guard in `identitySets` is removed.
 */
describe('reconciliation — SameValueZero hazards', () => {
  describe('NaN under the `===` default', () => {
    // `NaN === NaN` is false, so aria re-emitting a committed NaN reads as an
    // ADDITION to the oracle. A Set says `has(NaN)` → would report `true`.
    it('isReconciliationEmit: a re-emitted NaN is an addition, not reconciliation', () => {
      const args = [
        [Number.NaN],
        [Number.NaN],
        [Number.NaN],
      ] as const satisfies readonly (readonly unknown[])[];
      expect(
        isReconciliationEmit(args[0], args[1], args[2], defaultCompareWith),
      ).toBe(false);
      expect(
        isReconciliationEmit(args[0], args[1], args[2], defaultCompareWith),
      ).toBe(
        oracleIsReconciliationEmit(
          args[0],
          args[1],
          args[2],
          defaultCompareWith,
        ),
      );
    });

    it('filteredOutCommitted: a committed NaN is never matched by an incoming NaN', () => {
      // Under `===`, NaN matches nothing — so it is "filtered out" and kept.
      expectSameValues(
        filteredOutCommitted(
          [Number.NaN],
          [Number.NaN],
          [Number.NaN],
          defaultCompareWith,
        ),
        [Number.NaN],
      );
      expectSameValues(
        filteredOutCommitted(
          [Number.NaN],
          [Number.NaN],
          [Number.NaN],
          defaultCompareWith,
        ),
        oracleFilteredOutCommitted(
          [Number.NaN],
          [Number.NaN],
          [Number.NaN],
          defaultCompareWith,
        ),
      );
    });

    for (const [where, incoming, committed, visible] of [
      ['incoming', [Number.NaN], ['a'], ['a']],
      ['committed', [], [Number.NaN], ['a']],
      ['visible', [], ['a'], [Number.NaN, 'a']],
      ['all three', [Number.NaN], [Number.NaN, 'a'], [Number.NaN]],
    ] as const) {
      it(`matches the oracle with NaN in ${where}`, () => {
        expect(
          isReconciliationEmit(
            incoming,
            committed,
            visible,
            defaultCompareWith,
          ),
        ).toBe(
          oracleIsReconciliationEmit(
            incoming,
            committed,
            visible,
            defaultCompareWith,
          ),
        );
        expectSameValues(
          filteredOutCommitted(
            incoming,
            committed,
            visible,
            defaultCompareWith,
          ),
          oracleFilteredOutCommitted(
            incoming,
            committed,
            visible,
            defaultCompareWith,
          ),
        );
      });
    }
  });

  describe('-0 vs +0 under Object.is', () => {
    // The hazard sits on the QUERYING side here (committed), not inside a Set —
    // this is why every input array is scanned, not just the two turned into
    // Sets. `Set([+0]).has(-0)` is true; `Object.is(+0, -0)` is false.
    it('filteredOutCommitted: a committed -0 is not matched by an incoming +0', () => {
      expectSameValues(filteredOutCommitted([0], [-0], [], Object.is), [-0]);
      expectSameValues(
        filteredOutCommitted([0], [-0], [], Object.is),
        oracleFilteredOutCommitted([0], [-0], [], Object.is),
      );
    });

    it('filteredOutCommitted: a committed -0 is not matched by a visible +0', () => {
      expectSameValues(filteredOutCommitted([], [-0], [0], Object.is), [-0]);
      expectSameValues(
        filteredOutCommitted([], [-0], [0], Object.is),
        oracleFilteredOutCommitted([], [-0], [0], Object.is),
      );
    });

    it('isReconciliationEmit: an incoming +0 against a committed -0 is an addition', () => {
      expect(isReconciliationEmit([0], [-0], [], Object.is)).toBe(false);
      expect(isReconciliationEmit([0], [-0], [], Object.is)).toBe(
        oracleIsReconciliationEmit([0], [-0], [], Object.is),
      );
    });

    it('isReconciliationEmit: a committed +0 dropped while -0 is visible is a genuine deselect', () => {
      // Oracle: 0 is not in incoming, and `Object.is(-0, 0)` is false, so 0 is
      // NOT visible → reconciliation. A Set would call it visible → false.
      expect(isReconciliationEmit([], [0], [-0], Object.is)).toBe(true);
      expect(isReconciliationEmit([], [0], [-0], Object.is)).toBe(
        oracleIsReconciliationEmit([], [0], [-0], Object.is),
      );
    });

    it('leaves +0-only inputs on the fast path with identical results', () => {
      expect(isReconciliationEmit([0], [0], [0, 1], Object.is)).toBe(
        oracleIsReconciliationEmit([0], [0], [0, 1], Object.is),
      );
      expectSameValues(
        filteredOutCommitted([], [0], [1], Object.is),
        oracleFilteredOutCommitted([], [0], [1], Object.is),
      );
    });
  });

  describe('both hazards under a custom comparator (no fast path at all)', () => {
    for (const [label, incoming, committed, visible] of [
      ['NaN', [Number.NaN], [Number.NaN], [Number.NaN]],
      ['-0 / +0', [0], [-0], [-0]],
      ['mixed', [Number.NaN, 0], [-0, Number.NaN, objA], [objADupe, 0]],
    ] as const) {
      it(`matches the oracle with ${label}`, () => {
        expect(isReconciliationEmit(incoming, committed, visible, byId)).toBe(
          oracleIsReconciliationEmit(incoming, committed, visible, byId),
        );
        expectSameValues(
          filteredOutCommitted(incoming, committed, visible, byId),
          oracleFilteredOutCommitted(incoming, committed, visible, byId),
        );
      });
    }
  });
});

// ─── Order preservation ─────────────────────────────────────────────────────

describe('filteredOutCommitted — committed order is observable', () => {
  // The result is spread straight after the incoming values
  // (`[...incoming, ...filteredOutCommitted(...)]`), so order — and duplicate
  // entries — must survive exactly. A `Set`-driven implementation that iterated
  // a committed set instead of filtering the array would both reorder and
  // de-duplicate this input.
  it('preserves committed order and duplicates', () => {
    const committed = ['B', 'A', 'B', 'C', 'A'];
    expectSameValues(
      filteredOutCommitted([], committed, [], defaultCompareWith),
      ['B', 'A', 'B', 'C', 'A'],
    );
  });

  it('preserves committed order when only some values survive', () => {
    // Insertion order into a Set built from `visible` is D, A — the result must
    // still come out in committed order (C, B), not visible or set order.
    const committed = ['C', 'A', 'B', 'D'];
    expectSameValues(
      filteredOutCommitted([], committed, ['D', 'A'], defaultCompareWith),
      ['C', 'B'],
    );
  });

  it('preserves committed order under Object.is and a custom comparator too', () => {
    const committed = ['C', 'A', 'B', 'D'];
    expectSameValues(
      filteredOutCommitted([], committed, ['D', 'A'], Object.is),
      ['C', 'B'],
    );
    expectSameValues(filteredOutCommitted([], committed, ['D', 'A'], byId), [
      'C',
      'B',
    ]);
  });

  it('returns the committed instances, not the incoming/visible ones', () => {
    // With a by-id comparator, `objADupe` matches `objA` — but a value that is
    // kept must be the committed reference.
    const kept = filteredOutCommitted([], [objA, objB], [objADupe], byId);
    expectSameValues(kept, [objB]);
  });
});

// ─── The fast path is actually taken ────────────────────────────────────────

/**
 * `defaultCompareWith` cannot be wrapped in a spy — the helpers recognise it by
 * reference, so any wrapper would take the pairwise path and measure nothing.
 * Element **reads** are the observable channel that works for every comparator:
 * `Set` construction, `some`, `every` and `filter` all read through the array's
 * index properties, so an accessor per index counts exactly how many times each
 * array is walked.
 *
 * Derivation, for `R` committed values and `V` visible values with an empty
 * `incoming` (so nothing short-circuits):
 *
 *   pairwise `isReconciliationEmit`
 *     `incoming.some(...)`   — 0 iterations, `visible` untouched
 *     `committed.filter(...)` keeps all R (nothing is incoming)
 *     `.every(v => !inArr(visible, v))` scans all V for each of the R  → R × V
 *
 *   pairwise `filteredOutCommitted`
 *     for each of the R committed: `incoming.some` (0) then `visible.some` (V)
 *                                                                     → R × V
 *
 *   fast path (both helpers)
 *     `identitySets` walks `visible` exactly once to build its Set, and every
 *     later test is `Set.has`                                             → V
 *
 * So `visible` reads are `R × V` before and exactly `V` after — the O(R × V)
 * → O(R + V) claim, measured rather than asserted.
 */
function countingArray<T>(values: readonly T[]): {
  array: T[];
  reads: () => number;
} {
  let reads = 0;
  const array: T[] = [];
  array.length = values.length;
  values.forEach((value, index) => {
    Object.defineProperty(array, String(index), {
      get: () => {
        reads++;
        return value;
      },
      enumerable: true,
      configurable: true,
    });
  });
  return { array, reads: () => reads };
}

describe('reconciliation — fast path is taken for identity comparators', () => {
  const R = 50;
  const V = 1000;

  /** R committed values and V visible values, disjoint, no hazards. */
  const scenario = () => ({
    incoming: [] as unknown[],
    committed: Array.from({ length: R }, (_, i) => `c${i}`),
    visible: Array.from({ length: V }, (_, i) => `v${i}`),
  });

  it('countingArray really counts element reads (harness self-check)', () => {
    const { array, reads } = countingArray(['a', 'b', 'c']);
    expect(array.length).toBe(3);
    expect([...array]).toEqual(['a', 'b', 'c']);
    expect(reads()).toBe(3);
    expect(array.some((v) => v === 'c')).toBe(true);
    expect(reads()).toBe(6);
  });

  for (const [name, compare] of [
    ['defaultCompareWith', defaultCompareWith],
    ['Object.is', Object.is],
  ] as const) {
    it(`isReconciliationEmit walks visible once (V=${V}) under ${name}`, () => {
      const { incoming, committed, visible } = scenario();
      const counted = countingArray(visible);
      expect(
        isReconciliationEmit(
          incoming,
          committed,
          counted.array,
          compare as (a: unknown, b: unknown) => boolean,
        ),
      ).toBe(true);
      expect(counted.reads()).toBe(V);
    });

    it(`filteredOutCommitted walks visible once (V=${V}) under ${name}`, () => {
      const { incoming, committed, visible } = scenario();
      const counted = countingArray(visible);
      const kept = filteredOutCommitted(
        incoming,
        committed,
        counted.array,
        compare as (a: unknown, b: unknown) => boolean,
      );
      expect(kept.length).toBe(R);
      expect(counted.reads()).toBe(V);
    });
  }

  it('a custom comparator still pays the full R x V pairwise scan', () => {
    const { incoming, committed, visible } = scenario();
    let compareCalls = 0;
    const custom = (a: unknown, b: unknown) => {
      compareCalls++;
      return a === b;
    };

    const counted = countingArray(visible);
    expect(
      isReconciliationEmit(incoming, committed, counted.array, custom),
    ).toBe(true);
    expect(counted.reads()).toBe(R * V);
    expect(compareCalls).toBe(R * V);

    compareCalls = 0;
    const counted2 = countingArray(visible);
    expect(
      filteredOutCommitted(incoming, committed, counted2.array, custom).length,
    ).toBe(R);
    expect(counted2.reads()).toBe(R * V);
    expect(compareCalls).toBe(R * V);
  });

  it('a SameValueZero hazard forces the pairwise path back on', () => {
    // `-0` in `committed` disqualifies the `Object.is` fast path. It sits at
    // index 0, so `identitySets` bails before it ever reads `visible` — the
    // reads below are therefore exactly the pairwise R x V.
    const { visible } = scenario();
    const committed = [-0, ...Array.from({ length: R - 1 }, (_, i) => `c${i}`)];

    const counted = countingArray(visible);
    expect(isReconciliationEmit([], committed, counted.array, Object.is)).toBe(
      oracleIsReconciliationEmit([], committed, visible, Object.is),
    );
    expect(counted.reads()).toBe(R * V);

    const counted2 = countingArray(visible);
    expectSameValues(
      filteredOutCommitted([], committed, counted2.array, Object.is),
      oracleFilteredOutCommitted([], committed, visible, Object.is),
    );
    expect(counted2.reads()).toBe(R * V);
  });

  it('a NaN hazard forces the pairwise path back on under the `===` default', () => {
    const { visible } = scenario();
    const committed = [
      Number.NaN,
      ...Array.from({ length: R - 1 }, (_, i) => `c${i}`),
    ];

    const counted = countingArray(visible);
    expect(
      isReconciliationEmit([], committed, counted.array, defaultCompareWith),
    ).toBe(
      oracleIsReconciliationEmit([], committed, visible, defaultCompareWith),
    );
    expect(counted.reads()).toBe(R * V);
  });
});
