import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, fromEvent, take, takeUntil } from 'rxjs';
import { LEFT_ARROW, RIGHT_ARROW } from '@angular/cdk/keycodes';
import { MlvRtlService, clamp } from '@malva-ui/cdk/utils';
import { SIDEBAR_CONTEXT } from '../sidebar-context';

@Component({
  selector: 'mlv-sidebar-rail',
  template: '',
  styleUrl: './sidebar-rail.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-sidebar-rail',
    '[class.mlv-sidebar-rail--dragging]': '_isDragging()',
    role: 'separator',
    'aria-orientation': 'vertical',
    tabindex: '0',
    'aria-label': 'Resize sidebar',
    '[attr.aria-valuetext]': '_currentWidthPx() + "px"',
    '[attr.aria-valuenow]': '_currentWidthPx()',
    '[attr.aria-valuemin]': 'minWidth()',
    '[attr.aria-valuemax]': 'maxWidth()',
    '(pointerdown)': '_onPointerDown($event)',
    '(dblclick)': '_onDoubleClick()',
    '(keydown)': '_onKeydown($event)',
  },
})
export class MlvSidebarRail {
  /** Minimum sidebar width in px during drag. */
  readonly minWidth = input(200);

  /** Maximum sidebar width in px during drag. */
  readonly maxWidth = input(480);

  /** Width below which the sidebar snaps to collapsed. */
  readonly snapThreshold = input(100);

  /** @private Sidebar context for reading/writing state. */
  private readonly _context = inject(SIDEBAR_CONTEXT);

  /**
   * @private Host element. Both direction-sensitive halves of this rail — the
   * sidebar it resolves for a drag and the arrow-key stepping — read it, so
   * they can never disagree about which direction applies.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Angular zone for running outside zone during drag. */
  private readonly _ngZone = inject(NgZone);

  /** @private Destroy reference for cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private The document the drag listeners are bound to. Injected rather
   * than the ambient global: under server rendering the two are different
   * objects and the global is defined, so an ambient `document` binds a
   * per-render component to a process-wide object no teardown reaches.
   */
  private readonly _document = inject(DOCUMENT);
  /** @private Normalizes horizontal resize arrows for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Direction applying to this rail, resolved once and cached behind
   * the shared `dir` observer rather than re-walked on every arrow keypress.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /** @protected Whether a drag is in progress. */
  protected readonly _isDragging = signal(false);

  /**
   * @protected Current sidebar width in pixels — the `aria-valuenow` and the
   * base every keyboard step starts from. Seeded from the sidebar's rendered
   * width after the first render and re-read before each keyboard step, so a
   * `<mlv-sidebar width="320px">` reports 320, not a constant. `260` (the
   * sidebar's default `width`) is only the fallback while nothing is laid out:
   * during a server render, while the sidebar starts collapsed, or when the
   * rail is not inside a `.mlv-sidebar`.
   */
  protected readonly _currentWidthPx = signal(260);

  /** @private Sidebar container element reference, resolved on first drag. */
  private _sidebarEl: HTMLElement | null = null;

  /** @private Stored transition value to restore after drag. */
  private _savedTransition = '';

  /**
   * @private Teardown for the listeners of the drag currently in progress, or
   * `null` between drags. Replacing it is what makes a re-entrant
   * `pointerdown` idempotent — the previous gesture's streams are unsubscribed
   * before the next pair is created, so a second contact cannot stack a second
   * set of listeners.
   */
  private _dragSubscription: Subscription | null = null;

  /** @private Animation frame ID for drag throttle. */
  private _rafId = 0;

  /** @private Whether to snap to collapsed on pointerup. */
  private _shouldSnap = false;

  /** @private Whether to expand from collapsed on pointerup. */
  private _shouldExpand = false;

  /** @private Width to apply after expanding from collapsed state. */
  private _expandWidth = 0;

  constructor() {
    // Browser-only by construction, so a server render keeps the fallback.
    // `mixedReadWrite`, not `read`: the measurement writes the sidebar's inline
    // `transition` around the rect read, and the result lands in a signal.
    afterNextRender({
      mixedReadWrite: () => {
        if (this._context.collapsed()) return;
        const width = this._measureSidebarWidth();
        if (width !== null) this._currentWidthPx.set(width);
      },
    });

    this._destroyRef.onDestroy(() => {
      this._cleanup();
    });
  }

  /** @protected Handle double-click to toggle collapsed state. */
  protected _onDoubleClick(): void {
    this._context.toggle();
  }

  /** @protected Handle keyboard navigation. */
  protected _onKeydown(event: KeyboardEvent): void {
    const step = 10;
    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case LEFT_ARROW:
        event.preventDefault();
        if (!this._context.collapsed()) {
          this._adjustWidth(-step);
        }
        break;
      case RIGHT_ARROW:
        event.preventDefault();
        if (this._context.collapsed()) {
          this._context.toggle();
        } else {
          this._adjustWidth(step);
        }
        break;
      case 'Home':
        event.preventDefault();
        if (!this._context.collapsed()) {
          this._context.toggle();
        }
        break;
      case 'End':
        event.preventDefault();
        if (this._context.collapsed()) {
          this._context.toggle();
        }
        break;
    }
  }

  /** @protected Handle pointer down to start drag. */
  protected _onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this._isDragging.set(true);
    this._shouldSnap = false;
    this._shouldExpand = false;
    this._expandWidth = 0;

    // Width is owned by the sidebar host so its border, gutter, and content
    // stay in one box-model calculation during resize and collapse.
    this._sidebarEl = this._elementRef.nativeElement.closest(
      '.mlv-sidebar',
    ) as HTMLElement | null;

    if (this._sidebarEl) {
      this._savedTransition = this._sidebarEl.style.transition;
      this._sidebarEl.style.transition = 'none';
      this._currentWidthPx.set(this._sidebarEl.getBoundingClientRect().width);
    }

    this._elementRef.nativeElement.setPointerCapture(event.pointerId);

    // A drag protocol, so the listeners take the scoped form: `takeUntil` for
    // the gesture, `takeUntilDestroyed` so a rail destroyed mid-drag still
    // releases them. Both are needed — `takeUntilDestroyed` alone would keep
    // `pointermove` bound to the document for the component's whole life.
    // The `DestroyRef` is passed explicitly because this runs from an event
    // handler, which is not an injection context.
    //
    // `_cleanup()` unsubscribes as well, so the four exits it already serves
    // (pointerup, destroy, and a re-entrant pointerdown) all converge on one
    // idempotent teardown; `unsubscribe()` on a closed `Subscription` is a
    // no-op, which is what the stable bound handler references used to buy.
    this._cleanup();
    const pointerUp$ = fromEvent<PointerEvent>(this._document, 'pointerup');
    this._ngZone.runOutsideAngular(() => {
      const subscription = new Subscription();
      subscription.add(
        fromEvent<PointerEvent>(this._document, 'pointermove')
          .pipe(takeUntil(pointerUp$), takeUntilDestroyed(this._destroyRef))
          .subscribe((moveEvent) => this._onPointerMove(moveEvent)),
      );
      subscription.add(
        pointerUp$
          .pipe(take(1), takeUntilDestroyed(this._destroyRef))
          .subscribe((upEvent) => this._onPointerUp(upEvent)),
      );
      this._dragSubscription = subscription;
    });

    this._document.body.style.userSelect = 'none';
    this._document.body.style.cursor = 'col-resize';
  }

  /** @private Handle pointer move during drag. */
  private _onPointerMove(event: PointerEvent): void {
    const sidebarEl = this._sidebarEl;
    if (!sidebarEl) return;

    if (this._rafId) cancelAnimationFrame(this._rafId);

    this._rafId = requestAnimationFrame(() => {
      const sidebarRect = sidebarEl.getBoundingClientRect();
      // `clientX` and the rect are physical. The rail rides the sidebar's
      // inline-end edge — its physical left edge in RTL — so the width is the
      // distance from the inline-start edge, converted once here.
      const newWidth =
        this._direction() === 'rtl'
          ? sidebarRect.right - event.clientX
          : event.clientX - sidebarRect.left;
      const isCollapsed = this._context.collapsed();

      if (isCollapsed) {
        // Dragging outward from collapsed — mark for expansion on pointerup
        if (newWidth >= this.snapThreshold()) {
          this._shouldExpand = true;
          this._expandWidth = clamp(newWidth, this.minWidth(), this.maxWidth());
        } else {
          this._shouldExpand = false;
        }
      } else if (newWidth < this.snapThreshold()) {
        // Dragging inward below threshold — mark for collapse on pointerup
        this._shouldSnap = true;
      } else {
        this._shouldSnap = false;
        const clamped = clamp(newWidth, this.minWidth(), this.maxWidth());
        this._ngZone.run(() => {
          this._context.setWidth(clamped);
          this._currentWidthPx.set(clamped);
        });
      }
    });
  }

  /** @private Handle pointer up to end drag. */
  private _onPointerUp(_event: PointerEvent): void {
    this._cleanup();

    if (this._sidebarEl) {
      this._sidebarEl.style.transition = this._savedTransition;
    }

    this._ngZone.run(() => {
      this._isDragging.set(false);

      if (this._shouldSnap) {
        this._context.toggle();
      } else if (this._shouldExpand) {
        this._context.toggle();
        this._context.setWidth(this._expandWidth);
        this._currentWidthPx.set(this._expandWidth);
      }
    });
  }

  /**
   * @private Release the drag listeners and reset drag state. Idempotent — it
   * is the single exit for pointerup, destroy, and a re-entrant pointerdown.
   */
  private _cleanup(): void {
    this._dragSubscription?.unsubscribe();
    this._dragSubscription = null;
    this._document.body.style.userSelect = '';
    this._document.body.style.cursor = '';
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  /**
   * @private Adjust width by a delta, clamping to min/max. Steps from the
   * sidebar's rendered width, so a width set from outside since the last
   * interaction (the consumer's `width` binding) is not stepped over.
   */
  private _adjustWidth(delta: number): void {
    const current = this._measureSidebarWidth() ?? this._currentWidthPx();
    const next = clamp(current + delta, this.minWidth(), this.maxWidth());
    this._context.setWidth(next);
    this._currentWidthPx.set(next);
  }

  /**
   * @private The enclosing sidebar's rendered width in px, or `null` while it
   * is not laid out (no `.mlv-sidebar` ancestor, `display: none`, a server
   * render). The width transition is suppressed for the read — the same thing
   * a drag does at pointerdown — so a read taken while the sidebar is still
   * animating open reports the width it is settling on, not a frame of the
   * animation (a mid-expand frame is under `minWidth`, and stepping from it
   * would clamp the sidebar down to the minimum). Measured in Chromium on a
   * 400ms replica of the transition (the sidebar's own runs
   * `--mlv-duration-normal`): 100ms into a 56→260px expand a plain read gives
   * 76, this one 260. The cost is that a running transition is cancelled and
   * lands on its end value — reachable by an arrow key pressed mid-animation
   * (which sets a new width in the same handler anyway) or by the rail's first
   * render landing inside one. Rounded to whole pixels, so a percentage width
   * (`22.5%` of a 1517px shell is 341.325px) does not surface a fractional
   * `aria-valuenow` at rest.
   */
  private _measureSidebarWidth(): number | null {
    const sidebarEl = this._elementRef.nativeElement.closest(
      '.mlv-sidebar',
    ) as HTMLElement | null;
    if (!sidebarEl) return null;
    const savedTransition = sidebarEl.style.transition;
    sidebarEl.style.transition = 'none';
    const width = Math.round(sidebarEl.getBoundingClientRect().width);
    sidebarEl.style.transition = savedTransition;
    return width > 0 ? width : null;
  }
}
