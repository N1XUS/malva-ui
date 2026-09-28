/*
 * Shapes shared by the overflow primitives in this directory.
 *
 * Deliberately **not** re-exported from the `@malva-ui/cdk/utils` barrel:
 * `docs:extract-api` publishes every class, interface and type alias it finds
 * there, `@internal` tag or not (it filters `@internal` on class members
 * only — see `libs-utils.md`), and none of these is consumer API. The exported
 * functions that use them carry them in their emitted declarations; callers
 * outside this directory (`mlv-items-more`, `mlv-tab-group`) describe their
 * candidates structurally and let the guard's type be inferred.
 */

/** @internal One item's contribution to the fit calculation. */
export interface MlvOverflowCandidate {
  /** Natural width of the item's in-row box, in px. */
  readonly width: number;
  /** Whether the item may be withheld at all. */
  readonly collapsible: boolean;
}

/**
 * @internal Everything `mlvComputeHiddenFlags` needs, and nothing from the
 * DOM.
 */
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

/** @internal The oscillation guard `mlvOverflowRevealGuard` returns. */
export interface MlvOverflowRevealGuard {
  /**
   * Whether a split withholding `hiddenCount` items, computed against
   * `available` px while `currentHiddenCount` are withheld, may be committed.
   * Records the reveal or hide it describes when it may; a caller that is
   * told yes must commit.
   *
   * A hide is always admitted. A reveal is admitted unless the same reveal,
   * at this width or narrower, has already undone itself.
   */
  admit(
    hiddenCount: number,
    currentHiddenCount: number,
    available: number,
  ): boolean;

  /**
   * Forgets everything learned. For a row whose item widths were invalidated
   * wholesale — what the guard learned was about the old widths.
   */
  reset(): void;
}
