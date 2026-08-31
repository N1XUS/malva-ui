import type { ComponentRef } from '@angular/core';
import {
  DestroyRef,
  Directive,
  ElementRef,
  EnvironmentInjector,
  inject,
  input,
  NgZone,
  Renderer2,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvRtlService, mlvNextId } from '@malva-ui/cdk/utils';
import { MlvTooltipPanel } from './tooltip-panel';
import type { MlvTooltipTone, MlvTooltipPlacement } from './tooltip.types';

/**
 * Map of placement → CDK connected positions (preferred + opposite fallback).
 * Offset of 6px provides clearance for the arrow.
 */
const TOOLTIP_POSITIONS: Record<MlvTooltipPlacement, ConnectedPosition[]> = {
  top: [
    {
      originX: 'center',
      originY: 'top',
      overlayX: 'center',
      overlayY: 'bottom',
      offsetY: -6,
    },
    {
      originX: 'center',
      originY: 'bottom',
      overlayX: 'center',
      overlayY: 'top',
      offsetY: 6,
    },
  ],
  bottom: [
    {
      originX: 'center',
      originY: 'bottom',
      overlayX: 'center',
      overlayY: 'top',
      offsetY: 6,
    },
    {
      originX: 'center',
      originY: 'top',
      overlayX: 'center',
      overlayY: 'bottom',
      offsetY: -6,
    },
  ],
  left: [
    {
      originX: 'start',
      originY: 'center',
      overlayX: 'end',
      overlayY: 'center',
      offsetX: -6,
    },
    {
      originX: 'end',
      originY: 'center',
      overlayX: 'start',
      overlayY: 'center',
      offsetX: 6,
    },
  ],
  right: [
    {
      originX: 'end',
      originY: 'center',
      overlayX: 'start',
      overlayY: 'center',
      offsetX: 6,
    },
    {
      originX: 'start',
      originY: 'center',
      overlayX: 'end',
      overlayY: 'center',
      offsetX: -6,
    },
  ],
};

/**
 * Derives effective tooltip placement from the CDK resolved position pair.
 * Used to update the arrow direction when CDK flips to the fallback placement.
 */
function resolvePlacementFromPosition(
  pos: ConnectedPosition,
): MlvTooltipPlacement {
  if (pos.overlayY === 'bottom') return 'top';
  if (pos.overlayY === 'top') return 'bottom';
  if (pos.overlayX === 'end') return 'left';
  return 'right';
}

/**
 * Tooltip directive — attach to any element to show a tooltip on hover and focus.
 *
 * The tooltip content is passed as the directive binding value (`mlvTooltip`).
 * The tooltip appears after `tooltipDelay` ms and disappears immediately on
 * mouseleave, focusout, or Escape key.
 *
 * @example Basic usage
 * ```html
 * <button [mlvTooltip]="'Save changes'">Save</button>
 * ```
 *
 * @example With options
 * ```html
 * <button
 *   [mlvTooltip]="'Delete item'"
 *   tooltipPlacement="bottom"
 *   tooltipTone="danger"
 *   [tooltipDelay]="500"
 * >Delete</button>
 * ```
 *
 * @example Disabled tooltip
 * ```html
 * <button [mlvTooltip]="'Info'" tooltipDisabled>Button</button>
 * ```
 *
 * @example No arrow
 * ```html
 * <button [mlvTooltip]="'Info'" [tooltipArrow]="false">Button</button>
 * ```
 */
@Directive({
  selector: '[mlvTooltip]',
  host: {
    '(mouseenter)': '_onMouseEnter()',
    '(mouseleave)': '_onMouseLeave()',
    '(focusin)': '_onFocusIn()',
    '(focusout)': '_onFocusOut()',
    '(keydown.escape)': '_onEscape()',
  },
})
export class MlvTooltip {
  // ─── Injected services ────────────────────────────────────────────────────

  /** @private Host element reference. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private CDK Overlay for creating floating panels. */
  private readonly _overlay = inject(Overlay);

  /**
   * @private Resolves the direction scoped to the tooltip's host. The panel is
   * portaled to the overlay container on `<body>`, outside any `[dir]` scope
   * the host sits in, so the direction must travel on the overlay config — it
   * also drives `start`/`end` mirroring in the position strategy.
   */
  private readonly _rtl = inject(MlvRtlService);

  /** @private Environment injector, required for ComponentPortal creation. */
  private readonly _injector = inject(EnvironmentInjector);

  /** @private Renderer for DOM attribute manipulation. */
  private readonly _renderer = inject(Renderer2);

  /** @private Zone for running timer callbacks inside change detection. */
  private readonly _ngZone = inject(NgZone);

  /** @private DestroyRef for cleanup on directive destruction. */
  private readonly _destroyRef = inject(DestroyRef);

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /**
   * The tooltip text content.
   * This is also the directive selector binding: `[mlvTooltip]="'my text'"`.
   */
  readonly mlvTooltip = input.required<string>();

  /** Preferred placement of the tooltip relative to the trigger. Defaults to `'top'`. */
  readonly tooltipPlacement = input<MlvTooltipPlacement>('top');

  /** Tone variant of the tooltip panel. Defaults to `'neutral'` (fixed dark neutral background). */
  readonly tooltipTone = input<MlvTooltipTone>('neutral');

  /**
   * Delay in milliseconds before the tooltip appears after hover or focus.
   * Defaults to `300`.
   */
  readonly tooltipDelay = input<number>(300);

  /**
   * When `true`, suppresses the tooltip entirely.
   * Supports attribute syntax: `<element tooltipDisabled>`.
   */
  readonly tooltipDisabled = input<BooleanInput, boolean | string>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true` (default), renders a directional arrow pointing toward the trigger.
   * Set to `false` to hide the arrow.
   * Supports attribute syntax: `<element [tooltipArrow]="false">`.
   */
  readonly tooltipArrow = input<BooleanInput, boolean | string>(true, {
    transform: coerceBooleanProperty,
  });

  // ─── Private state ────────────────────────────────────────────────────────

  /**
   * @private Reference to the dynamically created `MlvTooltipPanel` instance.
   */
  private _componentRef: ComponentRef<MlvTooltipPanel> | null = null;

  /**
   * @private CDK overlay reference managing the floating panel.
   */
  private _overlayRef: OverlayRef | null = null;

  /**
   * @private Timer handle for the `tooltipDelay` show timer.
   */
  private _showTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @private Timer handle for the grace-period hide timer. Gives the pointer
   * time to travel from the trigger onto the tooltip panel (WCAG 1.4.13).
   */
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @private Grace period (ms) before hiding on mouseleave, allowing the pointer
   * to reach the hoverable tooltip panel without it disappearing.
   */
  private readonly _hideDelay = 150;

  /**
   * @private Cleanup functions for the panel hover listeners, invoked on hide.
   */
  private _panelListeners: (() => void)[] = [];

  /**
   * @private Stable unique ID for this tooltip instance, used by `aria-describedby`.
   */
  private readonly _tooltipId = mlvNextId('mlv-tooltip');

  constructor() {
    this._destroyRef.onDestroy(() => {
      this._clearShowTimer();
      this._clearHideTimer();
      this._hide();
    });
  }

  // ─── Protected host event handlers ────────────────────────────────────────

  /** @protected Schedules tooltip display on mouseenter. */
  protected _onMouseEnter(): void {
    if (this.tooltipDisabled()) return;
    this._clearHideTimer();
    this._scheduleShow();
  }

  /**
   * @protected Cancels pending show and schedules a delayed hide on mouseleave.
   * The grace period lets the pointer move onto the tooltip panel without it
   * disappearing (WCAG 1.4.13 — content on hover must be hoverable).
   */
  protected _onMouseLeave(): void {
    this._clearShowTimer();
    this._scheduleHide();
  }

  /** @protected Schedules tooltip display on focusin (keyboard users). */
  protected _onFocusIn(): void {
    if (this.tooltipDisabled()) return;
    this._scheduleShow();
  }

  /** @protected Cancels pending show and hides tooltip on focusout. */
  protected _onFocusOut(): void {
    this._clearShowTimer();
    this._hide();
  }

  /** @protected Cancels pending show and hides tooltip on Escape key. */
  protected _onEscape(): void {
    this._clearShowTimer();
    this._hide();
  }

  // ─── Private implementation ───────────────────────────────────────────────

  /**
   * @private Schedules tooltip display after `tooltipDelay` ms inside NgZone.
   */
  private _scheduleShow(): void {
    this._clearShowTimer();
    const delay = this.tooltipDelay();
    this._showTimer = setTimeout(() => {
      this._ngZone.run(() => this._show());
    }, delay);
  }

  /**
   * @private Clears the pending show timer if one is active.
   */
  private _clearShowTimer(): void {
    if (this._showTimer !== null) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
  }

  /**
   * @private Schedules the tooltip to hide after the `_hideDelay` grace period.
   */
  private _scheduleHide(): void {
    this._clearHideTimer();
    this._hideTimer = setTimeout(() => {
      this._ngZone.run(() => this._hide());
    }, this._hideDelay);
  }

  /**
   * @private Clears the pending hide timer if one is active.
   */
  private _clearHideTimer(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }

  /**
   * @private Creates the CDK overlay, attaches `MlvTooltipPanel`, and wires
   * `aria-describedby` on the host element. If the tooltip is already visible
   * this method is a no-op.
   */
  private _show(): void {
    if (this._overlayRef) return;

    const placement = this.tooltipPlacement();
    const positions = TOOLTIP_POSITIONS[placement];

    const positionStrategy = this._overlay
      .position()
      .flexibleConnectedTo(this._elementRef)
      .withPositions(positions)
      .withPush(false) as FlexibleConnectedPositionStrategy;

    this._overlayRef = this._overlay.create({
      positionStrategy,
      direction: this._rtl.resolveDirection(this._elementRef),
      scrollStrategy: this._overlay.scrollStrategies.reposition(),
      panelClass: 'mlv-tooltip-overlay',
    });

    // Attach the component via a ComponentPortal with the environment injector
    const portal = new ComponentPortal(MlvTooltipPanel, null, this._injector);
    const componentRef = this._overlayRef.attach(portal);

    componentRef.setInput('content', this.mlvTooltip());
    componentRef.setInput('tone', this.tooltipTone());
    componentRef.setInput('showArrow', this.tooltipArrow());
    componentRef.setInput('placement', placement);
    componentRef.setInput('tooltipId', this._tooltipId);

    this._componentRef = componentRef;

    // Update the arrow direction when CDK resolves the actual position
    positionStrategy.positionChanges
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((change) => {
        const resolvedPlacement = resolvePlacementFromPosition(
          change.connectionPair,
        );
        this._componentRef?.setInput('placement', resolvedPlacement);
      });

    // Keep the tooltip open while the pointer is over the panel, and hide it
    // (after the grace period) once the pointer leaves the panel. This makes the
    // hover content hoverable per WCAG 1.4.13.
    const overlayEl = this._overlayRef.overlayElement;
    this._panelListeners.push(
      this._renderer.listen(overlayEl, 'mouseenter', () =>
        this._clearHideTimer(),
      ),
      this._renderer.listen(overlayEl, 'mouseleave', () =>
        this._scheduleHide(),
      ),
    );

    // Wire aria-describedby for accessibility
    this._renderer.setAttribute(
      this._elementRef.nativeElement,
      'aria-describedby',
      this._tooltipId,
    );
  }

  /**
   * @private Disposes the CDK overlay, destroys the component reference, and
   * removes `aria-describedby` from the host element.
   */
  private _hide(): void {
    this._clearHideTimer();
    this._panelListeners.forEach((unlisten) => unlisten());
    this._panelListeners = [];
    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
    }
    this._componentRef = null;
    this._renderer.removeAttribute(
      this._elementRef.nativeElement,
      'aria-describedby',
    );
  }
}
