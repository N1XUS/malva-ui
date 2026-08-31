import { computed, Directive, input } from '@angular/core';
import { MlvPageSnapRegionBase } from './page-snap-region-base';

/** How an element behaves while the page chrome snaps. */
export type MlvPageSnapMode = 'hide' | 'fade' | 'keep';

/**
 * Lets any element inside `main[mlvPage]` define its own state on the snap
 * timeline. The element reads the page-level `--mlv-page-snap` progress,
 * remaps it into its own stagger window (`snapFrom`..`snapTo`), and applies
 * the chosen behaviour with pure CSS `calc()` interpolation — so the motion
 * is scrubbed by scrolling, not played on a clock.
 *
 * A fully elapsed region is `visibility: hidden` and therefore leaves the
 * accessibility tree and the tab order — except while it holds focus, when it
 * reveals itself instead (`mlv-page-snap--revealed`) so that scrolling can
 * never blur a focused control into `<body>`. See {@link MlvPageSnapRegionBase}.
 *
 * ```html
 * <div mlvPageSnap="hide" [snapFrom]="0.2" [snapTo]="0.7" snapSize="3rem">…</div>
 * ```
 */
@Directive({
  selector: '[mlvPageSnap]',
  host: {
    '[class.mlv-page-snap--hide]': '_mode() === "hide"',
    '[class.mlv-page-snap--fade]': '_mode() === "fade"',
    '[class.mlv-page-snap--revealed]': '_revealed()',
    '[style.--mlv-snap-from]': 'snapFrom()',
    '[style.--mlv-snap-scale]': '_scale()',
    '[style.--mlv-snap-size]': 'snapSize()',
    '[style.visibility]': '_hidden() ? "hidden" : null',
    '(focusin)': '_onRegionFocusIn()',
    '(focusout)': '_onRegionFocusOut($event)',
  },
})
export class MlvPageSnap extends MlvPageSnapRegionBase {
  /** Behaviour on the snap timeline. An empty attribute value means `hide`. */
  readonly mlvPageSnap = input<MlvPageSnapMode | ''>('');

  /** Progress at which this element starts reacting (0..1). */
  readonly snapFrom = input(0);

  /** Progress at which this element reaches its final state (0..1). */
  readonly snapTo = input(1);

  /**
   * Nominal expanded size used by the `hide` behaviour's height scrub.
   * Must be at least the element's natural height.
   */
  readonly snapSize = input('3rem');

  /** @protected Effective behaviour; the bare attribute defaults to `hide`. */
  protected readonly _mode = computed(() => this.mlvPageSnap() || 'hide');

  /** @protected Multiplier remapping page progress into the stagger window. */
  protected readonly _scale = computed(
    () => 1 / Math.max(this.snapTo() - this.snapFrom(), 0.001),
  );

  /**
   * @protected Fully elapsed once the page progress passes this element's
   * `snapTo`; a `keep` element never elapses.
   */
  protected readonly _elapsed = computed(
    () =>
      this._mode() !== 'keep' &&
      (this._snapController?.progress() ?? 0) >= Math.min(this.snapTo(), 1),
  );
}
