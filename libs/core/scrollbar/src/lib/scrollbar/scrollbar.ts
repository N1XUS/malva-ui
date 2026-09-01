import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  NgZone,
  Renderer2,
  signal,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { fromEvent } from 'rxjs';
import { MLV_SCROLLBAR_I18N } from '@malva-ui/i18n';

/** Controls which scroll axes render a custom scrollbar. */
export type MlvScrollbarOrientation = 'vertical' | 'horizontal' | 'both';

/**
 * Measured geometry of one scrollbar track, along that track's scroll axis.
 *
 * Deliberately **not** exported: it is an internal caching detail of
 * `MlvScrollbar`, not part of the public API.
 *
 * Both fields are expensive to obtain — the padding costs a style
 * recalculation (`getComputedStyle`) and the extent costs a forced layout
 * (`offsetHeight` / `offsetWidth`) — while neither can change as a result of
 * scrolling, so they are cached between resizes instead of being re-read on
 * every scroll frame.
 */
interface TrackMetrics {
  /**
   * Track padding at each end of the scroll axis, in pixels — the resolved
   * `--mlv-sb-edge-padding` design token.
   */
  readonly paddingPx: number;

  /**
   * Track extent along the scroll axis with the padding at both ends removed,
   * in pixels. This is the span the thumb is laid out within.
   */
  readonly usablePx: number;
}

/**
 * Custom scrollbar component that hides the native browser scrollbar and
 * renders a minimalistic custom one in accordance with the Malva UI theme.
 *
 * Wrap any scrollable content in `<mlv-scrollbar>`. The component must have
 * a defined height (set via CSS or via flex/grid sizing from a parent).
 * Native scroll behaviour is **never intercepted** — the viewport scrolls
 * exactly as if the component were not present. The custom thumb is a pure
 * visual overlay that stays in sync with the viewport's scroll position.
 *
 * @example Vertical (default)
 * ```html
 * <mlv-scrollbar style="height: 12rem">
 *   <p>Long content…</p>
 * </mlv-scrollbar>
 * ```
 *
 * @example Horizontal
 * ```html
 * <mlv-scrollbar orientation="horizontal" style="width: 20rem">
 *   <div style="width: 60rem">Wide content…</div>
 * </mlv-scrollbar>
 * ```
 *
 * @example Both axes
 * ```html
 * <mlv-scrollbar orientation="both" style="height: 12rem; width: 20rem">
 *   <div style="height: 30rem; width: 60rem">…</div>
 * </mlv-scrollbar>
 * ```
 */
@Component({
  selector: 'mlv-scrollbar',
  templateUrl: './scrollbar.html',
  styleUrl: './scrollbar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-scrollbar',
    '[class.mlv-scrollbar--disabled]': 'disabled()',
    '[class.mlv-scrollbar--external]': '_hasExternalScroller()',
    '[class.mlv-scrollbar--dragging]': '_isDragging()',
    '[class.mlv-scrollbar--scrolling]': '_isScrolling()',
    '[style.--mlv-sb-size]': 'scrollbarSize()',
  },
})
export class MlvScrollbar {
  /**
   * Which scroll axes to show the custom scrollbar on.
   * Default: `'vertical'`.
   */
  readonly orientation = input<MlvScrollbarOrientation>('vertical');

  /**
   * CSS length value for the scrollbar track zone width (vertical) or height
   * (horizontal). Maps to the `--mlv-sb-size` custom property on the host.
   * The visible thumb is narrower due to the cross-axis inset (`--mlv-sb-inset`).
   * Default: `'0.75rem'` (12 px track zone → 4 px visible thumb after 4 px inset each side).
   */
  readonly scrollbarSize = input<string>('0.75rem');

  /**
   * When `true`, hides the custom scrollbar tracks and restores the browser's
   * native scrollbar. Supports attribute syntax: `<mlv-scrollbar disabled>`.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * External element whose scrolling this scrollbar decorates. When set, the
   * component's own viewport stops being a scroll box and only the tracks are
   * rendered, positioned over the host. Use it for a control that must remain
   * its own scroller — a `<textarea>`, for example, can never delegate
   * scrolling to an ancestor: it is an `overflow: auto` box sized by `rows`,
   * so it absorbs its own overflow and a wrapping viewport never overflows at
   * all (issue #90).
   *
   * The decorated element keeps every scrolling and accessibility semantic it
   * already has. In this mode the internal viewport emits **no** `tabindex`,
   * `role` or `aria-label`, whatever `viewportTabIndex` / `ariaLabel` say — a
   * second named, tabbable region wrapped around a control that already names
   * itself is an accessibility regression, not an addition.
   *
   * Hide the decorated element's native bar yourself (`scrollbar-width: none`
   * plus `::-webkit-scrollbar { display: none }`); the component does not
   * reach into an element it does not own.
   *
   * **Read once, at wiring time.** The scroll listener and the
   * `ResizeObserver` are attached from `afterNextRender`, so the value must be
   * available by the first render (a template reference variable is) and is
   * treated as fixed for the component's lifetime — exactly like the internal
   * `#viewport` it stands in for.
   *
   * @example
   * ```html
   * <mlv-scrollbar [scroller]="fieldEl">
   *   <textarea #fieldEl></textarea>
   * </mlv-scrollbar>
   * ```
   */
  readonly scroller = input<HTMLElement | ElementRef<HTMLElement> | null>(null);

  /**
   * Custom aria-label override for the scrollable viewport region.
   * Falls back to the i18n-provided label.
   * Override when the component wraps content with a more specific purpose,
   * e.g. `ariaLabel="Chat messages"`.
   *
   * The label is only written to the DOM while the viewport is itself a tab
   * stop — that is, while `viewportTabIndex` is `0`. A viewport that is not
   * keyboard-reachable is left as a plain container, because `aria-label` is
   * prohibited on a role-less element and naming a non-interactive wrapper
   * only adds noise.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Tab index written **verbatim** to the native scroll viewport.
   *
   * The component makes no decision of its own here — there is no auto mode
   * and no inspection of the projected content.
   *
   * - `null` (the default) emits **no `tabindex` attribute at all**. The
   *   viewport is left exactly as the browser renders a plain scroll
   *   container; keyboard reachability then falls to the browser's own
   *   scroller focusability (Chrome 127+, Firefox), which applies precisely
   *   when the scroller has no keyboard-focusable children.
   * - `0` makes the viewport a guaranteed tab stop, so a text-only region
   *   stays keyboard-scrollable in every browser (WCAG 2.1.1). It also gives
   *   the viewport `role="group"` and the resolved `aria-label`.
   * - `-1` makes the viewport programmatically focusable but not a tab stop —
   *   for composite widgets that own their keyboard model and scroll the
   *   viewport themselves.
   *
   * Positive values are excluded by the type: a positive tabindex is forbidden
   * by the project's accessibility rules.
   */
  readonly viewportTabIndex = input<-1 | 0 | null>(null);

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_SCROLLBAR_I18N, { optional: true });

  /** @protected Resolved aria-label: explicit input takes precedence over i18n default. */
  protected readonly _resolvedAriaLabel = computed(
    () =>
      this.ariaLabel() ??
      this._i18n?.().scrollableRegion ??
      'Scrollable region',
  );

  /**
   * @protected Whether an external element is being decorated rather than the
   * component's own viewport. Drives the `--external` modifier, which stops
   * the viewport from scrolling or clipping, and silences every semantic the
   * viewport would otherwise carry.
   */
  protected readonly _hasExternalScroller = computed(
    () => this.scroller() !== null,
  );

  /**
   * @protected The `tabindex` actually written to the viewport, or `null`.
   *
   * Passes `viewportTabIndex` through verbatim, except while an external
   * scroller is decorated: there the viewport is a bare layout wrapper around
   * an element that owns its own focus behaviour, and making the wrapper a tab
   * stop would put a second, meaningless stop in front of it.
   */
  protected readonly _viewportTabIndex = computed(() =>
    this._hasExternalScroller() ? null : this.viewportTabIndex(),
  );

  /**
   * @protected Whether the viewport is itself a tab stop.
   *
   * Only a viewport the user can land on is a control that has to introduce
   * and name itself (WCAG 4.1.2). `-1` and `null` are both "not a tab stop":
   * a `-1` viewport is only ever reached under a widget's own keyboard model,
   * which names itself. An external scroller is never a tab stop either — the
   * decorated element is the control.
   */
  protected readonly _isViewportFocusable = computed(
    () => this._viewportTabIndex() === 0,
  );

  /**
   * @protected ARIA role written to the viewport, or `null` for none.
   *
   * `aria-label` is prohibited on an element with no role (implicit
   * `generic`), so the label was previously discarded by assistive technology.
   * A focusable scroll container is exposed as `group` rather than the
   * landmark `region`, so that wrapping content in `mlv-scrollbar` never
   * injects a landmark — nor a repeated "Scrollable region" landmark name —
   * into the page. When the viewport is not a tab stop it stays role-less and
   * unnamed: the projected content owns its own semantics.
   */
  protected readonly _viewportRole = computed(() =>
    this._isViewportFocusable() ? 'group' : null,
  );

  /**
   * @protected The label actually written to the viewport, or `null`.
   *
   * Mirrors `_viewportRole` so the name is never emitted without a role that
   * permits it.
   */
  protected readonly _viewportAriaLabel = computed(() =>
    this._isViewportFocusable() ? this._resolvedAriaLabel() : null,
  );

  /** @protected Whether the vertical track should be rendered. */
  protected readonly _showVertical = computed(
    () =>
      !this.disabled() &&
      (this.orientation() === 'vertical' || this.orientation() === 'both'),
  );

  /** @protected Whether the horizontal track should be rendered. */
  protected readonly _showHorizontal = computed(
    () =>
      !this.disabled() &&
      (this.orientation() === 'horizontal' || this.orientation() === 'both'),
  );

  /** @protected True when scrollHeight > clientHeight (vertical overflow present). */
  protected readonly _hasVerticalOverflow = signal(false);

  /** @protected True when scrollWidth > clientWidth (horizontal overflow present). */
  protected readonly _hasHorizontalOverflow = signal(false);

  /** @protected Vertical thumb top offset in pixels (set as inline style). */
  protected readonly _thumbTop = signal(0);

  /** @protected Vertical thumb height in pixels (set as inline style). */
  protected readonly _thumbHeight = signal(0);

  /** @protected Horizontal thumb left offset in pixels (set as inline style). */
  protected readonly _thumbLeft = signal(0);

  /** @protected Horizontal thumb width in pixels (set as inline style). */
  protected readonly _thumbWidth = signal(0);

  /** @protected True while the user is actively dragging a thumb. Adds `--dragging` modifier. */
  protected readonly _isDragging = signal(false);

  /** @protected True while scroll events are firing. Cleared after 150 ms idle. Adds `--scrolling` modifier. */
  protected readonly _isScrolling = signal(false);

  /** @private Reference to the inner scrollable viewport element. */
  private readonly _viewport =
    viewChild.required<ElementRef<HTMLDivElement>>('viewport');

  /**
   * The element that actually scrolls: the decorated `scroller()` when one is
   * set, the component's own viewport otherwise.
   *
   * Lets wrapping components (e.g. `main[mlvPage]`, `mlv-chat`) observe scroll
   * position without reaching into the component's private DOM.
   *
   * It deliberately follows `scroller()` rather than always returning the
   * internal `<div>`. Every caller uses this as *the element that scrolls* —
   * to attach a `scroll` listener, to read `scrollTop`/`scrollHeight`, or to
   * write `scrollTop`. In external mode the internal viewport does none of
   * those things, so handing it back would reproduce issue #73: a listener on
   * a node that never receives the event, silently doing nothing.
   */
  get viewportElement(): HTMLElement {
    return this._scrollerElement();
  }

  /**
   * @private The single resolution point for "which element do I measure and
   * listen to".
   *
   * Every metric read in the component goes through this, so the external and
   * internal modes share one code path and cannot drift apart.
   *
   * The `nativeElement` probe is used instead of `instanceof ElementRef`
   * deliberately: this is a published library, and `instanceof` fails when the
   * consumer's `ElementRef` comes from a different `@angular/core` copy.
   */
  private _scrollerElement(): HTMLElement {
    const external = this.scroller();
    if (external) {
      return 'nativeElement' in external ? external.nativeElement : external;
    }
    return this._viewport().nativeElement;
  }

  /**
   * Recomputes overflow state and thumb geometry from the scroller's current
   * metrics. No-ops before the first render and on the server.
   *
   * Only needed in **external** mode (`scroller`), and only for content that
   * grows without resizing anything observable. A `<textarea>` is the case
   * this exists for: its border box does not change when a line of text is
   * added, and it has no child element to observe, so typing moves
   * `scrollHeight` with **no** `scroll` event and **no** `ResizeObserver`
   * callback — the track would keep describing the previous content, or never
   * appear at all.
   *
   * The alternative considered was Taiga UI's approach: a transparent mirror
   * of the value carrying `view-timeline`, whose own resize the observer can
   * see. It was rejected because it costs a second copy of the text in the
   * DOM, duplicated typography that must track every density/theme/font
   * change to stay honest, and a scroll-driven-animation dependency — to
   * report something the content's owner already knows for certain. An
   * explicit call from that owner carries no CSS and no duplication.
   *
   * The default (internal-viewport) mode never needs this: the content
   * wrapper is observed, so any content growth is reported already.
   */
  remeasure(): void {
    if (!this._rendered) return;
    this._updateGeometry();
  }

  /** @private Reference to the vertical track element. */
  private readonly _trackV =
    viewChild.required<ElementRef<HTMLDivElement>>('trackV');

  /** @private Reference to the horizontal track element. */
  private readonly _trackH =
    viewChild.required<ElementRef<HTMLDivElement>>('trackH');

  /** @private Minimum rendered thumb length in pixels — prevents thumb from becoming unclickable. */
  private readonly _minThumbSize = 32;

  /**
   * @private Cached vertical-track metrics, or `null` while the cache is dirty.
   * Populated lazily by `_trackMetrics('vertical')`, dropped by
   * `_invalidateTrackMetrics()`.
   */
  private _trackMetricsV: TrackMetrics | null = null;

  /**
   * @private Cached horizontal-track metrics, or `null` while the cache is
   * dirty. Populated lazily by `_trackMetrics('horizontal')`, dropped by
   * `_invalidateTrackMetrics()`.
   */
  private _trackMetricsH: TrackMetrics | null = null;

  /** @private Native ResizeObserver watching the scroller, viewport and content size. */
  private _resizeObserver: ResizeObserver | null = null;

  /**
   * @private Whether the first render has happened.
   *
   * `remeasure()` is public, so it can be called before the view exists and —
   * because `afterNextRender` never runs on the server — it doubles as the SSR
   * guard for the only DOM reads that are not already behind one.
   */
  private _rendered = false;

  /** @private Timeout ID for clearing the `--scrolling` modifier after idle. */
  private _scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  /** @private DestroyRef used to clean up the ResizeObserver, timers, and drag listeners. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Renderer2 used so DOM listeners are SSR-safe and unsubscribable. */
  private readonly _renderer = inject(Renderer2);

  /** @private Zone reference; the scroll listener is registered outside it. */
  private readonly _ngZone = inject(NgZone);

  constructor() {
    afterNextRender(() => {
      this._registerScrollListener();
      this._updateGeometry();
      // Set before the ResizeObserver guard below: `remeasure()` is exactly
      // what an environment *without* a ResizeObserver has to fall back on, so
      // gating it behind one would disable the only remaining update path.
      this._rendered = true;

      if (typeof ResizeObserver === 'undefined') {
        return;
      }

      const scrollerEl = this._scrollerElement();
      const viewportEl = this._viewport().nativeElement;
      const contentEl = viewportEl.firstElementChild;

      this._resizeObserver = new ResizeObserver(() => {
        this._updateGeometry();
      });

      // Observe the scroller to detect its own resize — in the default mode
      // this is the viewport, which fills the host, so it also catches a host
      // resize.
      this._resizeObserver.observe(scrollerEl);
      // In external mode the viewport is a separate element that still fills
      // the host, so it is what reports a host resize.
      if (viewportEl !== scrollerEl) {
        this._resizeObserver.observe(viewportEl);
      }
      // Observe the content wrapper to detect content size changes.
      if (contentEl) {
        this._resizeObserver.observe(contentEl);
      }
    });

    // Everything that relays the corner-avoidance rule in the stylesheet,
    // which shortens each track by one `--mlv-sb-size` along its own axis
    // while the *other* track is visible. None of it is observed by the
    // ResizeObserver — that watches the viewport and the content wrapper,
    // neither of which changes size for any of these — so the cache is
    // dropped here instead:
    //
    // - `scrollbarSize` is that width, so it scales the shortening itself.
    // - `_showVertical` / `_showHorizontal` gate the `--hidden` class on each
    //   track (`orientation`, `disabled`), so changing either turns the rule
    //   on or off without any overflow signal moving — the overflow flip
    //   handled in `_updateGeometry()` does not cover this.
    //
    // Only inputs are read, so this never runs during scrolling.
    effect(() => {
      this.scrollbarSize();
      this._showVertical();
      this._showHorizontal();
      this._invalidateTrackMetrics();
    });

    this._destroyRef.onDestroy(() => {
      this._resizeObserver?.disconnect();
      if (this._scrollTimeout !== null) {
        clearTimeout(this._scrollTimeout);
      }
    });
  }

  /**
   * @private Binds the viewport's scroll listener outside the template, as an
   * `rxjs` `fromEvent` stream, instead of through a `(scroll)` binding.
   *
   * A template listener is wrapped by Angular in
   * `wrapListenerIn_markDirtyAndPreventDefault`, which marks the whole
   * ancestor view chain dirty and notifies the change-detection scheduler
   * **before it even knows whether the handler changed anything** — one full
   * change-detection pass per scroll event, at input frequency, for a handler
   * whose signals usually land on the values they already held. `fromEvent`
   * registers a plain `addEventListener` with no such wrapper: signal writes
   * propagate through the reactivity graph on their own, so a scroll that
   * moves no signal now costs nothing.
   *
   * `{ passive: true }` is forwarded to `addEventListener` — a non-passive
   * scroll listener is its own performance bug, so it is not optional here.
   *
   * `runOutsideAngular` is kept for consumers still on zone-based change
   * detection, where the zone would schedule its own tick on top.
   *
   * `takeUntilDestroyed` takes the `DestroyRef` explicitly: this runs from an
   * `afterNextRender` callback, which is not an injection context.
   *
   * `#viewport` is unconditional in the template, so the element resolved here
   * is the one that lives for the component's whole lifetime; there is no
   * later value to re-bind to. The same is required of `scroller()` — see its
   * own doc comment.
   *
   * `scroll` does **not** bubble, so the listener has to sit on the element
   * that scrolls. In external mode that is the decorated element, never the
   * host and never the internal viewport.
   */
  private _registerScrollListener(): void {
    const scrollerEl = this._scrollerElement();

    this._ngZone.runOutsideAngular(() => {
      fromEvent(scrollerEl, 'scroll', { passive: true })
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._onScroll());
    });
  }

  /** @private Handles scroll events on the viewport. Updates thumb positions and `--scrolling` state. */
  private _onScroll(): void {
    this._updateThumbPositions();

    this._isScrolling.set(true);
    if (this._scrollTimeout !== null) {
      clearTimeout(this._scrollTimeout);
    }
    this._scrollTimeout = setTimeout(() => {
      this._isScrolling.set(false);
      this._scrollTimeout = null;
    }, 150);
  }

  /**
   * @protected Handles `pointerdown` on a scrollbar thumb.
   * Captures the pointer and translates subsequent `pointermove` deltas into
   * viewport scroll offsets. Releases on `pointerup` or `pointercancel`.
   */
  protected _onThumbPointerDown(
    event: PointerEvent,
    axis: 'vertical' | 'horizontal',
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const thumb = event.currentTarget as HTMLElement;
    thumb.setPointerCapture(event.pointerId);

    const viewportEl = this._scrollerElement();

    // Same measurement `_updateThumbPositions()` needs, so it is taken from
    // the shared cache rather than read again: a drag that starts before any
    // scroll finds the cache empty and measures on the spot, and every resize
    // has already dropped it, so it can never be staler here than there.
    const { usablePx: trackSize } = this._trackMetrics(axis);

    const thumbSize =
      axis === 'vertical' ? this._thumbHeight() : this._thumbWidth();
    const scrollRange =
      axis === 'vertical'
        ? viewportEl.scrollHeight - viewportEl.clientHeight
        : viewportEl.scrollWidth - viewportEl.clientWidth;

    const startPointer = axis === 'vertical' ? event.clientY : event.clientX;
    const startScroll =
      axis === 'vertical' ? viewportEl.scrollTop : viewportEl.scrollLeft;
    const scrollPerPixel =
      thumbSize < trackSize && scrollRange > 0
        ? scrollRange / (trackSize - thumbSize)
        : 0;

    this._isDragging.set(true);

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const delta =
        (axis === 'vertical' ? moveEvent.clientY : moveEvent.clientX) -
        startPointer;
      if (axis === 'vertical') {
        viewportEl.scrollTop = startScroll + delta * scrollPerPixel;
      } else {
        viewportEl.scrollLeft = startScroll + delta * scrollPerPixel;
      }
    };

    let releaseListeners: (() => void) | null = null;
    const onPointerUp = (): void => {
      this._isDragging.set(false);
      releaseListeners?.();
      releaseListeners = null;
    };

    const moveDispose = this._renderer.listen(
      thumb,
      'pointermove',
      onPointerMove,
    );
    const upDispose = this._renderer.listen(thumb, 'pointerup', onPointerUp);
    const cancelDispose = this._renderer.listen(
      thumb,
      'pointercancel',
      onPointerUp,
    );

    releaseListeners = () => {
      moveDispose();
      upDispose();
      cancelDispose();
    };

    // Guarantee cleanup if the component is destroyed mid-drag — without this
    // the listeners would leak against the detached thumb element and
    // _isDragging would stay true.
    this._destroyRef.onDestroy(() => {
      releaseListeners?.();
    });
  }

  /**
   * @private Recalculates overflow detection and thumb geometry.
   * Called after first render and on ResizeObserver notifications.
   *
   * A resize is the main way a track can change size, so this is where the
   * cached track metrics are dropped (the other is a `scrollbarSize` change,
   * handled by the effect in the constructor).
   */
  private _updateGeometry(): void {
    const viewportEl = this._scrollerElement();
    const hadVerticalOverflow = this._hasVerticalOverflow();
    const hadHorizontalOverflow = this._hasHorizontalOverflow();

    // +1 tolerance for sub-pixel rounding
    this._hasVerticalOverflow.set(
      viewportEl.scrollHeight > viewportEl.clientHeight + 1,
    );
    this._hasHorizontalOverflow.set(
      viewportEl.scrollWidth > viewportEl.clientWidth + 1,
    );

    this._invalidateTrackMetrics();
    this._updateThumbPositions();

    // The measurement `_updateThumbPositions()` just took was read against the
    // DOM as it stood *before* Angular re-rendered the visibility classes the
    // two `set` calls above have only now decided. On the axis that flipped,
    // its own track was still carrying its previous visibility — a track that
    // has just become visible still measured `display: none`, which
    // `_trackMetrics()` refuses to cache. The *other* axis measured a visible
    // track, so it was cached, but the corner-avoidance rule in the stylesheet
    // shortens each track by one scrollbar width while the other one is
    // visible: a flip on one axis therefore stales the cross axis by exactly
    // that width. Drop it so the next read measures the settled layout.
    if (this._hasHorizontalOverflow() !== hadHorizontalOverflow) {
      this._trackMetricsV = null;
    }
    if (this._hasVerticalOverflow() !== hadVerticalOverflow) {
      this._trackMetricsH = null;
    }
  }

  /**
   * @private Returns the metrics of one track, measuring them only when the
   * cache is dirty.
   *
   * A measurement is cached only when the track was actually laid out. A track
   * with no overflow on its axis carries `.mlv-scrollbar__track--hidden`, which
   * is `display: none`, and a `display: none` element reports an extent of `0`.
   * `_updateGeometry()` measures synchronously, before Angular has re-rendered
   * the class binding it just invalidated, so on the frame where overflow first
   * appears the track is still hidden and still measures `0`. Caching that
   * would pin the thumb to a zero-length track forever; leaving the cache dirty
   * instead makes the next read re-measure the now-visible track.
   *
   * The measurement is still *returned* in that case, so the values written to
   * the thumb signals are byte-identical to the uncached implementation —
   * caching changes how often the DOM is read, never what is computed from it.
   */
  private _trackMetrics(axis: 'vertical' | 'horizontal'): TrackMetrics {
    const cached =
      axis === 'vertical' ? this._trackMetricsV : this._trackMetricsH;
    if (cached !== null) {
      return cached;
    }

    const trackEl = (axis === 'vertical' ? this._trackV() : this._trackH())
      .nativeElement;
    const style = getComputedStyle(trackEl);
    const paddingPx = parseFloat(
      axis === 'vertical' ? style.paddingTop : style.paddingLeft,
    );
    const extentPx =
      axis === 'vertical' ? trackEl.offsetHeight : trackEl.offsetWidth;
    const metrics: TrackMetrics = {
      paddingPx,
      usablePx: extentPx - paddingPx * 2,
    };

    // `extentPx > 0` is also false for NaN, so an unmeasurable track is
    // treated as still dirty rather than cached.
    if (extentPx > 0 && Number.isFinite(paddingPx)) {
      if (axis === 'vertical') {
        this._trackMetricsV = metrics;
      } else {
        this._trackMetricsH = metrics;
      }
    }

    return metrics;
  }

  /**
   * @private Drops both cached track metrics so the next read re-measures.
   * Called whenever the tracks may have been laid out differently.
   */
  private _invalidateTrackMetrics(): void {
    this._trackMetricsV = null;
    this._trackMetricsH = null;
  }

  /**
   * @private Recomputes thumb position and size signals from the current viewport
   * scroll state. Fast path — called on every scroll event.
   *
   * Reads nothing from the DOM but the viewport's own scroll state
   * (`scrollTop`/`scrollLeft`, `clientHeight`/`clientWidth`,
   * `scrollHeight`/`scrollWidth`). Track padding and extent come from
   * `_trackMetrics()`, which is cached across scrolls — otherwise every scroll
   * frame would force a style recalculation plus a layout, twice on a
   * bidirectionally scrollable region.
   */
  private _updateThumbPositions(): void {
    const viewportEl = this._scrollerElement();

    if (this._showVertical() && this._hasVerticalOverflow()) {
      const { paddingPx, usablePx: usableHeight } =
        this._trackMetrics('vertical');
      const ratio = viewportEl.clientHeight / viewportEl.scrollHeight;
      const thumbH = Math.max(this._minThumbSize, usableHeight * ratio);
      const scrollRange = viewportEl.scrollHeight - viewportEl.clientHeight;
      const thumbT =
        scrollRange > 0
          ? paddingPx +
            (viewportEl.scrollTop / scrollRange) * (usableHeight - thumbH)
          : paddingPx;
      this._thumbHeight.set(Math.round(thumbH));
      this._thumbTop.set(Math.round(thumbT));
    }

    if (this._showHorizontal() && this._hasHorizontalOverflow()) {
      const { paddingPx, usablePx: usableWidth } =
        this._trackMetrics('horizontal');
      const ratio = viewportEl.clientWidth / viewportEl.scrollWidth;
      const thumbW = Math.max(this._minThumbSize, usableWidth * ratio);
      const scrollRange = viewportEl.scrollWidth - viewportEl.clientWidth;
      const thumbL =
        scrollRange > 0
          ? paddingPx +
            (viewportEl.scrollLeft / scrollRange) * (usableWidth - thumbW)
          : paddingPx;
      this._thumbWidth.set(Math.round(thumbW));
      this._thumbLeft.set(Math.round(thumbL));
    }
  }
}
