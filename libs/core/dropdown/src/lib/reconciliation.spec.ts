import { describe, expect, it } from 'vitest';
import { defaultCompareWith as cdkDefaultCompareWith } from '@malva-ui/cdk/utils';
import { MlvSelectionService } from '@malva-ui/core/form-utils';
import {
  defaultCompareWith,
  filteredOutCommitted,
  isReconciliationEmit,
  valueIndex,
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

/**
 * Deliberately **asymmetric**, and not an equivalence relation at all:
 * `lexicallyBefore(a, b)` is the negation of `lexicallyBefore(b, a)` for every
 * unequal pair. A `compareWith` is an arbitrary caller-supplied predicate, so
 * nothing here may assume symmetry — and every other comparator in this file
 * (`===`, `Object.is`, `byId`) is symmetric and therefore blind to a
 * transposed argument order.
 */
const lexicallyBefore = (a: unknown, b: unknown): boolean =>
  String(a) < String(b);

const COMPARATORS: ReadonlyArray<
  readonly [string, (a: unknown, b: unknown) => boolean]
> = [
  ['defaultCompareWith', defaultCompareWith],
  ['Object.is', Object.is],
  ['custom byId', byId],
  ['custom asymmetric lexicallyBefore', lexicallyBefore],
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

// ─── valueIndex ─────────────────────────────────────────────────────────────

/**
 * Verbatim copies of the two scans `valueIndex` replaces, written in the shape
 * the option controls had them: over `MlvSelectOption`-like objects, reaching
 * through `.value`. `resolve`'s `?? value` fallback is part of the oracle —
 * an option whose own `value` is `null`/`undefined` fell through to the query
 * value, and that quirk must survive.
 */
function oracleHas<T>(
  options: readonly { value: T }[],
  value: T,
  compare: (a: T, b: T) => boolean,
): boolean {
  return options.some((o) => compare(o.value, value));
}

function oracleResolve<T>(
  options: readonly { value: T }[],
  value: T,
  compare: (a: T, b: T) => boolean,
): T {
  return options.find((o) => compare(o.value, value))?.value ?? value;
}

/** The controls index the mapped option values, so the oracle takes options. */
const asOptions = <T>(values: readonly T[]): { value: T }[] =>
  values.map((value) => ({ value }));

describe('valueIndex — matches the pairwise scan it replaces', () => {
  for (const [name, compare] of COMPARATORS) {
    it(`has()/resolve() agree with the oracle over 600 random inputs under ${name}`, () => {
      for (let seed = 1; seed <= 600; seed++) {
        const rnd = mulberry32(seed);
        const draw = () => {
          const len = Math.floor(rnd() * 7); // 0..6
          return Array.from(
            { length: len },
            () => POOL[Math.floor(rnd() * POOL.length)],
          );
        };
        const values = draw();
        const queries = draw();
        const index = valueIndex(values, compare);
        const context = `seed ${seed} / ${name}
  values:  ${JSON.stringify(values.map(String))}
  queries: ${JSON.stringify(queries.map(String))}`;

        // The controls index through a projection (`option => option.value`),
        // so drive both overloads against the same oracle.
        const projected = valueIndex(
          asOptions(values),
          compare,
          (option) => option.value,
        );

        // The walk carries a cursor, so an answer can in principle depend on
        // what was asked before it. Ask in a seeded random order, and ask some
        // queries twice, so an order-dependent bug cannot hide behind the
        // natural left-to-right order the values were generated in.
        const shuffled = [...queries, ...queries];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        for (const query of shuffled) {
          for (const [shape, subject] of [
            ['plain', index],
            ['projected', projected],
          ] as const) {
            expect(subject.has(query), `${context} [${shape}]`).toBe(
              oracleHas(asOptions(values), query, compare),
            );
            expect(
              Object.is(
                subject.resolve(query),
                oracleResolve(asOptions(values), query, compare),
              ),
              `${context} [${shape}]\n  query: ${String(query)}`,
            ).toBe(true);
          }
        }
      }
    });
  }

  it('handles an empty haystack (no options loaded yet)', () => {
    for (const [, compare] of COMPARATORS) {
      const index = valueIndex([], compare);
      expect(index.has('a')).toBe(false);
      expect(index.resolve('a')).toBe('a');
    }
  });

  it('handles an empty query set (nothing selected)', () => {
    // The index is still built; it is simply never asked anything.
    for (const [, compare] of COMPARATORS) {
      const index = valueIndex(['a', 'b'], compare);
      expect([].every((v) => index.has(v))).toBe(true);
    }
  });

  it('resolve() returns the FIRST match, like `Array.prototype.find`', () => {
    // Two by-id-equal instances: the earlier one must win, so a duplicate key
    // may not overwrite the entry already indexed. Pairwise path.
    const first = { id: 1, tag: 'first' };
    const second = { id: 1, tag: 'second' };
    expect(valueIndex([first, second], byId).resolve({ id: 1 })).toBe(first);
  });

  it('resolve() returns the FIRST match on the KEYED path too (±0)', () => {
    // Distinct object references are distinct `Map` keys, so they cannot tell
    // first-wins from last-wins. `+0` and `-0` are the same SameValueZero key
    // with distinguishable values, which is the only way to observe it:
    // `Map.set` on an existing key replaces the value and keeps the key, so an
    // unguarded `set` returns `-0` where `find` returns `+0`.
    const index = valueIndex([0, -0], defaultCompareWith);
    expect(Object.is(index.resolve(0), 0)).toBe(true);
    expect(Object.is(index.resolve(0), -0)).toBe(false);
    expect(
      Object.is(
        index.resolve(0),
        oracleResolve(asOptions([0, -0]), 0, defaultCompareWith),
      ),
    ).toBe(true);
    // And in the other order: `-0` first means `find` returns `-0`.
    const negativeFirst = valueIndex([-0, 0], defaultCompareWith);
    expect(Object.is(negativeFirst.resolve(0), -0)).toBe(true);
  });

  it('resolve() returns the indexed instance, not the queried one', () => {
    expect(valueIndex([objA], byId).resolve(objADupe)).toBe(objA);
  });

  it('applies compare(indexedValue, queriedValue) — never the transpose', () => {
    // `valueIndex` DEFINES the argument order every call site depends on, so it
    // is pinned here rather than only at the sites. Asymmetric on purpose: true
    // only with an indexed `sel:` value first and a queried `opt:` value
    // second, so a transposition flips every answer.
    const asymmetric = (a: string, b: string) =>
      a.startsWith('sel:') && b.startsWith('opt:') && a.slice(4) === b.slice(4);
    expect(asymmetric('sel:b', 'opt:b')).toBe(true);
    expect(asymmetric('opt:b', 'sel:b')).toBe(false);

    const index = valueIndex(['sel:a', 'sel:b'], asymmetric);
    expect(index.has('opt:b')).toBe(true);
    expect(index.resolve('opt:b')).toBe('sel:b');

    // The transposed index — the mistake this guards — answers the opposite.
    const transposed = valueIndex(['opt:a', 'opt:b'], asymmetric);
    expect(transposed.has('sel:b')).toBe(false);
    expect(transposed.resolve('sel:b')).toBe('sel:b');

    // Same through the projection overload.
    const projected = valueIndex(
      [{ value: 'sel:b' }],
      asymmetric,
      (item) => item.value,
    );
    expect(projected.has('opt:b')).toBe(true);
    expect(projected.resolve('opt:b')).toBe('sel:b');
  });

  it('resolve() keeps the `?? value` fallback for a nullish indexed value', () => {
    // `options.find(...)?.value ?? v` returned `v` when the matched option's
    // own value was nullish. Both paths must still do that.
    for (const [, compare] of [
      ['defaultCompareWith', defaultCompareWith],
      ['custom byId', byId],
    ] as const) {
      const index = valueIndex([null, undefined], compare);
      expect(index.resolve(null)).toBe(null);
      expect(index.resolve(undefined)).toBe(undefined);
      expect(index.has(null)).toBe(true);
      expect(index.has(undefined)).toBe(true);
    }
  });
});

describe('valueIndex — SameValueZero hazards', () => {
  it('NaN in the haystack forces the pairwise path under the `===` default', () => {
    const index = valueIndex([Number.NaN, 'a'], defaultCompareWith);
    // `NaN === NaN` is false — a `Map` would report the key as present.
    expect(index.has(Number.NaN)).toBe(false);
    expect(Object.is(index.resolve(Number.NaN), Number.NaN)).toBe(true);
    expect(index.has('a')).toBe(true);
  });

  it('a queried NaN is absent from a NaN-free haystack under `===`', () => {
    const index = valueIndex(['a', 'b'], defaultCompareWith);
    expect(index.has(Number.NaN)).toBe(false);
    expect(index.has(Number.NaN)).toBe(
      oracleHas(asOptions(['a', 'b']), Number.NaN, defaultCompareWith),
    );
  });

  it('NaN is NOT a hazard under Object.is — it stays on the fast path', () => {
    const index = valueIndex([Number.NaN, 'a'], Object.is);
    expect(index.has(Number.NaN)).toBe(true);
    expect(Object.is(index.resolve(Number.NaN), Number.NaN)).toBe(true);
  });

  it('-0 on the HAYSTACK side disqualifies the fast path under Object.is', () => {
    const index = valueIndex([-0, 'a'], Object.is);
    // `Object.is(-0, +0)` is false; a `Map` keyed on -0 would match +0.
    expect(index.has(0)).toBe(false);
    expect(Object.is(index.resolve(0), 0)).toBe(true);
    expect(index.has(-0)).toBe(true);
    expect(Object.is(index.resolve(-0), -0)).toBe(true);
  });

  it('-0 on the QUERYING side is answered pairwise under Object.is', () => {
    // The haystack is hazard-free, so the Map is built — but `Map([+0]).has(-0)`
    // is true while `Object.is(+0, -0)` is false. That one query falls back.
    const index = valueIndex([0, 'a'], Object.is);
    expect(index.has(-0)).toBe(false);
    expect(Object.is(index.resolve(-0), -0)).toBe(true);
    // Every other query stays on the fast path and stays correct.
    expect(index.has(0)).toBe(true);
    expect(index.has('a')).toBe(true);
  });

  it('±0 under `===` needs no bail — the `Map` reproduces `+0 === -0`', () => {
    // `===` conflates the zeros exactly as SameValueZero does, so a queried -0
    // must resolve onto the indexed +0 instance, matching `find`.
    const index = valueIndex([0, 'a'], defaultCompareWith);
    expect(index.has(-0)).toBe(true);
    expect(Object.is(index.resolve(-0), 0)).toBe(true);
    expect(
      Object.is(
        index.resolve(-0),
        oracleResolve(asOptions([0, 'a']), -0, defaultCompareWith),
      ),
    ).toBe(true);
    const negative = valueIndex([-0, 'a'], defaultCompareWith);
    expect(negative.has(0)).toBe(true);
    expect(Object.is(negative.resolve(0), -0)).toBe(true);
  });

  it('a custom comparator sees every hazard value pairwise', () => {
    const index = valueIndex([Number.NaN, -0, objA], byId);
    expect(index.has(Number.NaN)).toBe(true); // byId falls back to Object.is
    expect(index.has(0)).toBe(false);
    expect(index.resolve(objADupe)).toBe(objA);
  });
});

/**
 * The guard that fails if the fast path regresses to a nested scan. Same
 * instrument as the reconciliation suite above: `defaultCompareWith` cannot be
 * wrapped in a spy without destroying the reference it is recognised by, so
 * element **reads** are the observable channel.
 *
 * For R queries against V indexed values, all misses (so nothing short-circuits):
 *
 *   pairwise  — one `some`/`find` scan of all V per query          → R × V
 *   fast path — one walk of V to build the `Map`, then `Map.has`   → V
 */
describe('valueIndex — the fast path is actually taken', () => {
  const R = 50;
  const V = 1000;
  const haystack = Array.from({ length: V }, (_, i) => `v${i}`);
  const queries = Array.from({ length: R }, (_, i) => `q${i}`);

  for (const [name, compare] of [
    ['defaultCompareWith', defaultCompareWith],
    ['Object.is', Object.is],
  ] as const) {
    it(`walks the haystack once (V=${V}) for ${R} queries under ${name}`, () => {
      const counted = countingArray(haystack);
      const index = valueIndex(
        counted.array,
        compare as (a: unknown, b: unknown) => boolean,
      );
      for (const query of queries) {
        expect(index.has(query)).toBe(false);
        expect(index.resolve(query)).toBe(query);
      }
      expect(counted.reads()).toBe(V);
    });
  }

  it(`a custom comparator still pays the full R x V pairwise scan`, () => {
    let compareCalls = 0;
    const custom = (a: unknown, b: unknown) => {
      compareCalls++;
      return a === b;
    };
    const counted = countingArray(haystack);
    const index = valueIndex(counted.array, custom);
    for (const query of queries) expect(index.has(query)).toBe(false);
    expect(counted.reads()).toBe(R * V);
    expect(compareCalls).toBe(R * V);
  });

  it('a hazard in the haystack forces the pairwise path back on', () => {
    // `-0` at index 0 disqualifies the `Object.is` fast path: the build bails
    // after exactly one read, and every query then scans all V pairwise.
    const counted = countingArray([-0, ...haystack.slice(1)]);
    const index = valueIndex(counted.array, Object.is);
    for (const query of queries) expect(index.has(query)).toBe(false);
    expect(counted.reads()).toBe(1 + R * V);
  });

  it('a hazardous QUERY costs one extra scan and leaves the rest fast', () => {
    const counted = countingArray(haystack);
    const index = valueIndex(counted.array, Object.is);
    expect(index.has(-0)).toBe(false); // build (V) + one pairwise scan (V)
    for (const query of queries) expect(index.has(query)).toBe(false);
    expect(counted.reads()).toBe(2 * V);
  });
});

// ---------------------------------------------------------------------------
// The progressive walk carries mutable state across queries — a cursor, a
// partial map and a bail latch. That is a failure class the stateless
// implementations could not have: an answer may now depend on what was asked
// before it. These pin it.
// ---------------------------------------------------------------------------

describe('valueIndex — progressive walk (cursor state)', () => {
  const letters = ['a', 'b', 'c', 'd', 'e'];

  it('stops the walk at the first match instead of building the whole map', () => {
    const counted = countingArray(letters);
    const index = valueIndex(counted.array, defaultCompareWith);

    expect(index.has('a')).toBe(true);
    // One element read — a build-it-all index would have read all five.
    expect(counted.reads()).toBe(1);
  });

  it('answers from the built prefix without reading anything more', () => {
    const counted = countingArray(letters);
    const index = valueIndex(counted.array, defaultCompareWith);

    expect(index.has('c')).toBe(true); // walks a, b, c
    expect(counted.reads()).toBe(3);

    expect(index.has('a')).toBe(true); // strictly inside the prefix
    expect(index.has('b')).toBe(true);
    expect(counted.reads()).toBe(3);
  });

  it('resumes from the cursor rather than restarting at 0', () => {
    const counted = countingArray(letters);
    const index = valueIndex(counted.array, defaultCompareWith);

    expect(index.has('b')).toBe(true); // a, b        → cursor 2
    expect(counted.reads()).toBe(2);
    expect(index.has('c')).toBe(true); // exactly at the cursor
    expect(counted.reads()).toBe(3);
    expect(index.has('e')).toBe(true); // beyond it: d, e
    expect(counted.reads()).toBe(5);

    // Restarting each query would have cost 2 + 3 + 5 = 10.
  });

  it('a definite miss scans to the end and is not a false negative', () => {
    const counted = countingArray(letters);
    const index = valueIndex(counted.array, defaultCompareWith);

    expect(index.has('b')).toBe(true);
    expect(counted.reads()).toBe(2);

    expect(index.has('zz')).toBe(false); // must finish the array to be sure
    expect(counted.reads()).toBe(5);

    expect(index.has('yy')).toBe(false); // cursor exhausted → free
    expect(counted.reads()).toBe(5);
    expect(index.has('e')).toBe(true); // still answers hits from the prefix
    expect(counted.reads()).toBe(5);
  });

  it('resolve() after a has() that moved the cursor still returns the FIRST match', () => {
    // Two structurally distinct instances that `byId` treats as equal, so
    // "first match" is observable. `byId` is custom, so drive the identity
    // path with duplicated primitives instead.
    const values = ['x', 'y', 'x', 'z'];
    const index = valueIndex(values, defaultCompareWith);

    expect(index.has('z')).toBe(true); // walks the whole array, cursor at end
    // The map holds the FIRST 'x', not the one at index 2.
    expect(index.resolve('x')).toBe('x');
    expect(index.resolve('x')).toBe(
      oracleResolve(asOptions(values), 'x', defaultCompareWith),
    );
  });

  it('interleaved has()/resolve() agree with the oracle whatever the order', () => {
    const values = ['a', 'b', 'c', 'd'];
    const index = valueIndex(values, defaultCompareWith);
    const order = ['c', 'a', 'zz', 'd', 'b', 'c', 'zz'];

    for (const q of order) {
      expect(index.has(q), `has(${q})`).toBe(
        oracleHas(asOptions(values), q, defaultCompareWith),
      );
      expect(
        Object.is(
          index.resolve(q),
          oracleResolve(asOptions(values), q, defaultCompareWith),
        ),
        `resolve(${q})`,
      ).toBe(true);
    }
  });

  it('first-wins survives a walk that PASSES the duplicate (±0 under `===`)', () => {
    // Query 'x' first so the walk materialises both zeros before anything asks
    // for one — this is the path where an unguarded `Map.set` would be
    // observably last-wins and hand back `-0`.
    const values: unknown[] = [0, -0, 'x'];
    const index = valueIndex(values, defaultCompareWith);

    expect(index.has('x')).toBe(true); // forces the full walk
    expect(Object.is(index.resolve(0), 0)).toBe(true); // +0, not -0
    expect(Object.is(index.resolve(-0), 0)).toBe(true);
    expect(
      Object.is(
        index.resolve(0),
        oracleResolve(asOptions(values), 0, defaultCompareWith),
      ),
    ).toBe(true);
  });

  it('first-wins also when the walk STOPS before the duplicate (±0 under `===`)', () => {
    const values: unknown[] = [0, -0];
    const index = valueIndex(values, defaultCompareWith);
    expect(Object.is(index.resolve(0), 0)).toBe(true);
  });

  describe('a hazard positioned after the cursor bails the index mid-life', () => {
    // `===` treats NaN as a hazard. It sits at index 2, so the first two
    // queries are answered from a hazard-free prefix and only the third walk
    // reaches it.
    const values: unknown[] = ['a', 'b', NaN, 'c'];
    const oracle = (q: unknown) =>
      oracleHas(asOptions(values), q, defaultCompareWith);

    it('answers correctly before, during and after the bail', () => {
      const index = valueIndex(values, defaultCompareWith);

      expect(index.has('a')).toBe(oracle('a')); // prefix, pre-bail
      expect(index.has('b')).toBe(oracle('b'));
      expect(index.has('c')).toBe(oracle('c')); // walk hits NaN → bail → pairwise
      // Everything answered before the bail must still answer the same way.
      expect(index.has('a')).toBe(oracle('a'));
      expect(index.has('b')).toBe(oracle('b'));
      expect(index.has('zz')).toBe(oracle('zz'));
      expect(index.has(NaN)).toBe(oracle(NaN)); // `===` never matches NaN
    });

    it('goes permanently pairwise once bailed', () => {
      const counted = countingArray(values);
      const index = valueIndex(counted.array, defaultCompareWith);

      expect(index.has('a')).toBe(true);
      expect(counted.reads()).toBe(1);

      expect(index.has('c')).toBe(true); // b, NaN → bail, then a full scan
      const afterBail = counted.reads();

      // A prefix hit is no longer served from the map — it goes back through
      // the pairwise scan, which short-circuits at index 0 for 'a' …
      expect(index.has('a')).toBe(true);
      expect(counted.reads()).toBe(afterBail + 1);

      // … and walks the whole array for a miss. Neither is free, which is the
      // point: the map is not consulted again.
      const beforeMiss = counted.reads();
      expect(index.has('zz')).toBe(false);
      expect(counted.reads()).toBe(beforeMiss + values.length);
    });
  });

  it('a hazardous QUERY against a partially built index does not disturb it', () => {
    const values: unknown[] = ['a', 'b', 'c'];
    const counted = countingArray(values);
    const index = valueIndex(counted.array, Object.is);

    expect(index.has('b')).toBe(true); // cursor 2
    expect(counted.reads()).toBe(2);

    expect(index.has(-0)).toBe(false); // hazardous query → its own full scan
    expect(counted.reads()).toBe(2 + values.length);

    // The cursor and prefix survived: 'a' is still free, 'c' still resumes.
    const before = counted.reads();
    expect(index.has('a')).toBe(true);
    expect(counted.reads()).toBe(before);
    expect(index.has('c')).toBe(true);
    expect(counted.reads()).toBe(before + 1);
  });
});

// ─── The shared default comparator crosses library boundaries intact (#67) ──

/**
 * `defaultCompareWith`'s implementation lives in `@malva-ui/cdk/utils` so that
 * `@malva-ui/core/form-utils`' `MlvSelectionService` can share it — this entry
 * point depends on form-utils (`mlv-dropdown-panel` injects the service), so
 * the constant could not live here and still be reachable downward.
 *
 * The entire mechanism is **reference identity**: `hazardOf` recognises the
 * comparator with `===`. A re-export that wrapped, bound or re-created it
 * would keep every result correct and silently disable every fast path — no
 * assertion about *values* could ever see that. These tests assert the
 * identity itself, and then that the identity still does its job end to end.
 */
describe('defaultCompareWith — shared across cdk/utils, dropdown and form-utils', () => {
  it('re-exports the cdk/utils binding rather than a local copy', () => {
    expect(defaultCompareWith).toBe(cdkDefaultCompareWith);
  });

  it('is the reference `MlvSelectionService` defaults to', () => {
    expect(new MlvSelectionService().compareWith()).toBe(defaultCompareWith);
  });

  it("unlocks valueIndex's keyed path for the service's default comparator", () => {
    // Measured rather than asserted: a comparator taken straight off a
    // `MlvSelectionService` walks the haystack once, not once per query.
    // Before the constant moved down, the service's default was a per-instance
    // arrow and this read R x V.
    //
    // This composition has no production call site today -- `mlv-select` and
    // `mlv-combobox` feed `valueIndex` from their own `compareWith` *input*,
    // which already defaulted to the shared reference, and then push that input
    // into the service. So the guard is forward-looking: it holds the door open
    // for the first caller that does thread the service's comparator into a
    // fast path, and fails loudly if the reference is ever wrapped or copied.
    const R = 50;
    const V = 1000;
    const haystack = Array.from({ length: V }, (_, i) => `v${i}`);
    const counted = countingArray(haystack);

    const service = new MlvSelectionService<string>();
    const index = valueIndex(counted.array, service.compareWith());
    for (let i = 0; i < R; i++) expect(index.has(`q${i}`)).toBe(false);

    expect(counted.reads()).toBe(V);
  });

  it('a service given a custom comparator still pays the pairwise scan', () => {
    // The complement: recognition is by reference, so overriding the default
    // must fall back — otherwise the guard is matching something too loosely.
    const R = 10;
    const V = 100;
    const haystack = Array.from({ length: V }, (_, i) => `v${i}`);
    const counted = countingArray(haystack);

    const service = new MlvSelectionService<string>();
    service.compareWith.set((a, b) => a === b); // same behaviour, new reference
    const index = valueIndex(counted.array, service.compareWith());
    for (let i = 0; i < R; i++) expect(index.has(`q${i}`)).toBe(false);

    expect(counted.reads()).toBe(R * V);
  });
});
