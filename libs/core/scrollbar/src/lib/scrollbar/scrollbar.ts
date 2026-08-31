import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  Renderer2,
  signal,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { MLV_SCROLLBAR_I18N } from '@malva-ui/i18n';

/**
 * Elements that can plausibly be tab stops. A cheap prefilter — every hit is
 * still confirmed with the CDK's `InteractivityChecker`.
 */
const FOCUSABLE_CANDIDATE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  'details',
  'summary',
  '[contenteditable]',
  '[tabindex]',
].join(',');

/** Controls which scroll axes render a custom scrollbar. */
export type MlvScrollbarOrientation = 'vertical' | 'horizontal' | 'both';

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
   * Custom aria-label override for the scrollable viewport region.
   * Falls back to the i18n-provided label.
   * Override when the component wraps content with a more specific purpose,
   * e.g. `ariaLabel="Chat messages"`.
   *
   * The label is only written to the DOM while the viewport is itself a tab
   * stop — see `viewportTabIndex`. A viewport that is not keyboard-reachable
   * is left as a plain container, because `aria-label` is prohibited on a
   * role-less element and naming a non-interactive wrapper only adds noise.
   */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Tab index applied to the native scroll viewport.
   *
   * The default `0` means **auto**: the viewport is a tab stop only while its
   * content holds nothing tabbable. A text-only region stays reachable so
   * keyboard users can scroll it (WCAG 2.1.1), but a region full of form
   * controls does not add a redundant stop in front of them — which is what
   * put a focus ring around an entire dialog body on open.
   *
   * Any non-zero value is applied verbatim; composite widgets that manage
   * their own focus pass `-1`.
   */
  readonly viewportTabIndex = input<number>(0);

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
   * @protected Whether the scrolled content currently holds a tabbable element.
   * Recomputed after render and on every content mutation.
   */
  protected readonly _hasTabbableContent = signal(false);

  /**
   * @protected Tab index actually written to the viewport.
   *
   * `0` is treated as "auto" and collapses to `-1` once the content itself is
   * keyboard-reachable; every other value passes through unchanged.
   */
  protected readonly _effectiveViewportTabIndex = computed(() => {
    const requested = this.viewportTabIndex();
    if (requested !== 0) {
      return requested;
    }
    return this._hasTabbableContent() ? -1 : 0;
  });

  /**
   * @protected Whether the viewport is itself reachable by keyboard.
   *
   * Only a viewport that is a tab stop is a control the user can land on, and
   * therefore the only case in which the region has to introduce and name
   * itself (WCAG 4.1.2).
   */
  protected readonly _isViewportFocusable = computed(
    () => this._effectiveViewportTabIndex() >= 0,
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
   * The native scrollable viewport element.
   * Lets wrapping components (e.g. `main[mlvPage]`) observe scroll position
   * without reaching into the component's private DOM.
   */
  get viewportElement(): HTMLElement {
    return this._viewport().nativeElement;
  }

  /** @private Reference to the vertical track element. */
  private readonly _trackV =
    viewChild.required<ElementRef<HTMLDivElement>>('trackV');

  /** @private Reference to the horizontal track element. */
  private readonly _trackH =
    viewChild.required<ElementRef<HTMLDivElement>>('trackH');

  /** @private Minimum rendered thumb length in pixels — prevents thumb from becoming unclickable. */
  private readonly _minThumbSize = 32;

  /** @private Native ResizeObserver watching viewport and content size. */
  private _resizeObserver: ResizeObserver | null = null;

  /** @private Native MutationObserver keeping `_hasTabbableContent` in sync with projected content. */
  private _contentObserver: MutationObserver | null = null;

  /**
   * @private Handle of the animation frame a tabbability rescan is queued on,
   * or `null` when nothing is queued.
   *
   * The scan walks the whole scroll region, so a burst of mutations — a data
   * table repainting rows, a chat viewport appending messages — must collapse
   * into a single pass. Only ever holds a handle when `requestAnimationFrame`
   * exists; otherwise the scan runs synchronously instead of being dropped.
   */
  private _tabbableScanFrame: number | null = null;

  /** @private CDK checker used to decide whether projected content is keyboard-reachable. */
  private readonly _interactivityChecker = inject(InteractivityChecker);

  /** @private Timeout ID for clearing the `--scrolling` modifier after idle. */
  private _scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  /** @private DestroyRef used to clean up the ResizeObserver, timers, and drag listeners. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Renderer2 used so DOM listeners are SSR-safe and unsubscribable. */
  private readonly _renderer = inject(Renderer2);

  constructor() {
    afterNextRender(() => {
      this._updateGeometry();
      this._updateTabbableContent();

      const viewportEl = this._viewport().nativeElement;
      const contentEl = viewportEl.firstElementChild;

      if (contentEl && typeof MutationObserver !== 'undefined') {
        // Projected content is opaque to the component, so tabbability has to
        // be re-read whenever it changes shape — a lazily rendered form, a
        // button that becomes disabled, an @if that swaps text for controls.
        //
        // The subtree is also where the host's own churn lives, so the records
        // are filtered down to the ones that can move a tab stop and the
        // surviving burst is coalesced into one scan per frame.
        this._contentObserver = new MutationObserver((records) => {
          if (this._affectsTabbability(records)) {
            this._scheduleTabbableContentUpdate();
          }
        });
        this._contentObserver.observe(contentEl, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['tabindex', 'disabled', 'hidden', 'href', 'type'],
        });
      }

      if (typeof ResizeObserver === 'undefined') {
        return;
      }

      this._resizeObserver = new ResizeObserver(() => {
        this._updateGeometry();
      });

      // Observe the viewport to detect host resize (viewport fills host via position:absolute).
      this._resizeObserver.observe(viewportEl);
      // Observe the content wrapper to detect content size changes.
      if (contentEl) {
        this._resizeObserver.observe(contentEl);
      }
    });

    this._destroyRef.onDestroy(() => {
      this._resizeObserver?.disconnect();
      this._contentObserver?.disconnect();
      if (this._tabbableScanFrame !== null) {
        cancelAnimationFrame(this._tabbableScanFrame);
        this._tabbableScanFrame = null;
      }
      if (this._scrollTimeout !== null) {
        clearTimeout(this._scrollTimeout);
      }
    });
  }

  /**
   * @private Queues a tabbability rescan for the next animation frame,
   * replacing any frame already queued.
   *
   * N mutations inside one frame therefore cost exactly one scan. The result
   * only feeds `_effectiveViewportTabIndex`, so a frame of latency is free —
   * the first render still calls `_updateTabbableContent()` directly, because
   * the viewport's tabindex has to be right on first paint.
   *
   * Falls back to a synchronous scan where `requestAnimationFrame` is missing,
   * matching how the file already guards `MutationObserver`/`ResizeObserver`.
   */
  private _scheduleTabbableContentUpdate(): void {
    if (typeof requestAnimationFrame === 'undefined') {
      this._updateTabbableContent();
      return;
    }

    if (this._tabbableScanFrame !== null) {
      cancelAnimationFrame(this._tabbableScanFrame);
    }

    this._tabbableScanFrame = requestAnimationFrame(() => {
      this._tabbableScanFrame = null;
      this._updateTabbableContent();
    });
  }

  /**
   * @private Whether any record in a mutation batch could move a tab stop.
   *
   * Returns on the first relevant record — the batch only has to answer
   * "scan or not", never "how many".
   */
  private _affectsTabbability(records: MutationRecord[]): boolean {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (this._isRelevantAttributeRecord(record)) {
          return true;
        }
      } else if (record.type === 'childList') {
        if (
          this._nodesHoldCandidate(record.addedNodes) ||
          this._nodesHoldCandidate(record.removedNodes)
        ) {
          return true;
        }
      } else {
        // `characterData` is not observed, so nothing else should arrive. An
        // unrecognised record is scanned rather than dropped: a wasted scan
        // costs a frame, a missed one is a silent WCAG 2.1.1 regression.
        return true;
      }
    }

    return false;
  }

  /**
   * @private Whether an attribute mutation could move a tab stop.
   *
   * The observer's `attributeFilter` splits into two groups:
   *
   * - `tabindex` and `href` **define** candidacy, so removing either leaves a
   *   target that no longer matches the selector even though that removal is
   *   precisely the change to re-read (an `<a>` losing its `href` stops being
   *   a tab stop). The record carries no previous value, so these always scan.
   * - `disabled`, `hidden` and `type` change the tabbability of the target or
   *   of its descendants only — `hidden` on a plain wrapper `<div>`, `disabled`
   *   on a `<fieldset>`. Neither target matches the candidate selector itself,
   *   which is why containment has to be tested as well as matching. A target
   *   that neither is nor holds a candidate cannot matter.
   */
  private _isRelevantAttributeRecord(record: MutationRecord): boolean {
    const target = record.target;
    if (!(target instanceof Element)) {
      return false;
    }

    if (
      record.attributeName === 'tabindex' ||
      record.attributeName === 'href'
    ) {
      return true;
    }

    return this._holdsCandidate(target);
  }

  /**
   * @private Whether any node in an added/removed list is, or contains, a
   * focusable candidate.
   *
   * `addedNodes`/`removedNodes` carry text and comment nodes too — the churn
   * this filter exists to absorb is mostly exactly that — so every entry is
   * narrowed to `Element` first. A removed element is already detached, but
   * `matches`/`querySelector` still work on a detached subtree.
   */
  private _nodesHoldCandidate(nodes: NodeList): boolean {
    for (const node of Array.from(nodes)) {
      if (node instanceof Element && this._holdsCandidate(node)) {
        return true;
      }
    }

    return false;
  }

  /** @private Whether an element is, or contains, a focusable candidate. */
  private _holdsCandidate(element: Element): boolean {
    return (
      element.matches(FOCUSABLE_CANDIDATE_SELECTOR) ||
      element.querySelector(FOCUSABLE_CANDIDATE_SELECTOR) !== null
    );
  }

  /**
   * @private Re-reads whether the projected content contains a tab stop.
   *
   * Drives `_effectiveViewportTabIndex`: a scroll region only needs to be a tab
   * stop of its own when nothing inside it already is (WCAG 2.1.1). Keeping it
   * unconditionally tabbable put a redundant stop — and a focus ring around the
   * whole region — in front of every dialog body's form controls.
   *
   * Called directly for the first render and through
   * `_scheduleTabbableContentUpdate()` for every mutation after it.
   */
  private _updateTabbableContent(): void {
    const contentEl = this._viewport().nativeElement.firstElementChild;
    if (!contentEl) {
      this._hasTabbableContent.set(false);
      return;
    }

    const candidates = contentEl.querySelectorAll<HTMLElement>(
      FOCUSABLE_CANDIDATE_SELECTOR,
    );

    for (const candidate of Array.from(candidates)) {
      // `ignoreVisibility` because the CDK's visibility test is geometric and
      // the content may not have been laid out yet (and never is under jsdom).
      if (
        this._interactivityChecker.isFocusable(candidate, {
          ignoreVisibility: true,
        }) &&
        this._interactivityChecker.isTabbable(candidate)
      ) {
        this._hasTabbableContent.set(true);
        return;
      }
    }

    this._hasTabbableContent.set(false);
  }

  /** @protected Handles scroll events on the viewport. Updates thumb positions and `--scrolling` state. */
  protected _onScroll(): void {
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

    const viewportEl = this._viewport().nativeElement;
    const trackEl = (axis === 'vertical' ? this._trackV() : this._trackH())
      .nativeElement;

    const paddingPx =
      axis === 'vertical'
        ? parseFloat(getComputedStyle(trackEl).paddingTop)
        : parseFloat(getComputedStyle(trackEl).paddingLeft);

    const trackSize =
      axis === 'vertical'
        ? trackEl.offsetHeight - paddingPx * 2
        : trackEl.offsetWidth - paddingPx * 2;

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
   * Called after first render, on ResizeObserver notifications, and on scroll.
   */
  private _updateGeometry(): void {
    const viewportEl = this._viewport().nativeElement;
    // +1 tolerance for sub-pixel rounding
    this._hasVerticalOverflow.set(
      viewportEl.scrollHeight > viewportEl.clientHeight + 1,
    );
    this._hasHorizontalOverflow.set(
      viewportEl.scrollWidth > viewportEl.clientWidth + 1,
    );
    this._updateThumbPositions();
  }

  /**
   * @private Recomputes thumb position and size signals from the current viewport
   * scroll state. Fast path — called on every scroll event.
   */
  private _updateThumbPositions(): void {
    const viewportEl = this._viewport().nativeElement;

    if (this._showVertical() && this._hasVerticalOverflow()) {
      const trackEl = this._trackV().nativeElement;
      const paddingPx = parseFloat(getComputedStyle(trackEl).paddingTop);
      const usableHeight = trackEl.offsetHeight - paddingPx * 2;
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
      const trackEl = this._trackH().nativeElement;
      const paddingPx = parseFloat(getComputedStyle(trackEl).paddingLeft);
      const usableWidth = trackEl.offsetWidth - paddingPx * 2;
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
