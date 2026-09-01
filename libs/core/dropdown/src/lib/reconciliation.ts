/**
 * `@angular/aria`'s `ngListbox` reconciles its `value` model against the
 * currently **rendered** options and re-emits `valueChange` whenever the
 * rendered set changes — not only on user interaction. These helpers let an
 * owning control tell that noise apart from a genuine selection.
 */

/**
 * The default value-equality predicate behind every option control's
 * `compareWith` input (`mlv-select`, `mlv-combobox`). Plain reference (`===`)
 * equality.
 *
 * Behaviourally identical to the per-instance inline arrow it replaces — it
 * exists as a single module-level reference so {@link isReconciliationEmit}
 * and {@link filteredOutCommitted} can *recognise* it and swap their nested
 * linear scans for O(n + m) `Set` membership. A control that leaves
 * `compareWith` unset therefore gets the fast path automatically; one that
 * supplies its own comparator keeps the pairwise path unchanged.
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
 * @internal Builds one SameValueZero `Set` per input array — `[incoming,
 * committed, visible]` — or returns `null` when the `Set` fast path would not
 * be exactly equivalent to `compare`.
 *
 * `Set` membership is SameValueZero, which agrees with *neither* identity
 * comparator in general:
 *
 * |                       | `NaN` vs `NaN` | `+0` vs `-0` |
 * | --------------------- | -------------- | ------------ |
 * | `===`                 | not equal      | equal        |
 * | `Object.is`           | equal          | not equal    |
 * | SameValueZero (`Set`) | equal          | equal        |
 *
 * `===` and SameValueZero differ on exactly one pair of values, `(NaN, NaN)`.
 * `Object.is` and SameValueZero differ on exactly two, `(+0, -0)` and
 * `(-0, +0)`. So if the relevant hazard value — `NaN` for `===`, `-0` for
 * `Object.is` — is absent from *every* input array, no differing pair can be
 * formed from the values actually present and the two relations coincide on
 * them; a `Set` is then an exact substitute for the pairwise scan.
 *
 * All three arrays are scanned even when a caller only consumes two of the
 * sets: for `Object.is`, a `-0` on the *querying* side is just as hazardous as
 * one inside the set (`+0` in the set, `-0` queried — SameValueZero says
 * present, `Object.is` says absent).
 *
 * A caller-supplied comparator returns `null` immediately, so it pays for no
 * scan at all.
 */
function identitySets<T>(
  incoming: readonly T[],
  committed: readonly T[],
  visible: readonly T[],
  compare: (a: T, b: T) => boolean,
): [Set<T>, Set<T>, Set<T>] | null {
  let isHazard: (value: unknown) => boolean;
  if ((compare as unknown) === (defaultCompareWith as unknown)) {
    isHazard = isNaNValue;
  } else if ((compare as unknown) === (Object.is as unknown)) {
    isHazard = isNegativeZero;
  } else {
    return null;
  }

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
