import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  ViewEncapsulation,
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

  /** @private Reference to the host element. */
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

  /** @protected Whether a drag is in progress. */
  protected readonly _isDragging = signal(false);

  /** @protected Current sidebar width in pixels (for ARIA). */
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
    switch (this._rtlService.normalizeArrowKey(event) ?? event.key) {
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
      const newWidth = event.clientX - sidebarRect.left;
      const isCollapsed = this._context.collapsed();

      if (isCollapsed) {
        // Dragging right from collapsed — mark for expansion on pointerup
        if (newWidth >= this.snapThreshold()) {
          this._shouldExpand = true;
          this._expandWidth = clamp(newWidth, this.minWidth(), this.maxWidth());
        } else {
          this._shouldExpand = false;
        }
      } else if (newWidth < this.snapThreshold()) {
        // Dragging left below threshold — mark for collapse on pointerup
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

  /** @private Adjust width by a delta, clamping to min/max. */
  private _adjustWidth(delta: number): void {
    const current = this._currentWidthPx();
    const next = clamp(current + delta, this.minWidth(), this.maxWidth());
    this._context.setWidth(next);
    this._currentWidthPx.set(next);
  }
}
