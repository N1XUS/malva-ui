import {
  Directive,
  DestroyRef,
  ElementRef,
  NgZone,
  input,
  output,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  EMPTY,
  finalize,
  fromEvent,
  race,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvRtlService, mlvPointerGestureEnd } from '@malva-ui/cdk/utils';
import type { MlvDrawerPosition } from './drawer.service';

/** Velocity threshold (px/s) for swipe-to-dismiss. */
const DISMISS_VELOCITY_THRESHOLD = 500;

/** Step size as a fraction of viewport size for keyboard resize. */
const KEYBOARD_STEP_FRACTION = 0.1;

/**
 * Upper bound (ms) on the wait for the snap `transitionend`.
 *
 * The snap transition runs for `--mlv-drawer-snap-duration`, defaulting to
 * `--mlv-duration-slow` (300ms); this leaves headroom for a consumer override
 * without latching the class when the event never comes at all.
 */
const SNAP_TRANSITION_FALLBACK_MS = 1000;

/**
 * Internal directive that powers drag-to-resize on `mlv-drawer__handle`.
 * Applied by `MlvDrawer` when `resizable=true`; not intended for
 * direct external use.
 *
 * @internal
 */
@Directive({
  selector: '[mlvDrawerResize]',
  host: {
    role: 'separator',
    tabindex: '0',
    'aria-label': 'Resize panel',
    '[attr.aria-valuenow]': '_currentPercent()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    '(keydown)': '_onKeydown($event)',
  },
})
export class MlvDrawerResize {
  /**
   * @private Host element ref — the drawer resize handle. Also the scope the
   * horizontal resize arrows resolve their direction against: a drawer renders
   * inside a CDK overlay pane, which carries its own `dir`.
   */
  private readonly _el = inject(ElementRef<HTMLElement>);
  /** @private DestroyRef used for observable and listener cleanup. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private NgZone used to re-enter Angular after out-of-zone pointer handling. */
  private readonly _zone = inject(NgZone);
  /** @private Normalizes horizontal resize arrows for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);
  /**
   * @private The document the drawer renders into; its window supplies the
   * viewport size the drag and the keyboard steps are measured against. The
   * injected token, never the ambient `window` global.
   */
  private readonly _document = inject(DOCUMENT);

  /**
   * @private Direction applying to this handle, resolved once and cached
   * behind the shared `dir` observer rather than re-walked on every arrow
   * keypress.
   */
  private readonly _direction = this._rtlService.elementDirection(this._el);

  /**
   * Drawer edge position — determines drag axis and dismiss direction.
   */
  readonly position = input.required<MlvDrawerPosition>();

  /**
   * Sorted snap point percentages (0–100). Empty means free resize with no
   * snapping. The handle snaps to the nearest point after drag ends.
   */
  readonly snapPoints = input<number[]>([]);

  /**
   * Emitted when the user swipes past the velocity dismiss threshold or
   * navigates the handle to zero size via keyboard.
   */
  readonly dismissed = output<void>();

  /**
   * @protected Current panel size as an integer percentage, exposed as
   * `aria-valuenow`. A signal: the pointer path writes it from a `fromEvent`
   * listener, which schedules no change detection on its own under zoneless,
   * so a plain field left the attribute stale until something else ticked.
   */
  protected readonly _currentPercent = signal(100);

  /** @private Last pointer position (px) sampled for velocity tracking. */
  private _lastPos = 0;
  /** @private Timestamp of the last pointer sample for velocity tracking. */
  private _lastTime = 0;
  /** @private Current drag velocity (px/s) used for swipe-to-dismiss. */
  private _velocity = 0;

  constructor() {
    const handle = this._el.nativeElement;

    // The gesture ends on `pointerup`, `pointercancel` or the handle losing
    // capture (`mlvPointerGestureEnd`) — a touch drag the browser turns into a
    // scroll fires the second, not the first — and on destroy. `finalize`
    // clears the drag class on every one of those; only a release may fling
    // the sheet shut or snap it to 0 (see `_onGestureEnd`).
    fromEvent<PointerEvent>(handle, 'pointerdown')
      .pipe(
        filter((e) => e.button === 0),
        switchMap((startEvent) => {
          startEvent.preventDefault();
          const pointerId = startEvent.pointerId;
          try {
            handle.setPointerCapture(pointerId);
          } catch {
            // An inactive pointer (a synthetic event) cannot be captured.
            // Throwing here would error the stream and leave the handle dead;
            // the gesture still ends on pointerup / pointercancel.
          }

          const panel = this._getPanelElement();
          if (!panel) return EMPTY;

          const pos = this.position();
          const isVertical = pos === 'bottom' || pos === 'top';
          const viewportSize = this._viewportSize(isVertical);
          const rect = panel.getBoundingClientRect();
          const startPanelSize = isVertical ? rect.height : rect.width;
          const startPointerPos = isVertical
            ? startEvent.clientY
            : startEvent.clientX;

          this._lastPos = startPointerPos;
          this._lastTime = performance.now();
          this._velocity = 0;

          // Remove snap transition during drag for direct tracking
          panel.classList.add('mlv-drawer--dragging');

          return fromEvent<PointerEvent>(handle, 'pointermove').pipe(
            filter((moveEvent) => moveEvent.pointerId === pointerId),
            takeUntil(
              mlvPointerGestureEnd(handle, pointerId, handle).pipe(
                tap((endEvent) => {
                  panel.classList.remove('mlv-drawer--dragging');
                  this._zone.run(() =>
                    this._onGestureEnd(
                      panel,
                      pos,
                      isVertical,
                      viewportSize,
                      endEvent.type === 'pointerup',
                    ),
                  );
                }),
              ),
            ),
            tap((moveEvent) => {
              const currentPos = isVertical
                ? moveEvent.clientY
                : moveEvent.clientX;
              const now = performance.now();
              const dt = now - this._lastTime;
              if (dt > 0) {
                this._velocity = (currentPos - this._lastPos) / (dt / 1000);
              }
              this._lastPos = currentPos;
              this._lastTime = now;

              const delta = currentPos - startPointerPos;
              // For bottom/right drawers: moving pointer toward viewport edge (positive delta)
              // means dragging the panel closed, so size decreases.
              let newSize =
                pos === 'bottom' || pos === 'right'
                  ? startPanelSize - delta
                  : startPanelSize + delta;

              newSize = Math.max(0, Math.min(viewportSize, newSize));
              this._updatePanelSize(panel, newSize, viewportSize);
            }),
            // Also runs on destroy mid-drag and when a new press replaces
            // this gesture, neither of which reaches the end handler above.
            finalize(() => panel.classList.remove('mlv-drawer--dragging')),
          );
        }),
        // Last, so a destroy mid-drag tears down the active inner stream and
        // runs its `finalize`; placed before `switchMap` it would not.
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();
  }

  /**
   * @private Gets the drawer panel element — the direct parent of the handle.
   */
  private _getPanelElement(): HTMLElement | null {
    return this._el.nativeElement.parentElement;
  }

  /**
   * @private The viewport length on the drag axis: the injected document's
   * window `innerHeight` / `innerWidth`, falling back to its root element's
   * client box when the document has no window (`defaultView` is `null` for a
   * document built with `createHTMLDocument`).
   *
   * @param isVertical — `true` for a top / bottom sheet (block axis).
   */
  private _viewportSize(isVertical: boolean): number {
    const view = this._document.defaultView;
    if (view) return isVertical ? view.innerHeight : view.innerWidth;
    const root = this._document.documentElement;
    return isVertical ? root.clientHeight : root.clientWidth;
  }

  /**
   * @private Applies snap logic (or dismiss) once the gesture ends.
   *
   * A release (`pointerup`) may fling the panel shut past the velocity
   * threshold and snaps to the nearest point, dismissing on 0. An interruption
   * — `pointercancel` or lost capture — never dismisses, because the user never
   * let go: no fling, and the snap considers only the points that keep the
   * panel open. With none of those it is a free resize and keeps the box.
   *
   * @param released — Whether the gesture ended on `pointerup`.
   */
  private _onGestureEnd(
    panel: HTMLElement,
    pos: MlvDrawerPosition,
    isVertical: boolean,
    viewportSize: number,
    released: boolean,
  ): void {
    // Determine effective dismiss velocity: positive means "closing direction"
    const dismissVelocity =
      pos === 'bottom'
        ? this._velocity
        : pos === 'top'
          ? -this._velocity
          : pos === 'right'
            ? this._velocity
            : -this._velocity;

    if (released && dismissVelocity > DISMISS_VELOCITY_THRESHOLD) {
      this.dismissed.emit();
      return;
    }

    const snapPoints = released
      ? this.snapPoints()
      : this.snapPoints().filter((point) => point > 0);
    if (snapPoints.length === 0) {
      // Free resize: the box may have stopped at the panel's `minSize` /
      // `maxSize` while the drag kept asking for more.
      this._syncPercentToBox(panel, isVertical, viewportSize);
      return;
    }

    const currentSizePx = isVertical
      ? panel.getBoundingClientRect().height
      : panel.getBoundingClientRect().width;
    const currentPercent = (currentSizePx / viewportSize) * 100;

    // Find nearest snap point by absolute distance
    let nearestSnap = snapPoints[0];
    let minDist = Math.abs(currentPercent - snapPoints[0]);
    for (const sp of snapPoints) {
      const dist = Math.abs(currentPercent - sp);
      if (dist < minDist) {
        minDist = dist;
        nearestSnap = sp;
      }
    }

    if (nearestSnap === 0) {
      this.dismissed.emit();
      return;
    }

    // Animate panel to snap target
    panel.classList.add('mlv-drawer--snapping');
    const snapSizePx = (viewportSize * nearestSnap) / 100;
    this._updatePanelSize(panel, snapSizePx, viewportSize);
    this._currentPercent.set(nearestSnap);

    // `transitionend` is not guaranteed to arrive: `.mlv-drawer--snapping`
    // declares its `transition` inside `@media (prefers-reduced-motion:
    // no-preference)`, so a reduced-motion user gets no transition at all, and
    // a snap onto the size the panel already has changes no property either.
    // Waiting on the event alone therefore left the class latched on the panel
    // for good and stacked one more listener per gesture, so the wait races a
    // fallback timer — the same guard `MlvOverlayRef` uses for its leave
    // animation. `take(1)` releases the listener on whichever arrives first;
    // `takeUntilDestroyed` releases it if the drawer dies mid-snap.
    //
    // The target filter is load-bearing: `transitionend` bubbles, and the
    // panel holds transitioning descendants — this handle's own
    // `__handle-pill` fades `background-color` on hover/focus in
    // `--mlv-duration-fast`, shorter than the snap's default
    // `--mlv-duration-slow`, and consumer content brings more. Unfiltered, any
    // of them finishing mid-snap won the race and cut the snap short. It sits
    // inside the `race` so an ignored event does not settle it.
    race(
      fromEvent(panel, 'transitionend').pipe(
        filter((event) => event.target === panel),
      ),
      timer(SNAP_TRANSITION_FALLBACK_MS),
    )
      .pipe(take(1), takeUntilDestroyed(this._destroyRef))
      .subscribe(() => panel.classList.remove('mlv-drawer--snapping'));
  }

  /**
   * @private Sets the `--mlv-drawer-current-size` CSS variable on the panel
   * element and updates the ARIA value.
   */
  private _updatePanelSize(
    panel: HTMLElement,
    size: number,
    viewportSize: number,
  ): void {
    panel.style.setProperty('--mlv-drawer-current-size', `${size}px`);
    this._currentPercent.set(Math.round((size / viewportSize) * 100));
  }

  /**
   * @private Re-reads the rendered size after a write so `aria-valuenow`
   * reports the box the user sees rather than the size that was asked for:
   * the panel's `min-width` / `min-height` (`minSize`) and `max-*`
   * (`maxSize`) clamp the box while `--mlv-drawer-current-size` keeps the
   * raw value. One layout read per gesture end or key press, never per
   * pointer move. A zero-sized box (no layout yet) leaves the value alone.
   */
  private _syncPercentToBox(
    panel: HTMLElement,
    isVertical: boolean,
    viewportSize: number,
  ): void {
    const rect = panel.getBoundingClientRect();
    const sizePx = isVertical ? rect.height : rect.width;
    if (sizePx > 0 && viewportSize > 0) {
      this._currentPercent.set(Math.round((sizePx / viewportSize) * 100));
    }
  }

  /**
   * @protected Handles keyboard interaction on the resize handle.
   *
   * Arrow Up / Right — increase by 10% of viewport
   * Arrow Down / Left — decrease by 10% (or dismiss if size would reach zero)
   * Home — snap to smallest snap point (or dismiss if zero)
   * End — snap to largest snap point (or full viewport)
   * Escape — dismiss
   */
  protected _onKeydown(event: KeyboardEvent): void {
    const pos = this.position();
    const isVertical = pos === 'bottom' || pos === 'top';
    const panel = this._getPanelElement();
    if (!panel) return;

    const viewportSize = this._viewportSize(isVertical);
    const currentSizePx = isVertical
      ? panel.getBoundingClientRect().height
      : panel.getBoundingClientRect().width;
    const stepPx = viewportSize * KEYBOARD_STEP_FRACTION;
    const snapPoints = this.snapPoints();
    let newSize: number | null = null;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case UP_ARROW:
      case RIGHT_ARROW:
        newSize = currentSizePx + stepPx;
        break;
      case DOWN_ARROW:
      case LEFT_ARROW:
        newSize = currentSizePx - stepPx;
        if (newSize <= 0) {
          event.preventDefault();
          this.dismissed.emit();
          return;
        }
        break;
      case 'Home':
        if (snapPoints.length > 0) {
          newSize = (viewportSize * snapPoints[0]) / 100;
          if (newSize <= 0) {
            event.preventDefault();
            this.dismissed.emit();
            return;
          }
        }
        break;
      case 'End':
        newSize =
          snapPoints.length > 0
            ? (viewportSize * snapPoints[snapPoints.length - 1]) / 100
            : viewportSize;
        break;
      case 'Escape':
        event.preventDefault();
        this.dismissed.emit();
        return;
      default:
        return;
    }

    if (newSize !== null) {
      event.preventDefault();
      newSize = Math.max(0, Math.min(viewportSize, newSize));
      this._updatePanelSize(panel, newSize, viewportSize);
      this._syncPercentToBox(panel, isVertical, viewportSize);
    }
  }
}
