/**
 * @internal What the size arithmetic reads from a panel. `MlvSplitPanePanel`
 * satisfies it; the functions below never touch the DOM.
 */
interface MlvSplitPaneSizedPanel {
  /** The panel's own initial size (%), or `undefined` for an equal share. */
  size(): number | undefined;
  /** The size (%) a resize may not take the panel below. */
  minSize(): number;
}

/**
 * @internal Sizes for a panel list laid out from scratch: a panel with a
 * `size` keeps it, and the panels without one share what is left equally.
 */
export function mlvInitialSplitPaneSizes(
  panels: readonly MlvSplitPaneSizedPanel[],
): number[] {
  const explicit = panels.map((panel) => panel.size());
  const fixedTotal = explicit.reduce<number>((sum, s) => sum + (s ?? 0), 0);
  const autoCount = explicit.filter((s) => s === undefined).length;
  const autoSize = autoCount > 0 ? (100 - fixedTotal) / autoCount : 0;
  return explicit.map((s) => s ?? autoSize);
}

/**
 * @internal Carries panel sizes across a change to the panel list, so a panel
 * that survives it keeps the size the user dragged it to. Panels are matched
 * by instance, never by index: a panel inserted before another does not hand
 * it the size of whatever used to sit at its position.
 *
 * - **Removed panel** — its size goes to the nearest surviving panel before it
 *   in `previous`, else the nearest one after it. Every other panel keeps its
 *   size, so closing a panel moves only its neighbour's edge.
 * - **Added panel** — it asks for its own `size`, else an equal share (the
 *   current total over the new panel count), and takes it from the surviving
 *   panels nearest first — those before it in `next`, then those after it —
 *   none below its `minSize`. When they cannot give it all, it gets what they
 *   gave — the donors' floors win over its own, so it can end below its own
 *   `minSize`, at `0` when every donor is at its floor. Donors and heirs are
 *   searched in the same order, so removing a panel and adding it back with
 *   the same `size` restores the layout exactly.
 * - **Nothing survives**, or `previous` was not laid out (fewer than two
 *   panels) — the list is laid out from scratch by
 *   {@link mlvInitialSplitPaneSizes}.
 *
 * The total is preserved, so sizes that summed to 100 still do.
 *
 * @param previous — The panels `previousSizes` belongs to, in order.
 * @param previousSizes — Their sizes (%), index for index.
 * @param next — The new panel list, in order.
 * @returns The sizes of `next`, index for index.
 */
export function mlvCarrySplitPaneSizes<P extends MlvSplitPaneSizedPanel>(
  previous: readonly P[],
  previousSizes: readonly number[],
  next: readonly P[],
): number[] {
  const carried = new Map<P, number>();
  if (previous.length >= 2) {
    const survivors = new Set(next);
    previous.forEach((panel, i) => {
      if (survivors.has(panel)) carried.set(panel, previousSizes[i] ?? 0);
    });
  }
  if (carried.size === 0) return mlvInitialSplitPaneSizes(next);

  // Removed panels: the nearest survivor before, else after, inherits.
  previous.forEach((panel, i) => {
    if (carried.has(panel)) return;
    const heir = nearest(previous, i, (candidate) => carried.has(candidate));
    if (heir) {
      carried.set(heir, (carried.get(heir) ?? 0) + (previousSizes[i] ?? 0));
    }
  });

  const survivors = new Set(carried.keys());
  const total = [...carried.values()].reduce((sum, s) => sum + s, 0);

  // Added panels: take the size from the survivors, nearest first.
  next.forEach((panel, k) => {
    if (survivors.has(panel)) return;
    let wanted = Math.max(0, panel.size() ?? total / next.length);
    let given = 0;
    for (const donor of outward(next, k, (c) => survivors.has(c))) {
      if (wanted <= 0) break;
      const current = carried.get(donor) ?? 0;
      const take = Math.min(Math.max(0, current - donor.minSize()), wanted);
      carried.set(donor, current - take);
      wanted -= take;
      given += take;
    }
    carried.set(panel, given);
  });

  return next.map((panel) => carried.get(panel) ?? 0);
}

/**
 * @private The entries of `list` matching `accept`, ordered outward from
 * index `from`: those before it nearest first, then those after it nearest
 * first. `from` itself is skipped.
 */
function outward<T>(
  list: readonly T[],
  from: number,
  accept: (item: T) => boolean,
): T[] {
  const before = list.slice(0, from).reverse();
  const after = list.slice(from + 1);
  return [...before, ...after].filter(accept);
}

/** @private The first entry {@link outward} yields, or `undefined`. */
function nearest<T>(
  list: readonly T[],
  from: number,
  accept: (item: T) => boolean,
): T | undefined {
  return outward(list, from, accept)[0];
}
