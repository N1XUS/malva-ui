import type { ComponentRef } from '@angular/core';
import {
  afterRenderEffect,
  computed,
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
import { AriaDescriber } from '@angular/cdk/a11y';
import type {
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { hasModifierKey } from '@angular/cdk/keycodes';
import {
  MlvRtlService,
  mlvMirrorInlineOffsets,
  mlvNextId,
} from '@malva-ui/cdk/utils';
import { MlvTooltipPanel } from './tooltip-panel';
import type { MlvTooltipTone, MlvTooltipPlacement } from './tooltip.types';

/**
 * Whether a keyboard event is the one Escape a tooltip dismisses on: the
 * Escape key with no modifier held (`hasModifierKey` covers Shift, Alt,
 * Control and Meta), the same key Angular's `(keydown.escape)` matches.
 */
function isDismissEscape(event: Event): boolean {
  const key = event as KeyboardEvent;
  return key.key === 'Escape' && !hasModifierKey(key);
}

/**
 * Map of placement → CDK connected positions (preferred + opposite fallback).
 * Offset of 6px provides clearance for the arrow.
 *
 * Logical throughout: `originX` / `overlayX` are `'start'` / `'end'`, which CDK
 * mirrors against the pane's direction. `offsetX` is **not** mirrored by CDK —
 * it is applied as raw physical pixels — so `_show()` passes the list through
 * `mlvMirrorInlineOffsets` first (#180), and the `-6` on `left` reads as "6px
 * away from the trigger, toward inline-start" in both directions. `offsetY` is
 * the block axis and needs nothing.
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
 * The tooltip appears after `tooltipDelay` ms and disappears on mouseleave
 * (after a short grace period), on focusout, or on Escape.
 *
 * Escape dismisses a visible tooltip wherever focus is — a hover-shown tooltip
 * included (WCAG 1.4.13) — and dismisses **only** the tooltip: the keystroke is
 * consumed, so a dialog, drawer or popup the host sits in stays open until the
 * next Escape. It arrives through the overlay's `keydownEvents()`, so CDK's
 * keyboard dispatcher hands it to the topmost overlay: an overlay opened above
 * the tooltip takes Escape first. With focus on the host, that same Escape
 * also hides the tooltip. Every other key — Escape with a modifier held
 * included — passes the tooltip by and reaches the overlay below it.
 *
 * The text also describes the host from the first render, not from the moment
 * the bubble appears: CDK's `AriaDescriber` appends one id to whatever
 * `aria-describedby` the host already carries and removes only that id on
 * destroy, so a screen reader reaching the host by focus hears it at once and
 * the host's own description is never replaced. The id names a visually
 * hidden element in a container on `<body>`, shared by every host with the
 * same text; the visible bubble is `aria-hidden`, so the text is read once.
 * Empty (or whitespace-only) content shows no bubble and describes nothing,
 * and neither does a disabled tooltip. A host whose `aria-label` already
 * equals the text gets no description, since it would only repeat the name.
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

  /** @private Renderer for the panel's pointer listeners. */
  private readonly _renderer = inject(Renderer2);

  /** @private Zone for running timer callbacks inside change detection. */
  private readonly _ngZone = inject(NgZone);

  /** @private DestroyRef for cleanup on directive destruction. */
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private Registers the text as the host's description. Root-provided and
   * shared: it keeps one visually hidden element per distinct text in a
   * container on `<body>`, reference-counted across hosts, and adds or removes
   * only its own id in the host's `aria-describedby`.
   */
  private readonly _ariaDescriber = inject(AriaDescriber);

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /**
   * The tooltip text content.
   * This is also the directive selector binding: `[mlvTooltip]="'my text'"`.
   * Empty or whitespace-only text shows no tooltip and adds no description.
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
   * @private Timer handle for the fallback `_onEscape()` arms when Escape is
   * pressed on the host while the tooltip is visible. Cleared by `_hide()`,
   * so it only ever fires for a tooltip the keystroke left on screen.
   */
  private _escapeFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @private Grace period (ms) before hiding on mouseleave, allowing the pointer
   * to reach the hoverable tooltip panel without it disappearing.
   */
  private readonly _hideDelay = 150;

  /**
   * @private Cleanup functions for everything wired to the current overlay —
   * the panel hover listeners and the Escape subscription. Their lifetime is
   * one show, not the directive's, so `_hide()` runs and clears them.
   */
  private _overlayTeardowns: (() => void)[] = [];

  /**
   * @private Stable unique ID for this tooltip instance, stamped on the panel.
   * Nothing references it: the host is described by `AriaDescriber`'s element.
   */
  private readonly _tooltipId = mlvNextId('mlv-tooltip');

  /**
   * @private The tooltip text without surrounding whitespace. Empty means
   * there is nothing to say: `_show()` returns early and the host gets no
   * description. The `?? ''` is for templates compiled without strict input
   * checks, where a `null` can still reach a `string` input — it used to
   * render an empty bubble and must not throw here instead.
   */
  private readonly _message = computed(() => (this.mlvTooltip() ?? '').trim());

  constructor() {
    this._destroyRef.onDestroy(() => {
      this._clearShowTimer();
      this._clearHideTimer();
      this._hide();
    });

    // Describe the host from its first render (D12), not from the moment the
    // panel attaches. `afterRenderEffect`, not `effect`, for two reasons:
    //  - It runs after the whole render, so a host binding on the same element
    //    — a co-hosted directive's, or the host component's own
    //    (`mlv-radio-group`, `fieldset[mlvFieldset]`) — has been written first.
    //    Angular writes an element's host bindings after the effects of the
    //    view it sits in, so from a plain `effect` the token would be appended
    //    and then overwritten by that binding (a template binding is written
    //    before the view's effects either way). The same holds for the
    //    `aria-label` `AriaDescriber` compares the text against.
    //  - It never runs on the server. `AriaDescriber` ids carry a per-process
    //    counter and its container is replaced on the client, so an id written
    //    into server markup would dangle on the claimed node after hydration.
    // Re-runs when the text or `tooltipDisabled` changes; the cleanup removes
    // the previous text's id first, and runs once more on destroy. It first
    // runs when the host's view is first refreshed: a view detached before its
    // first change detection never describes its host, and inside
    // `@defer (hydrate on …)` the description arrives when the block hydrates.
    afterRenderEffect((onCleanup) => {
      const message = this.tooltipDisabled() ? '' : this._message();
      if (!message) return;
      const host = this._elementRef.nativeElement;
      this._ariaDescriber.describe(host, message);
      onCleanup(() => this._ariaDescriber.removeDescription(host, message));
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

  /**
   * @protected Handles Escape pressed on the host: cancels a pending show and,
   * when the tooltip is visible, arms a fallback that hides it once the
   * keystroke has finished dispatching.
   *
   * It deliberately does **not** hide synchronously. Dismissing a visible
   * tooltip is `_onOverlayEscape()`'s job, reached through CDK's keyboard
   * dispatcher on `<body>`; hiding here would dispose the overlay before the
   * keystroke bubbles there, and the dispatcher would then hand it to the
   * overlay below — closing the dialog the host sits in on the same press.
   *
   * The fallback covers the two ways that keystroke can leave the tooltip up:
   * an overlay opened above it took the key (a popup opened from the host,
   * with focus left on the host), or an ancestor stopped its propagation
   * before it reached `<body>`. Both hid the tooltip before the dispatcher
   * route existed, and still do. A zero-delay task runs after the whole
   * dispatch, which is synchronous; a microtask would not, since microtasks
   * run between the listeners of a trusted event.
   */
  protected _onEscape(): void {
    this._clearShowTimer();
    if (!this._overlayRef) return;
    this._clearEscapeFallback();
    this._escapeFallbackTimer = setTimeout(() => {
      this._escapeFallbackTimer = null;
      this._ngZone.run(() => this._hide());
    }, 0);
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
   * @private Clears the pending Escape fallback if one is armed.
   */
  private _clearEscapeFallback(): void {
    if (this._escapeFallbackTimer !== null) {
      clearTimeout(this._escapeFallbackTimer);
      this._escapeFallbackTimer = null;
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
   * @private Creates the CDK overlay and attaches `MlvTooltipPanel`. A no-op
   * while the tooltip is already visible, and when the text is empty or
   * whitespace-only — there is nothing to show. The host's description is not
   * touched here: the constructor's `afterRenderEffect` registers it from the
   * first render, whether or not the bubble is ever shown.
   */
  private _show(): void {
    if (this._overlayRef || !this._message()) return;

    const placement = this.tooltipPlacement();
    // The pane is portaled to <body>, outside any `[dir]` scope the trigger
    // sits in, so the direction is resolved here and used for both halves of
    // the geometry: CDK mirrors `start`/`end` against the pane's direction, but
    // leaves `offsetX` physical, so the arrow clearance has to be mirrored
    // against the same value or the two disagree — see `mlvMirrorInlineOffsets`.
    const direction = this._rtl.resolveDirection(this._elementRef);
    const positions = mlvMirrorInlineOffsets(
      TOOLTIP_POSITIONS[placement],
      direction,
    );

    const positionStrategy = this._overlay
      .position()
      .flexibleConnectedTo(this._elementRef)
      .withPositions(positions)
      .withPush(false) as FlexibleConnectedPositionStrategy;

    this._overlayRef = this._overlay.create({
      positionStrategy,
      direction,
      scrollStrategy: this._overlay.scrollStrategies.reposition(),
      panelClass: 'mlv-tooltip-overlay',
      // CDK's keyboard dispatcher hands a keydown to the topmost overlay that
      // has any `keydownEvents()` observer and stops there, before a filter
      // in that stream could look at the key. Without this predicate the
      // tooltip would swallow every key while visible — Enter, Ctrl+S or
      // Shift+Escape meant for a dialog, drawer or popup below it. Non-keydown
      // events pass untouched; the tooltip observes no outside pointer events.
      eventPredicate: (event) =>
        event.type !== 'keydown' || isDismissEscape(event),
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
    this._overlayTeardowns.push(
      this._renderer.listen(overlayEl, 'mouseenter', () =>
        this._clearHideTimer(),
      ),
      this._renderer.listen(overlayEl, 'mouseleave', () =>
        this._scheduleHide(),
      ),
    );

    // Escape dismisses the tooltip wherever focus is (WCAG 1.4.13). Having an
    // observer on `keydownEvents()` is what makes CDK's keyboard dispatcher
    // stop at this overlay instead of skipping to the one below it; the
    // `eventPredicate` above admits only an unmodified Escape, so that is all
    // this stream ever carries.
    const escape = this._overlayRef
      .keydownEvents()
      .subscribe((event) => this._onOverlayEscape(event));
    this._overlayTeardowns.push(() => escape.unsubscribe());
  }

  /**
   * @private Dismisses the visible tooltip on an Escape the keyboard dispatcher
   * routed to its overlay, and consumes the keystroke: `preventDefault()`
   * marks it handled, `stopPropagation()` keeps it from listeners above
   * `<body>`, and the dispatcher itself delivers it to no overlay below. So
   * the first Escape closes only the tooltip, never its container (D13, the
   * APG tooltip pattern). The pending show is cleared too, or a hover that
   * re-entered the trigger while the tooltip was up would bring it straight
   * back.
   */
  private _onOverlayEscape(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this._clearShowTimer();
    this._hide();
  }

  /**
   * @private Disposes the CDK overlay and drops the component reference. The
   * host's description outlives the bubble: it stays registered until the
   * text empties, the tooltip is disabled, or the directive is destroyed.
   */
  private _hide(): void {
    this._clearHideTimer();
    this._clearEscapeFallback();
    this._overlayTeardowns.forEach((teardown) => teardown());
    this._overlayTeardowns = [];
    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
    }
    this._componentRef = null;
  }
}
