import type { MlvOverflowFit } from './overflow-types';

/**
 * @internal Tolerance, in px, added to every fit comparison.
 *
 * Widths come from `getBoundingClientRect()`, which is fractional, while the
 * available width is the row's own fractional content box; a row whose items
 * sum to exactly its width can still compare as `1e-13` over. The tolerance
 * is applied on the *keeping* side of every comparison, so the rounding error
 * it absorbs can only ever leave an item visible — never withhold one that
 * fits, which is the property this module exists to hold.
 *
 * Exported only so the core overflow rows (`mlv-items-more`,
 * `mlv-tab-group`) can reach it; not consumer API.
 */
export const MLV_FIT_EPSILON_PX = 0.5;

/** Width of `count` boxes totalling `sum`, laid out with `gap` between them. */
function laidOut(sum: number, count: number, gap: number): number {
  return count === 0 ? 0 : sum + (count - 1) * gap;
}

/**
 * @internal Decides which items are withheld from the row, as a flag per
 * candidate in declaration order. The shared split of every Malva overflow
 * row — `mlv-items-more` and `mlv-tab-group` — exported only so those core
 * leaves can reach it; not consumer API.
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
export function mlvComputeHiddenFlags(fit: MlvOverflowFit): boolean[] {
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

/**
 * @internal A CSS length as px. `column-gap: normal` and an unresolved length
 * both parse to `NaN`; the used value of both is zero.
 */
export function mlvCssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * @internal The inline content size of a box whose border-box inline size is
 * `borderBoxWidth`: that width less the inline padding and border in `styles`.
 *
 * A split has to compare against the room *inside* the row — what the items
 * are laid out in — not against `clientWidth`, which still includes the
 * padding and is rounded to an integer: a boxed tab track with 0.1875rem of
 * padding either side reported 6px of room nothing could use.
 */
export function mlvInlineContentSize(
  borderBoxWidth: number,
  styles: CSSStyleDeclaration,
): number {
  return (
    borderBoxWidth -
    mlvCssPx(styles.paddingInlineStart) -
    mlvCssPx(styles.paddingInlineEnd) -
    mlvCssPx(styles.borderInlineStartWidth) -
    mlvCssPx(styles.borderInlineEndWidth)
  );
}
