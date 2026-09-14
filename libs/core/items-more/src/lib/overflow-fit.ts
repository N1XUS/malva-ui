/**
 * Tolerance, in px, added to every fit comparison.
 *
 * Widths come from `getBoundingClientRect()`, which is fractional, while the
 * available width is the row's own fractional content box; a row whose items
 * sum to exactly its width can still compare as `1e-13` over. The tolerance
 * is applied on the *keeping* side of every comparison, so the rounding error
 * it absorbs can only ever leave an item visible — never withhold one that
 * fits, which is the property this module exists to hold.
 */
export const MLV_FIT_EPSILON_PX = 0.5;

/** One item's contribution to the fit calculation. */
export interface MlvOverflowCandidate {
  /** Natural width of the item's in-row box, in px. */
  readonly width: number;
  /** Whether the item may be withheld at all. */
  readonly collapsible: boolean;
}

/** Everything {@link computeHiddenFlags} needs, and nothing from the DOM. */
export interface MlvOverflowFit {
  readonly candidates: readonly MlvOverflowCandidate[];
  /** Content width of the row, in px. */
  readonly available: number;
  /** The row's resolved `column-gap`, in px. */
  readonly gap: number;
  /**
   * Width the overflow trigger occupies **in the row**, in px. Zero when the
   * trigger lives outside the row — a consumer-placed `[mlvItemsMoreTrigger]`
   * consumes none of the row's width, so reserving for it would withhold an
   * item that fits.
   */
  readonly triggerWidth: number;
}

/** Width of `count` boxes totalling `sum`, laid out with `gap` between them. */
function laidOut(sum: number, count: number, gap: number): number {
  return count === 0 ? 0 : sum + (count - 1) * gap;
}

/**
 * Decides which items are withheld from the row, as a flag per candidate in
 * declaration order.
 *
 * Pure and exact: the answer is a function of the widths alone, with no
 * memory of the previous split. That is what makes "no false-positive hides"
 * a checkable property rather than a tendency — at the moment a split is
 * committed, every withheld item provably does not fit.
 *
 * 1. **Only arithmetic withholds.** An item goes only when the sum says it
 *    does not fit, with {@link MLV_FIT_EPSILON_PX} of slack in its favour.
 *    Callers hold up the other half: they must not call with a width they
 *    have not measured. There is no default width here and no fallback for
 *    the trigger, because a guessed width is exactly how an item that fits
 *    gets withheld.
 *
 * 2. **The withheld items are a suffix of the collapsible ones.** The walk
 *    stops at the first collapsible item that does not fit rather than
 *    skipping it, so the row never develops a hole. Pinned items are kept
 *    wherever they sit and their width is reserved before the walk starts,
 *    which is what lets a pinned control at the end of the row coexist with
 *    collapsible ones before it.
 *
 * 3. **The gap is part of the arithmetic**, not an approximation: a row of
 *    eight items at a 0.5rem gap spends 56px on gaps, which is a whole button.
 */
export function computeHiddenFlags(fit: MlvOverflowFit): boolean[] {
  const { candidates, available, gap, triggerWidth } = fit;
  const hidden = candidates.map(() => false);
  if (candidates.length === 0) return hidden;

  const totalWidth = candidates.reduce((sum, c) => sum + c.width, 0);
  if (
    laidOut(totalWidth, candidates.length, gap) <=
    available + MLV_FIT_EPSILON_PX
  ) {
    // Everything fits with no trigger in the row. Measured *without* the
    // trigger's width: the trigger only exists because something is withheld,
    // so reserving for it here would be reserving for a control this very
    // branch proves is not needed.
    return hidden;
  }

  // Something has to go, so the in-row trigger — if there is one — is going
  // to render, and it takes a box and a gap with it.
  const budget =
    available -
    (triggerWidth > 0 ? triggerWidth + gap : 0) +
    MLV_FIT_EPSILON_PX;

  let keptSum = 0;
  let keptCount = 0;
  for (const candidate of candidates) {
    if (!candidate.collapsible) {
      keptSum += candidate.width;
      keptCount++;
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate.collapsible) continue;

    if (laidOut(keptSum + candidate.width, keptCount + 1, gap) <= budget) {
      keptSum += candidate.width;
      keptCount++;
      continue;
    }

    // The first collapsible item that does not fit ends the visible run;
    // everything collapsible after it goes too, so the row keeps a
    // contiguous prefix instead of a set with a hole in it.
    for (let j = i; j < candidates.length; j++) {
      if (candidates[j].collapsible) hidden[j] = true;
    }
    break;
  }

  return hidden;
}
