/**
 * Value-identity machinery shared by the option controls (`mlv-select`,
 * `mlv-combobox`).
 *
 * Two things live here:
 *
 * - {@link defaultCompareWith} plus the reconciliation guards
 *   ({@link isReconciliationEmit} / {@link filteredOutCommitted}).
 *   `@angular/aria`'s `ngListbox` reconciles its `value` model against the
 *   currently **rendered** options and re-emits `valueChange` whenever the
 *   rendered set changes — not only on user interaction. Those guards let an
 *   owning control tell that noise apart from a genuine selection.
 * - {@link valueIndex}, the general "is this value among those?" primitive the
 *   controls use to cross-check a committed selection against the option list
 *   without a nested scan.
 *
 * Both sides branch on the *same* recognised-identity-comparator rule
 * ({@link hazardOf}) — there is exactly one statement of it in the repo.
 */

/**
 * The default value-equality predicate behind every option control's
 * `compareWith` input (`mlv-select`, `mlv-combobox`). Plain reference (`===`)
 * equality.
 *
 * Behaviourally identical to the per-instance inline arrow it replaces — it
 * exists as a single module-level reference so {@link isReconciliationEmit},
 * {@link filteredOutCommitted} and {@link valueIndex} can *recognise* it and
 * swap their nested linear scans for O(n + m) keyed membership. A control that
 * leaves `compareWith` unset therefore gets the fast path automatically; one
 * that supplies its own comparator keeps the pairwise path unchanged.
 */
export const defaultCompareWith = <T>(a: T, b: T): boolean => a === b;

/**
 * @internal `NaN` — the only value on which `===` and `Set` membership
 * (SameValueZero) disagree.
 */
function isNaNValue(value: unknown): boolean {
  return typeof value === 'number' && Number.isNaN(value);
}

/**
 * @internal `-0` — the only value on which `Object.is` and `Set` membership
 * (SameValueZero) disagree. Written as the reciprocal test rather than a `-0`
 * literal comparison, because `-0 === 0` is `true`.
 */
function isNegativeZero(value: unknown): boolean {
  return typeof value === 'number' && value === 0 && 1 / value === -Infinity;
}

/**
 * @internal **The one statement of the hazard rule.** Returns the predicate
 * identifying the values on which `compare` and SameValueZero (the equality
 * behind `Set` / `Map` keys) disagree, or `null` when `compare` is not a
 * recognised identity comparator and no keyed container may stand in for it.
 *
 * SameValueZero agrees with *neither* identity comparator in general:
 *
 * |                            | `NaN` vs `NaN` | `+0` vs `-0` |
 * | -------------------------- | -------------- | ------------ |
 * | `===`                      | not equal      | equal        |
 * | `Object.is`                | equal          | not equal    |
 * | SameValueZero (`Set`/`Map`)| equal          | equal        |
 *
 * `===` and SameValueZero differ on exactly one pair of values, `(NaN, NaN)`.
 * `Object.is` and SameValueZero differ on exactly two, `(+0, -0)` and
 * `(-0, +0)`. So if the relevant hazard value — `NaN` for `===`, `-0` for
 * `Object.is` — is absent from both the keyed side and the querying side, no
 * differing pair can be formed from the values actually present and the two
 * relations coincide on them; the container is then an exact substitute for
 * the pairwise scan.
 *
 * A caller-supplied comparator returns `null`, so it pays for no scan at all.
 */
function hazardOf<T>(
  compare: (a: T, b: T) => boolean,
): ((value: unknown) => boolean) | null {
  if ((compare as unknown) === (defaultCompareWith as unknown)) {
    return isNaNValue;
  }
  if ((compare as unknown) === (Object.is as unknown)) {
    return isNegativeZero;
  }
  return null;
}

/**
 * @internal Builds one SameValueZero `Set` per input array — `[incoming,
 * committed, visible]` — or returns `null` when the `Set` fast path would not
 * be exactly equivalent to `compare` (see {@link hazardOf}).
 *
 * All three arrays are scanned even when a caller only consumes two of the
 * sets: for `Object.is`, a `-0` on the *querying* side is just as hazardous as
 * one inside the set (`+0` in the set, `-0` queried — SameValueZero says
 * present, `Object.is` says absent). One hazard anywhere disqualifies all
 * three sets, so every guard in this file sees the same relation.
 */
function identitySets<T>(
  incoming: readonly T[],
  committed: readonly T[],
  visible: readonly T[],
  compare: (a: T, b: T) => boolean,
): [Set<T>, Set<T>, Set<T>] | null {
  const isHazard = hazardOf(compare);
  if (!isHazard) return null;

  const sets: Set<T>[] = [];
  for (const values of [incoming, committed, visible]) {
    const set = new Set<T>();
    for (const value of values) {
      if (isHazard(value)) return null;
      set.add(value);
    }
    sets.push(set);
  }
  return sets as [Set<T>, Set<T>, Set<T>];
}

/**
 * Whether an incoming listbox `valueChange` is pure aria reconciliation: it
 * (a) adds no value that is not already committed and (b) only removes values
 * whose option is currently not rendered (`visible`). An emit that exactly
 * restates the committed selection is reconciliation too.
 */
export function isReconciliationEmit<T>(
  incoming: readonly T[],
  committed: readonly T[],
  visible: readonly T[],
  compare: (a: T, b: T) => boolean,
): boolean {
  const sets = identitySets(incoming, committed, visible, compare);
  if (sets) {
    const [incomingSet, committedSet, visibleSet] = sets;

    // (a) No additions relative to the committed selection.
    if (incoming.some((v) => !committedSet.has(v))) return false;

    // (b) Every removed value is currently filtered out of view. `filter(p)`
    // followed by `every(q)` is `every(!p || q)`; both predicates are pure, so
    // the short circuit changes nothing but the work done.
    return committed.every((v) => incomingSet.has(v) || !visibleSet.has(v));
  }

  const inArr = (arr: readonly T[], v: T) => arr.some((x) => compare(x, v));

  // (a) No additions relative to the committed selection.
  if (incoming.some((v) => !inArr(committed, v))) return false;

  // (b) Every removed value is currently filtered out of view.
  return committed
    .filter((v) => !inArr(incoming, v))
    .every((v) => !inArr(visible, v));
}

/**
 * Committed values that aria dropped only because their option is not
 * rendered (not in `visible`) and that are not in `incoming`. Re-add them to
 * a genuine multi-select pick so earlier selections survive filtering.
 *
 * The result is in `committed` order — it is spread straight after the
 * incoming values by the calling control, so order is observable.
 */
export function filteredOutCommitted<T>(
  incoming: readonly T[],
  committed: readonly T[],
  visible: readonly T[],
  compare: (a: T, b: T) => boolean,
): T[] {
  const sets = identitySets(incoming, committed, visible, compare);
  if (sets) {
    // `committed`'s own set is unused, but scanning it for the hazard is not
    // optional — see `identitySets`. Filtering `committed` keeps its order.
    const [incomingSet, , visibleSet] = sets;
    return committed.filter((v) => !incomingSet.has(v) && !visibleSet.has(v));
  }

  return committed.filter(
    (v) =>
      !incoming.some((iv) => compare(iv, v)) &&
      !visible.some((vv) => compare(vv, v)),
  );
}

/**
 * A membership / resolution index over a fixed array of values — built at most
 * once, queried many times. Produced by {@link valueIndex}.
 *
 * Both methods are defined by the pairwise scan they replace, so an index is
 * observationally indistinguishable from one:
 */
export interface MlvValueIndex<T> {
  /** `source.some((item) => compare(project(item), value))`. */
  has(value: T): boolean;
  /** `source.find((item) => compare(project(item), value))?.projected ?? value`. */
  resolve(value: T): T;
}

/**
 * Indexes a source array for repeated "does this match one of them?" queries
 * under `compare`, replacing the O(queries × source) nested scan an option
 * control would otherwise run every time its option list grows.
 *
 * Strategy is chosen up front, from `compare` alone (see {@link hazardOf}):
 *
 * - A recognised identity comparator (`defaultCompareWith` / `Object.is`) → a
 *   `Map` keyed by the projected values; every query is O(1). If a projected
 *   value turns out to be a hazard, the whole index reverts to the pairwise
 *   scan.
 * - A caller-supplied `compareWith` → the pairwise scan, unchanged, per query.
 *
 * **The walk is progressive.** Nothing is read until the first query, and a
 * query stops the walk at the first match — exactly where `find`/`some` would
 * have stopped. Values passed on the way are materialised into a `Map` as the
 * cursor advances, so a later query that lands inside the built prefix is
 * O(1), one that lands beyond it resumes from the cursor, and every element is
 * ever read at most once. The consequences worth knowing:
 *
 * - No query, no work. A control with nothing committed still asks for the
 *   index on every option-list change and pays nothing.
 * - A match near the head costs about what the scan it replaces cost, instead
 *   of a full build — `Map` insertion is ~29× dearer per element than one
 *   `===` step, so a full build is not something to pay speculatively.
 * - Repeated queries share the walk, which is the quadratic case this exists
 *   for: a growing option list re-checked against a whole selection is O(V)
 *   per list change rather than O(R × V).
 *
 * The one case it loses: queries that all *miss* force the walk to the end, so
 * the whole source is materialised where the pairwise scan would merely have
 * read it. The crossover is **somewhere around 6–29 all-miss queries** and the
 * index wins above it. That is a range rather than a constant on purpose: the
 * pairwise arm is a monomorphic `===` in a hot callback, so its per-element
 * cost drops several-fold once V8 re-tiers it — measured on the controls'
 * shape it re-tiers partway through the sweep, putting the crossover near 6
 * against a cold callback and near 29 against a warmed one, the latter
 * agreeing with the ~29× per-element ratio above. Do not size a future change
 * against one end of that range without re-measuring at the tier you care
 * about. Either way this is the transient state where a control's committed
 * values have not been paged in yet, and the loss is bounded by one walk of
 * the source.
 *
 * This is why the source is taken with an optional `project` rather than a
 * pre-mapped array: mapping at the call site would walk the whole list eagerly
 * on every rebuild, which is exactly the cost being avoided.
 *
 * A hazard **in the source** is latched, not skipped: the moment the walk
 * passes one, the index reverts to the pairwise scan permanently, for every
 * subsequent query, and stops consulting the prefix. All-or-nothing is what
 * makes the semantics provable — a `Map` hit is sound only because the built
 * prefix is hazard-free, and answers already returned from that prefix were
 * correct when they were returned.
 *
 * A hazard on the **querying** side is handled per query rather than by
 * disqualifying the whole index: `Map` membership would conflate a queried
 * `-0` with a keyed `+0` under `Object.is`, so such a query falls back to the
 * pairwise scan for that one value — without forcing the map to be built. The
 * index stays fast for every other query, and the answer is the pairwise
 * answer either way.
 *
 * @param source The haystack. Held by reference and copied into the map only as
 *   far as the walk has reached — do not mutate it afterwards.
 * @param compare The owning control's `compareWith`.
 * @param project Second overload only. Reads the comparable value out of a
 *   source item; the first overload's source already holds the values.
 */
export function valueIndex<T>(
  source: readonly T[],
  compare: (a: T, b: T) => boolean,
): MlvValueIndex<T>;
export function valueIndex<S, T>(
  source: readonly S[],
  compare: (a: T, b: T) => boolean,
  project: (item: S) => T,
): MlvValueIndex<T>;
export function valueIndex<S, T>(
  source: readonly S[],
  compare: (a: T, b: T) => boolean,
  project?: (item: S) => T,
): MlvValueIndex<T> {
  // Without `project` the source already holds the values: `S` and `T` are the
  // same type, which only the overloads above can express.
  const projected: (item: S) => T = project ?? ((item) => item as unknown as T);

  const someMatch = (value: T): boolean =>
    source.some((item) => compare(projected(item), value));
  const findMatch = (value: T): T => {
    const found = source.find((item) => compare(projected(item), value));
    // Reproduces `find(...)?.value ?? value`: a miss and a nullish match both
    // fall through to the queried value.
    return found === undefined ? value : (projected(found) ?? value);
  };

  const isHazard = hazardOf(compare);
  if (!isHazard) return { has: someMatch, resolve: findMatch };

  /** Projected values from `source[0 .. cursor)`, first occurrence winning. */
  const seen = new Map<T, T>();
  /** How far the walk has got. Everything before it is in `seen`. */
  let cursor = 0;
  /** Latched when the walk passes a hazard; the index is pairwise from then on. */
  let bailed = false;

  /**
   * Resumes the left-to-right walk, materialising each value as it passes,
   * and stops at the first match — exactly where `find`/`some` would stop.
   *
   * Returns the match boxed (the matched value may legitimately be nullish),
   * or `undefined` for "no match in the whole source" — or for "bailed", which
   * the callers tell apart by re-reading {@link bailed}.
   */
  const walkTo = (value: T): { readonly hit: T } | undefined => {
    while (cursor < source.length) {
      const candidate = projected(source[cursor]);
      // Latch *before* consuming the element: a hazard anywhere in the source
      // makes SameValueZero and `compare` disagree, so no keyed answer past
      // this point can be trusted. Answers already returned from the
      // hazard-free prefix were correct when they were returned.
      if (isHazard(candidate)) {
        bailed = true;
        return undefined;
      }
      cursor++;
      // First occurrence wins, because the walk is left-to-right and `resolve`
      // is specified as `Array.prototype.find`. The `has` guard is
      // load-bearing: `Map.set` on an existing SameValueZero key replaces the
      // **value** while keeping the original key, so an unguarded `set` would
      // be observably last-wins for `+0`/`-0`.
      if (!seen.has(candidate)) seen.set(candidate, candidate);
      // `compare(indexed, queried)`, matching the pairwise scans above. Both
      // comparators that reach here are symmetric, so transposing this would
      // not be observable *today* — it is written in the correct order anyway,
      // because the day a third, asymmetric comparator is recognised by
      // `hazardOf` the transpose becomes a silent wrong answer.
      if (compare(candidate, value)) return { hit: candidate };
    }
    return undefined;
  };

  return {
    has: (value) => {
      if (bailed || isHazard(value)) return someMatch(value);
      // A hit in the built prefix is sound because that prefix is hazard-free
      // by construction, and on hazard-free values SameValueZero and `compare`
      // coincide. It is also the *first* match, whatever the cursor has since
      // reached.
      if (seen.has(value)) return true;
      const found = walkTo(value);
      if (bailed) return someMatch(value);
      return found !== undefined;
    },
    resolve: (value) => {
      if (bailed || isHazard(value)) return findMatch(value);
      if (seen.has(value)) return seen.get(value) ?? value;
      const found = walkTo(value);
      if (bailed) return findMatch(value);
      return found === undefined ? value : (found.hit ?? value);
    },
  };
}
