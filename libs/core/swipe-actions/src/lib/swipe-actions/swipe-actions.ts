import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvTabbableElementService } from '@malva-ui/cdk/accessibility';
import { MlvResizeObserverService, MlvRtlService } from '@malva-ui/cdk/utils';
import type { Subscription } from 'rxjs';
import { debounceTime, EMPTY, fromEvent, merge, timer } from 'rxjs';
import { MlvSwipeActionsCoordinator } from '../swipe-actions-coordinator';
import type { MlvSwipeActionsSide } from '../swipe-actions-token';
import { MLV_SWIPE_ACTIONS } from '../swipe-actions-token';

/**
 * How long a `scroll` stream must stay quiet before the row counts as
 * settled, in browsers without a `scrollend` event.
 */
const SETTLE_DELAY_MS = 120;

/** How long {@link MlvSwipeActions.peek} keeps the actions revealed. */
const PEEK_HOLD_MS = 900;

/**
 * Sub-pixel tolerance when comparing a scroll offset with the closed
 * offset — a settled snap can land a fraction off on a fractional zoom.
 */
const OFFSET_EPSILON = 0.5;

/**
 * iOS-style swipe-to-reveal actions for a list row.
 *
 * The host is a horizontal **scroll-snap container** with a hidden scrollbar:
 * `[start actions][content][end actions]` are its three snap stops, and the
 * browser's own scrolling drives the gesture — momentum, rubber-banding, axis
 * locking against the vertical list, trackpad and Shift+wheel on the desktop,
 * and a focused action scrolling itself into view for keyboard users all come
 * for free, with no JavaScript running per frame. Inside each side the
 * actions are `position: sticky` against the edge they reveal from, so the
 * outermost action pins to the row's edge while the inner ones slide out from
 * beneath it — the stacked fan-out, with no per-action measurement and no
 * equal-width assumption.
 *
 * Actions are `[mlvSwipeAction]` elements projected anywhere inside the
 * row; the static `side="start"` attribute routes one to the inline-start
 * edge, everything else lands on the inline-end edge, and every other node is
 * the row's content. Both edges are logical and mirror under `dir="rtl"`.
 *
 * `opened` is a two-way model of the **settled** side (`'start'`, `'end'`
 * or `null`): it updates once a scroll comes to rest, and writing it scrolls
 * the row. {@link open}, {@link close} and {@link peek} are the imperative
 * equivalents. Rows coordinate application-wide: starting to swipe one row
 * closes the one already open, and a press or a focus move outside the open
 * row closes it. Activating an action, or pressing Escape, closes the row.
 *
 * @example
 * ```html
 * <mlv-swipe-actions [(opened)]="side" (openedChange)="onSwipe($event)">
 *   <button mlvSwipeAction side="start" tone="success" (click)="archive(item)">
 *     <svg lucideArchive [size]="20" aria-hidden="true" />
 *     Archive
 *   </button>
 *
 *   <mlv-list-item>{{ item.title }}</mlv-list-item>
 *
 *   <button mlvSwipeAction (click)="flag(item)">
 *     <svg lucideFlag [size]="20" aria-hidden="true" />
 *     Flag
 *   </button>
 *   <button mlvSwipeAction tone="danger" (click)="remove(item)">
 *     <svg lucideTrash2 [size]="20" aria-hidden="true" />
 *     Delete
 *   </button>
 * </mlv-swipe-actions>
 * ```
 */
@Component({
  selector: 'mlv-swipe-actions',
  template: `<div class="mlv-swipe-actions__start" #start>
      <ng-content select="[mlvSwipeAction][side=start]" />
    </div>
    <div class="mlv-swipe-actions__content" #content><ng-content /></div>
    <div class="mlv-swipe-actions__end" #end>
      <ng-content select="[mlvSwipeAction]" />
    </div>`,
  styleUrl: './swipe-actions.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_SWIPE_ACTIONS, useExisting: MlvSwipeActions }],
  host: {
    class: 'mlv-swipe-actions',
    '[class.mlv-swipe-actions--ready]': '_ready()',
    '[class.mlv-swipe-actions--displaced]': '_displaced()',
    '[class.mlv-swipe-actions--open]': 'opened() !== null',
    '[class.mlv-swipe-actions--disabled]': 'disabled()',
    '(keydown.escape)': '_onEscape($event)',
  },
})
export class MlvSwipeActions {
  /**
   * The side currently revealed, two-way. Reflects the **settled** state — it
   * changes when a swipe comes to rest on a side (or back on the content),
   * not while the finger is still moving. Writing `'start'` / `'end'` /
   * `null` scrolls the row there (smoothly, or instantly under
   * `prefers-reduced-motion`).
   */
  readonly opened = model<MlvSwipeActionsSide | null>(null);

  /**
   * Locks the row on its content: the scroll axis is hidden, an open row is
   * closed, and {@link open} / {@link peek} are ignored. The actions stay in
   * the DOM and in the accessibility tree.
   */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Teaches the gesture: once the row is positioned, the end actions peek out
   * and slide back (see {@link peek}). Plays at most once per instance and
   * never under `prefers-reduced-motion`. Set it on the first row of a list,
   * not on every row.
   */
  readonly hint = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @private Host element — the scroll container itself, and the scope its
   * direction resolves against.
   */
  private readonly _hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** @private The inline-start actions slot; its width is the closed offset. */
  private readonly _startRef =
    viewChild.required<ElementRef<HTMLElement>>('start');

  /** @private The content slot; Escape moves focus back into it. */
  private readonly _contentRef =
    viewChild.required<ElementRef<HTMLElement>>('content');

  /** @private The inline-end actions slot. */
  private readonly _endRef = viewChild.required<ElementRef<HTMLElement>>('end');

  /** @private Mirrors scroll offsets in RTL. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Reports the start slot's width. The service keeps one
   * `ResizeObserver` per observed element, so this is one observer per row.
   */
  private readonly _resizeObserver = inject(MlvResizeObserverService);

  /** @private Keeps one row open at a time and closes it from outside. */
  private readonly _coordinator = inject(MlvSwipeActionsCoordinator);

  /** @private Finds where focus should land when Escape closes the row. */
  private readonly _tabbable = inject(MlvTabbableElementService);

  /** @private Owner of `activeElement` for the Escape focus hand-off. */
  private readonly _document = inject(DOCUMENT);

  /** @private Releases listeners registered outside an injection context. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Direction applying to this host, following any `[dir]` scope
   * above it. `scrollLeft` is physical and runs negative through an RTL
   * scroller, so every offset crosses this once, at the boundary.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._hostRef,
  );

  /**
   * @private Logical scroll offset at which the row rests on its content —
   * the width of the start slot, `0` without start actions. Fed by a resize
   * observer so late fonts or added actions never leave the row misaligned.
   */
  private readonly _closedOffset = signal(0);

  /**
   * @protected True once the start slot has been measured and the row moved
   * onto its content. Until then the start slot is kept out of flow by the
   * stylesheet so server-rendered markup shows the content at offset zero.
   */
  protected readonly _ready = signal(false);

  /**
   * @protected True while the scroll offset differs from the closed offset —
   * from the first pixel of a swipe until the row rests on its content
   * again. Drives `overscroll-behavior` and the coordinator registration.
   */
  protected readonly _displaced = signal(false);

  /**
   * @private The side the row rests on or is scrolling towards: written by
   * every settle and by every scroll this component starts. The model
   * effect compares against it to tell a consumer write (scroll there) from
   * the echo of our own `opened.set()` (nothing to do) — including a write
   * that lands while the previous one is still in flight.
   */
  private _knownSide: MlvSwipeActionsSide | null = null;

  /** @private The pending close of a running {@link peek}, if any. */
  private _peekClose: Subscription | null = null;

  /** @private Whether `hint` has already played. */
  private _hinted = false;

  constructor() {
    this._destroyRef.onDestroy(() => {
      this._peekClose?.unsubscribe();
      this._coordinator.release(this);
    });

    afterNextRender(() => {
      this._observeStartSlot();
      this._listenToScroll();
    });

    // Consumer writes to `opened` scroll the row. The same effect runs when
    // the closed offset changes (first measurement, later resize), so a
    // scroll starts only when the *model* changed and disagrees with
    // `_knownSide`: our own settle echo already matches it, and a run caused
    // by the closed offset must not steer a scroll that `open()` / `peek()`
    // started while the model still reads the previous side.
    let lastSide: MlvSwipeActionsSide | null = null;
    let lastClosed: number | null = null;
    afterRenderEffect(() => {
      const ready = this._ready();
      const closed = this._closedOffset();
      const side = this.opened();
      untracked(() => {
        if (!ready) return;
        if (side !== lastSide) {
          lastSide = side;
          if (side !== this._knownSide) this._scrollToSide(side, true);
        }
        if (closed !== lastClosed) {
          lastClosed = closed;
          // A row resting on its content follows the closed offset instantly;
          // one that is open, or scrolling somewhere, keeps its position.
          if (this._knownSide === null && !this._displaced()) {
            this._writeScrollLeft(closed);
          }
          // The displaced state is derived against the closed offset, and a
          // row that becomes closed because that offset moved under it fires
          // no scroll event: re-derive it here. Re-settle only a row at rest
          // — mid-flight the model would report a side the row is merely
          // passing through, and `scrollend` settles it anyway.
          this._onScroll();
          if (this._isAtKnownSide()) this._onSettle();
        }
      });
    });

    afterRenderEffect(() => {
      if (this.disabled()) untracked(() => this.close());
    });

    afterRenderEffect(() => {
      const hint = this.hint();
      const ready = this._ready();
      untracked(() => {
        if (!hint || !ready || this._hinted) return;
        this._hinted = true;
        this.peek('end');
      });
    });
  }

  /**
   * Reveals `side`, scrolling the row there. Ignored while `disabled`.
   * `opened` follows once the scroll settles.
   */
  open(side: MlvSwipeActionsSide): void {
    if (this.disabled()) return;
    this._scrollToSide(side, true);
  }

  /**
   * Scrolls the row back onto its content. A no-op while it already rests
   * there.
   */
  close(): void {
    this._peekClose?.unsubscribe();
    this._peekClose = null;
    if (!this._isDisplacedNow()) return;
    this._scrollToSide(null, true);
  }

  /**
   * Reveals `side` briefly and slides back — an onboarding hint for the
   * gesture. Does nothing while `disabled`, when that side has no actions, or
   * under `prefers-reduced-motion`, where a jump would teach nothing.
   */
  peek(side: MlvSwipeActionsSide = 'end'): void {
    if (this.disabled() || this._prefersReducedMotion()) return;
    if (!this._slotFor(side).childElementCount) return;
    this._peekClose?.unsubscribe();
    this._scrollToSide(side, true);
    this._peekClose = timer(PEEK_HOLD_MS)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._peekClose = null;
        this.close();
      });
  }

  /** @internal Coordinator hook — whether `target` is inside this row. */
  contains(target: EventTarget | null): boolean {
    return (
      target instanceof Node && this._hostRef.nativeElement.contains(target)
    );
  }

  /**
   * @protected Escape closes the row and hands focus to the first tabbable
   * element of the content, so it never stays on an action that just slid
   * out of view; with nothing to focus, an action holding focus is blurred.
   * The event is consumed only when the row acted on it: an Escape on a
   * resting row still reaches an enclosing drawer or dialog. Typed `Event`:
   * that is what a host `(keydown.escape)` binding hands over under AOT.
   */
  protected _onEscape(event: Event): void {
    if (!this._isDisplacedNow()) return;
    event.stopPropagation();
    this.close();
    const content = this._contentRef().nativeElement;
    const next = this._tabbable.getTabbableElement(content, false, true);
    if (next) {
      next.focus({ preventScroll: true });
      return;
    }
    const active = this._document.activeElement;
    if (active instanceof HTMLElement && this.contains(active)) active.blur();
  }

  /**
   * @private Watches the start slot's width — the closed offset — through the
   * shared resize observer. The first report also flips `_ready`, which puts
   * the slot back in flow; the render effect then moves the row onto its
   * content before the frame paints.
   */
  private _observeStartSlot(): void {
    const start = this._startRef().nativeElement;
    this._resizeObserver
      .observe(start)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this._closedOffset.set(start.offsetWidth);
        this._ready.set(true);
      });
  }

  /**
   * @private Binds the scroll listeners as plain `fromEvent` streams, not
   * template bindings: a host `(scroll)` binding would notify the
   * change-detection scheduler on every event of a momentum scroll, while
   * these only write a boolean signal that rarely changes. `scrollend` is
   * always listened to; where the browser lacks it, a debounced `scroll`
   * stands in. Registered from `afterNextRender`, which is not an injection
   * context, so the `DestroyRef` is passed explicitly.
   */
  private _listenToScroll(): void {
    const el = this._hostRef.nativeElement;
    fromEvent(el, 'scroll', { passive: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this._onScroll());

    const fallback =
      'onscrollend' in el
        ? EMPTY
        : fromEvent(el, 'scroll', { passive: true }).pipe(
            debounceTime(SETTLE_DELAY_MS),
          );
    merge(fromEvent(el, 'scrollend'), fallback)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => this._onSettle());
  }

  /**
   * @private Per scroll event: tracks whether the row has left its closed
   * offset and registers with / releases from the coordinator on the
   * transition — synchronously, so a second row starting to move closes the
   * first before its next frame.
   */
  private _onScroll(): void {
    const displaced = this._isDisplacedNow();
    if (displaced === this._displaced()) return;
    this._displaced.set(displaced);
    if (displaced) this._coordinator.activate(this);
    else this._coordinator.release(this);
  }

  /**
   * @private Once the scroll rests: derives the settled side from the offset
   * and publishes it through `opened`.
   */
  private _onSettle(): void {
    const delta = this._logicalOffset() - this._closedOffset();
    const side: MlvSwipeActionsSide | null =
      delta < -OFFSET_EPSILON ? 'start' : delta > OFFSET_EPSILON ? 'end' : null;
    this._knownSide = side;
    this.opened.set(side);
  }

  /** @private Whether the scroll offset currently differs from the closed one. */
  private _isDisplacedNow(): boolean {
    return (
      Math.abs(this._logicalOffset() - this._closedOffset()) > OFFSET_EPSILON
    );
  }

  /**
   * @private Whether the row rests where `_knownSide` points — false while a
   * scroll it started, or a gesture, is still in flight. Read from the
   * geometry rather than kept as a flag, so a scroll that never fires its
   * events (a target already reached) cannot leave it stale.
   */
  private _isAtKnownSide(): boolean {
    return (
      Math.abs(this._logicalOffset() - this._targetOffset(this._knownSide)) <=
      OFFSET_EPSILON
    );
  }

  /**
   * @private Distance scrolled from the inline-start edge of the content.
   * `scrollLeft` is physical: per CSSOM-View an RTL scroller reports `0` at
   * its inline-start (right) edge and goes negative from there.
   */
  private _logicalOffset(): number {
    const left = this._hostRef.nativeElement.scrollLeft;
    return this._direction() === 'rtl' ? -left : left;
  }

  /** @private The inverse of {@link _logicalOffset}. */
  private _physicalOffset(offset: number): number {
    return this._direction() === 'rtl' ? -offset : offset;
  }

  /**
   * @private The logical offset at which `side` is fully revealed: zero for
   * the start side, the far end of the scroll range for the end side, the
   * closed offset for none. The end target is read from the geometry rather
   * than measured, so no observer watches the end slot.
   */
  private _targetOffset(side: MlvSwipeActionsSide | null): number {
    const el = this._hostRef.nativeElement;
    if (side === 'start') return 0;
    if (side === 'end') return el.scrollWidth - el.clientWidth;
    return this._closedOffset();
  }

  /**
   * @private Scrolls to `side`. `smooth` is downgraded to an instant jump
   * under `prefers-reduced-motion` — an explicit `behavior` overrides the
   * computed `scroll-behavior`, so the media query has to be read here.
   */
  private _scrollToSide(
    side: MlvSwipeActionsSide | null,
    smooth: boolean,
  ): void {
    this._knownSide = side;
    const el = this._hostRef.nativeElement;
    const left = this._physicalOffset(this._targetOffset(side));
    const behavior: ScrollBehavior =
      smooth && !this._prefersReducedMotion() ? 'smooth' : 'instant';
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left, behavior });
    } else {
      el.scrollLeft = left;
    }
  }

  /** @private Sets the scroll position without animation or a `scrollTo` call. */
  private _writeScrollLeft(offset: number): void {
    this._hostRef.nativeElement.scrollLeft = this._physicalOffset(offset);
  }

  /** @private The actions slot for `side`. */
  private _slotFor(side: MlvSwipeActionsSide): HTMLElement {
    return (side === 'start' ? this._startRef() : this._endRef()).nativeElement;
  }

  /** @private Whether the user has asked for reduced motion. Browser-only callers. */
  private _prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
