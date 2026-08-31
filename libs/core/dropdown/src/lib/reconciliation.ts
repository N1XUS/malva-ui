/**
 * `@angular/aria`'s `ngListbox` reconciles its `value` model against the
 * currently **rendered** options and re-emits `valueChange` whenever the
 * rendered set changes — not only on user interaction. These helpers let an
 * owning control tell that noise apart from a genuine selection.
 */

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
 */
export function filteredOutCommitted<T>(
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
