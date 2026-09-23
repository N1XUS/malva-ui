import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  InjectionToken,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { fromEvent } from 'rxjs';
import { MlvPageSnapRegionBase } from './page-snap-region-base';

/** How an element behaves while the page chrome snaps. */
export type MlvPageSnapMode = 'hide' | 'fade' | 'keep';

/** A region's own stagger window on the 0..1 snap timeline. */
export interface MlvPageSnapWindow {
  /** Progress at which the region's content starts fading. */
  readonly from: number;
  /** Progress at which the region's content has fully faded. */
  readonly to: number;
}

/**
 * Lets a region declare the stagger window its host `MlvPageSnap` defaults to.
 *
 * A region that composes `MlvPageSnap` through `hostDirectives` cannot bind
 * that directive's inputs — nothing stands between the two to write them — and
 * a window is exactly the kind of default a region should own rather than the
 * page header growing one input per region to declare it. Providing this token
 * on the region moves the default down to the region; a consumer's own
 * `[snapFrom]` / `[snapTo]` still wins, because these are only the inputs'
 * initial values.
 */
export const MLV_PAGE_SNAP_WINDOW = new InjectionToken<MlvPageSnapWindow>(
  'MLV_PAGE_SNAP_WINDOW',
);

/**
 * Lets any element inside `main[mlvPage]` define its own state on the snap
 * timeline.
 *
 * Two things are scrubbed, and they are deliberately driven by **different**
 * progress values:
 *
 * - **Block size** follows the page progress directly. Every collapsing region
 *   gives up its height over the same 0..1 span, which is what lets the page
 *   compensate for the lost height in one exact CSS expression instead of
 *   summing per-region contributions it cannot express.
 * - **Opacity and drift** follow `snapFrom`..`snapTo`, this element's own
 *   window on that timeline. Staggering the *content* is what makes a row read
 *   as sliding away under the chrome rather than being cut off, and it costs
 *   the compensation nothing.
 *
 * A region whose window has fully elapsed is `visibility: hidden` and therefore
 * leaves the accessibility tree and the tab order — at exactly the progress its
 * opacity reaches zero, so nothing is ever invisible and still announced. The
 * exception is a region holding focus, which reveals itself instead
 * (`mlv-page-snap--revealed`) so that scrolling can never blur a focused
 * control into `<body>`. See {@link MlvPageSnapRegionBase}.
 *
 * ```html
 * <div mlvPageSnap="hide" [snapFrom]="0.2" [snapTo]="0.7">…</div>
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
    '[style.--mlv-snap-size]': '_measuredSize()',
    '[style.visibility]': '_hidden() ? "hidden" : null',
    '(focusin)': '_onRegionFocusIn()',
    '(focusout)': '_onRegionFocusOut($event)',
  },
})
export class MlvPageSnap extends MlvPageSnapRegionBase {
  /**
   * @private Window this region declared for itself, when the directive is
   * composed onto one. Read before the two inputs are declared, because it
   * supplies their initial values.
   */
  private readonly _declaredWindow = inject(MLV_PAGE_SNAP_WINDOW, {
    optional: true,
  });

  /** Behaviour on the snap timeline. An empty attribute value means `hide`. */
  readonly mlvPageSnap = input<MlvPageSnapMode | ''>('');

  /** Progress at which this element's content starts fading (0..1). */
  readonly snapFrom = input(this._declaredWindow?.from ?? 0);

  /** Progress at which this element's content has fully faded (0..1). */
  readonly snapTo = input(this._declaredWindow?.to ?? 1);

  /** @protected Effective behaviour; the bare attribute defaults to `hide`. */
  protected readonly _mode = computed(() => this.mlvPageSnap() || 'hide');

  /** @protected Multiplier remapping page progress into the stagger window. */
  protected readonly _scale = computed(
    () => 1 / Math.max(this.snapTo() - this.snapFrom(), 0.001),
  );

  /**
   * @protected Fully elapsed once the page progress passes this element's
   * `snapTo`; a `keep` element never elapses. That is the same point its
   * opacity reaches zero — visual and semantic disappearance are one event,
   * not a window where the content is invisible and still in the tab order.
   */
  protected readonly _elapsed = computed(
    () =>
      this._mode() !== 'keep' &&
      (this._snapController?.progress() ?? 0) >= Math.min(this.snapTo(), 1),
  );

  /**
   * @protected Natural block size of the element's content, measured rather
   * than declared. `scrollHeight` and not `offsetHeight`, because the host's
   * own `max-block-size` is what the scrub animates: the clamped border box
   * shrinks to nothing while the content box it overflows keeps reporting the
   * height the row would take if it were open.
   *
   * Measuring the box it clamps is also why a `ResizeObserver` on the host
   * cannot be the only trigger: while the clamp holds, content that grows
   * leaves the host's box exactly where it was, so the observer has nothing
   * to report and the row stays cut off at the size it measured last — or
   * invisible, when it first rendered empty. The clamp therefore lifts at
   * rest (see `.mlv-page-snap--hide` in `page.scss`), and while the timeline
   * is scrubbing the content itself is watched: DOM changes inside the host
   * and web-font swaps re-measure it directly.
   */
  protected readonly _measuredBlockSize = signal(0);

  /**
   * @protected The measurement as a CSS length. Every geometry property this
   * package publishes is a pixel string: a bare number is not a length, so a
   * consumer could not override it with one.
   */
  protected readonly _measuredSize = computed(
    () => `${this._measuredBlockSize()}px`,
  );

  /** @protected Only a `hide` region gives up block size on the timeline. */
  protected readonly _collapsibleBlockSize = computed(() =>
    this._mode() === 'hide' ? this._measuredBlockSize() : 0,
  );

  constructor() {
    super();
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const resizeObserver = inject(MlvResizeObserverService);
    // Typed as possibly absent: jsdom and older engines have no `FontFaceSet`.
    const fonts = inject(DOCUMENT).fonts as FontFaceSet | undefined;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const measure = (): void => {
        this._measuredBlockSize.set(host.scrollHeight);
      };
      measure();

      // Box changes: a rewrap at a new inline size, every scrub step (the
      // clamp moves) and — because the clamp lifts at rest — any change to
      // the content's size while the page sits at the top. Read inside the
      // observer callback, which the browser runs after layout, so this is a
      // cheap read of a value that is already current.
      resizeObserver
        .observe(host)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe(measure);

      // The two triggers below exist only because the `hide` clamp hides
      // content growth from the box observer. A `fade` or `keep` region is
      // never clamped, so that observer already sees every change to it and
      // keeps the measurement current — a later switch to `hide` starts from
      // the right number. Skipping them there saves a forced layout per batch
      // for a value nothing reads. The mode is read per call, not captured,
      // because `mlvPageSnap` is an input and can change.
      const measureClamped = (): void => {
        if (this._mode() === 'hide') measure();
      };

      // Content changes the clamp hides from that observer while the timeline
      // is scrubbing: text, an `@if`, a list growing. This read does force a
      // layout, but only once per batch of content changes, never per scroll
      // frame. `afterNextRender` only runs in a browser, where
      // `MutationObserver` always exists.
      const contentObserver = new MutationObserver(measureClamped);
      contentObserver.observe(host, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      destroyRef.onDestroy(() => contentObserver.disconnect());

      // A web font arriving rewraps the same text with nothing in the DOM
      // changing to say so.
      if (fonts) {
        fromEvent(fonts, 'loadingdone')
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(measureClamped);
      }
    });
  }
}
