import { MLV_FIT_EPSILON_PX } from './overflow-fit';
import type { MlvOverflowRevealGuard } from './overflow-types';

/** A reveal, remembered long enough to notice that its own render undid it. */
interface MlvOverflowReveal {
  /** `Date.now()` when the reveal was committed. */
  readonly at: number;
  /** Row width the reveal was computed against. */
  readonly available: number;
  /** How many items were still withheld after it. */
  readonly hiddenCount: number;
}

/**
 * @internal Creates the oscillation guard every Malva overflow row commits its
 * split through, in place of a hysteresis band. Exported only so the core
 * overflow rows (`mlv-items-more`, `mlv-tab-group`) can reach it; not
 * consumer API. A factory rather than a class so that nothing the docs API
 * extractor publishes enters the barrel (see `overflow-types.ts`).
 *
 * The failure it answers is a feedback loop outside the row: returning an
 * item makes the row taller, a page scrollbar appears, the row narrows, the
 * item no longer fits, the scrollbar goes, and round again — forever, a
 * flicker per frame. Arithmetic alone cannot see it, because at the width it
 * is computed against the item really does fit; it is the reveal's own
 * render that changes the width.
 *
 * So the guard records what was learned — "revealing down to `hiddenCount`
 * at `available` px or less makes it not fit" — and refuses to commit that
 * reveal again until the row is wider than it was. It is not a band: nothing
 * is held back that has not already been shown, by an actual render, not to
 * fit.
 *
 * @param windowMs How soon (ms) after a reveal a hide must follow for the
 * pair to count as the reveal undoing itself.
 */
export function mlvOverflowRevealGuard(
  windowMs: number,
): MlvOverflowRevealGuard {
  /** The most recent reveal, while it may still undo itself. */
  let lastReveal: MlvOverflowReveal | null = null;

  /** A reveal that undid itself, and so may not be repeated. */
  let refused: Pick<MlvOverflowReveal, 'available' | 'hiddenCount'> | null =
    null;

  return {
    admit(hiddenCount, currentHiddenCount, available) {
      // The row has grown past the width that failed: whatever was learned
      // there says nothing about this width.
      if (refused && available > refused.available + MLV_FIT_EPSILON_PX) {
        refused = null;
      }

      if (hiddenCount < currentHiddenCount) {
        if (refused && hiddenCount <= refused.hiddenCount) return false;
        lastReveal = { at: Date.now(), available, hiddenCount };
      } else if (hiddenCount > currentHiddenCount) {
        if (lastReveal && Date.now() - lastReveal.at <= windowMs) {
          refused = {
            available: lastReveal.available,
            hiddenCount: lastReveal.hiddenCount,
          };
        }
        lastReveal = null;
      }
      return true;
    },

    reset() {
      lastReveal = null;
      refused = null;
    },
  };
}
