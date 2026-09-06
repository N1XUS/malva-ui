import type { ElementRef, TemplateRef, ViewContainerRef } from '@angular/core';
import { Injectable, NgZone, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { fromEvent } from 'rxjs';
import type {
  OverlayRef,
  ConnectedPosition,
  ConnectedOverlayPositionChange,
  FlexibleConnectedPositionStrategy,
  FlexibleConnectedPositionStrategyOrigin,
} from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import type { MlvDirection } from '@malva-ui/cdk/utils';
import type { MlvPopupPositionName } from './popup-positions';
import { MlvPopupPositionResolver, POPUP_POSITIONS } from './popup-positions';

/**
 * Controls what happens to the popup when the user scrolls.
 *
 * - `'reposition'` (default) — the overlay repositions with the trigger as the page scrolls.
 * - `'close'` — the overlay closes as soon as the user scrolls.
 * - `'block'` — scroll is blocked while the overlay is open.
 * - `'noop'` — the overlay stays fixed at its original position; no repositioning or closing.
 */
export type MlvPopupScrollStrategy = 'reposition' | 'close' | 'block' | 'noop';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Size constraints passed to the CDK overlay on creation. */
export interface MlvPopupSizeConfig {
  /** Explicit panel width (CSS value or pixel number). */
  width?: number | string;
  /** Explicit panel height (CSS value or pixel number). */
  height?: number | string;
  /** Minimum panel width. */
  minWidth?: number | string;
  /** Minimum panel height. */
  minHeight?: number | string;
  /** Maximum panel width. */
  maxWidth?: number | string;
  /** Maximum panel height. */
  maxHeight?: number | string;
}

/** Configuration object passed to {@link MlvPopupService.open}. */
export interface MlvPopupOpenConfig {
  /**
   * The element the overlay belongs to.
   *
   * Used to position the overlay, to resolve the direction the portaled pane
   * inherits, and as the anchor a direction watch is scoped to. Pass
   * {@link positionOrigin} as well to keep this element's `[dir]` scope and
   * focus ownership while positioning against something else.
   */
  origin: ElementRef;
  /**
   * Overrides what the overlay is *positioned* against, leaving {@link origin}
   * to own direction resolution.
   *
   * Accepts anything CDK's `flexibleConnectedTo` does, including a bare
   * `{ x, y }` viewport point — the context-menu case, where the panel is
   * anchored to the cursor rather than to the element that owns the menu. A
   * point carries no `[dir]` scope of its own, which is exactly why direction
   * still comes from {@link origin}.
   */
  positionOrigin?: FlexibleConnectedPositionStrategyOrigin;
  /** The `<ng-template>` to render inside the overlay. */
  template: TemplateRef<unknown>;
  /** The `ViewContainerRef` used to instantiate the portal. */
  vcr: ViewContainerRef;
  /**
   * Ordered list of CDK `ConnectedPosition` objects the overlay will try in
   * sequence until one fits within the viewport.
   *
   * Use {@link MlvPopupService.resolvePositions} to build this list from named
   * positions when working programmatically.
   */
  positions: ConnectedPosition[];
  /** Optional size constraints applied to the overlay panel. */
  size?: MlvPopupSizeConfig;
  /**
   * When `true`, the overlay is rendered as a full-screen mobile sheet:
   * a global (viewport-filling) position strategy replaces the connected
   * strategy, a solid backdrop is always shown, page scroll is locked
   * (block scroll strategy), and the connected {@link positions}/{@link size}
   * are ignored. Defaults to `false` (trigger-anchored behaviour).
   */
  fullscreen?: boolean;
  /**
   * When `true` (default), a transparent CDK backdrop is created; clicking it
   * triggers `onRequestClose`.
   *
   * When `false`, no visual backdrop is rendered, but click-outside detection
   * is preserved via a document-level click listener (attached after a
   * `setTimeout(0)` to avoid catching the opening click). Escape key closure
   * is always active regardless of this flag.
   */
  hasBackdrop?: boolean;
  /** Optional CDK backdrop class. Defaults to `cdk-overlay-transparent-backdrop`. */
  backdropClass?: string;
  /**
   * Controls overlay behaviour when the page is scrolled.
   * Defaults to `'reposition'`.
   */
  scrollStrategy?: MlvPopupScrollStrategy;
  /** Allow the overlay to grow in the axis constrained by the viewport. */
  flexibleDimensions?: boolean;
  /**
   * Extra elements treated as "inside" the popup for click-outside detection
   * (backdrop-less mode only). A click within any of these — in addition to the
   * overlay panel itself — does not trigger `onRequestClose`. Typically the
   * trigger/anchor element, which lives outside the floating overlay panel.
   */
  dismissExcludeElements?: readonly HTMLElement[];
  /** Called after the overlay is fully disposed. */
  onClose: () => void;
  /**
   * Called when the user requests closure (backdrop click, Escape key).
   * Defaults to `onClose` when not provided.
   */
  onRequestClose?: () => void;
  /**
   * Called each time CDK selects a different `ConnectedPosition`, and again
   * whenever the pane's direction flips while the overlay is open.
   *
   * `direction` is the pane's own — read back off the overlay, which is what
   * `FlexibleConnectedPositionStrategy` mirrored `start` / `end` against when
   * it produced `change.connectionPair`. Anything deriving a **physical** side
   * from that logical pair (the popup's arrow) needs both halves, and taking
   * the direction from anywhere else would let the two disagree.
   *
   * The parameter is additive: a handler declared as `(change) => …` still
   * satisfies this type.
   *
   * **May fire twice for a single direction flip.** The flip re-delivers the
   * freshest pair unconditionally, because CDK's own `positionChanges` is
   * deduplicated by the identity of the chosen `ConnectedPosition` and usually
   * stays silent when mirroring only re-resolves `start` / `end` within the
   * same entry. When the flip *does* change the chosen position (or the
   * scroll visibility), CDK emits as well and the handler sees both calls,
   * with an identical pair and direction and in that order. Deriving state
   * from the arguments is idempotent and safe; **counting** or logging calls
   * is not.
   */
  onPositionChange?: (
    change: ConnectedOverlayPositionChange,
    direction: MlvDirection,
  ) => void;
}

/** Return value of {@link MlvPopupService.open}. */
export interface MlvPopupHandle {
  /** The underlying CDK overlay reference. */
  overlayRef: OverlayRef;
  /** Disposes the overlay and triggers `onClose`. */
  close: () => void;
  /**
   * Re-anchors an open overlay to a new position origin and repositions it,
   * optionally swapping the position list at the same time.
   *
   * Exists for point-anchored overlays whose anchor moves while they are open —
   * a second right-click on an already-open context menu moves the panel to the
   * new cursor instead of stacking a second one. `positions` matters when the
   * anchor changes *kind* rather than just place: a context menu re-anchored
   * from its host element to a cursor must also drop the 8px element gap, which
   * the strategy would otherwise keep applying to the new point.
   *
   * No-op in `fullscreen` mode, which uses a global strategy with no origin.
   */
  setPositionOrigin: (
    origin: FlexibleConnectedPositionStrategyOrigin,
    positions?: ConnectedPosition[],
  ) => void;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Low-level CDK overlay service for Malva UI popup components.
 *
 * Handles overlay creation, portal attachment, position strategy,
 * backdrop clicks, and Escape-key closure.
 *
 * For template-driven usage prefer `[mlvPopupTrigger]` or
 * `<mlv-popup-container>`. Use this service directly only when you need
 * full programmatic control.
 *
 * @example Programmatic usage
 * ```ts
 * const handle = this.popupService.open({
 *   origin: this.triggerRef,
 *   template: this.tpl,
 *   vcr: this.vcr,
 *   positions: this.popupService.resolvePositions(['bottom', 'top']),
 *   onClose: () => this.isOpen.set(false),
 * });
 * // Later:
 * handle.close();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class MlvPopupService {
  /** @private CDK overlay service. */
  private readonly _overlay = inject(Overlay);

  /**
   * @private Resolves the direction scoped to each popup's origin so portaled
   * panes mirror with their trigger rather than with the document.
   */
  private readonly _rtl = inject(MlvRtlService);

  /** @private Active named-position map (overridable via `POPUP_POSITIONS` token). */
  private readonly _positionMap = inject(POPUP_POSITIONS);

  /** @private Angular zone for running document-level event handlers inside change detection. */
  private readonly _ngZone = inject(NgZone);

  /**
   * @private The document the click-outside listener is bound to. Injected
   * rather than the ambient global: under server rendering the two are
   * different objects and the global is defined, so an ambient `document`
   * binds to a process-wide object no teardown reaches.
   */
  private readonly _document = inject(DOCUMENT);

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Resolves one or more {@link MlvPopupPositionName} strings to CDK
   * `ConnectedPosition` objects.
   *
   * Positions are resolved from the active `POPUP_POSITIONS` map. If a name
   * is not found, it is skipped and a `console.warn` is emitted in dev mode.
   * CDK uses the first position in the returned array that fits in the viewport.
   *
   * @param names — A single name or ordered array of fallback names.
   *
   * @example
   * ```ts
   * positions: this.popupService.resolvePositions('bottom-end')
   * positions: this.popupService.resolvePositions(['bottom-end', 'top-end'])
   * ```
   */
  resolvePositions(
    names: MlvPopupPositionName | MlvPopupPositionName[],
  ): ConnectedPosition[] {
    return MlvPopupPositionResolver.resolve(names, this._positionMap);
  }

  /**
   * Creates a CDK overlay, attaches the given template portal, and wires up
   * backdrop and Escape-key closure.
   *
   * @param config — Full overlay configuration.
   * @returns A {@link MlvPopupHandle} with the `overlayRef` and a `close()` method.
   */
  open(config: MlvPopupOpenConfig): MlvPopupHandle {
    const fullscreen = config.fullscreen ?? false;
    const flexible = config.flexibleDimensions ?? false;

    // Full-screen mode uses a global (viewport-centred) strategy that the pane
    // stretches to fill; the connected positions are irrelevant. Otherwise use
    // the trigger-anchored flexible-connected strategy (unchanged behaviour).
    // withPush(false) for 'reposition': the overlay moves with the trigger and
    // naturally disappears when the trigger scrolls out of the viewport.
    // withPush(true) for all other strategies: CDK keeps the overlay inside the
    // viewport until the strategy itself decides what to do (close, block, noop).
    const push = (config.scrollStrategy ?? 'reposition') !== 'reposition';
    const positionStrategy = fullscreen
      ? this._overlay.position().global()
      : this._overlay
          .position()
          // `positionOrigin` may be a bare viewport point (context menu). The
          // element in `origin` still owns direction and focus — see the field
          // docs on `MlvPopupOpenConfig`.
          .flexibleConnectedTo(config.positionOrigin ?? config.origin)
          .withPositions(config.positions)
          .withPush(push)
          .withFlexibleDimensions(flexible)
          .withGrowAfterOpen(flexible);

    // The backdrop is always shown in full-screen mode regardless of the
    // trigger's preference (it doubles as the scrim behind the sheet).
    const hasBackdrop = fullscreen ? true : (config.hasBackdrop ?? true);

    const overlayRef = this._overlay.create({
      positionStrategy,
      // The pane is portaled to the overlay container on <body>, outside any
      // `[dir]` scope the origin sits in, so the origin's direction has to be
      // passed explicitly. It also drives `start`/`end` position mirroring in
      // `FlexibleConnectedPositionStrategy`.
      direction: this._rtl.resolveDirection(config.origin),
      hasBackdrop,
      ...(hasBackdrop
        ? {
            backdropClass: fullscreen
              ? 'mlv-popup-fullscreen-backdrop'
              : (config.backdropClass ?? 'cdk-overlay-transparent-backdrop'),
          }
        : {}),
      // Full-screen locks the page behind the sheet (no layout shift — the block
      // strategy compensates for the removed scrollbar width).
      scrollStrategy: fullscreen
        ? this._overlay.scrollStrategies.block()
        : this._resolveScrollStrategy(config.scrollStrategy),
      ...(fullscreen
        ? { panelClass: 'mlv-popup-fullscreen-pane' }
        : config.size),
    });

    const portal = new TemplatePortal(config.template, config.vcr);
    overlayRef.attach(portal);

    // The freshest pair CDK applied, kept so a direction flip can re-deliver it
    // (see the direction watch below). `null` until the strategy first runs.
    let lastPositionChange: ConnectedOverlayPositionChange | null = null;

    // Position changes only occur for the connected strategy; the global
    // (full-screen) strategy exposes no positionChanges stream.
    //
    // No `cleanups` entry: `positionChanges` is the strategy's own Subject and
    // `overlayRef.dispose()` calls `positionStrategy.dispose()`, which
    // completes it — completion tears the subscriber down. (The closure now
    // also captures `overlayRef`, but that is the object being disposed, so it
    // keeps nothing alive past `close()` either.)
    if (config.onPositionChange && !fullscreen) {
      (
        positionStrategy as FlexibleConnectedPositionStrategy
      ).positionChanges.subscribe((change) => {
        lastPositionChange = change;
        // The pane's own direction — the one CDK just mirrored `start`/`end`
        // against — rather than the value resolved above, which is already
        // stale once `watchDirection` has re-mirrored an open overlay.
        config.onPositionChange?.(change, overlayRef.getDirection());
      });
    }

    // Collect cleanup callbacks so they all run on close regardless of how it was triggered.
    const cleanups: (() => void)[] = [];

    // The direction is resolved once above, but the pane now lives outside the
    // origin's `[dir]` scope: nothing re-mirrors it if the direction flips while
    // the popup is open. Without this the pane keeps its stale `dir` (its content
    // stays LTR under an RTL page) and the connected strategy keeps resolving
    // `start`/`end` against the old direction, so the panel stays put while the
    // trigger moves to the other edge.
    cleanups.push(
      this._rtl.watchDirection(config.origin, (direction) => {
        overlayRef.setDirection(direction);
        overlayRef.updatePosition();
        // `updatePosition()` re-runs the strategy, but CDK only re-emits
        // `positionChanges` when the *chosen* `ConnectedPosition` object
        // changes — and mirroring usually re-resolves `start`/`end` within the
        // same entry. So the emission above cannot be relied on to tell a
        // consumer deriving physical geometry that the axis just flipped;
        // re-deliver the freshest pair explicitly. Idempotent: if the strategy
        // did emit, it has already refreshed `lastPositionChange` and set the
        // same direction.
        //
        // `!fullscreen` is stated rather than left to the fact that a global
        // strategy never fills `lastPositionChange` — the guard on the
        // subscription above is the one that matters, and this one says so in
        // the same terms instead of resting on that data invariant.
        if (!fullscreen && lastPositionChange) {
          config.onPositionChange?.(
            lastPositionChange,
            overlayRef.getDirection(),
          );
        }
      }),
    );

    let disposed = false;
    const close = () => {
      if (disposed) return;
      disposed = true;
      for (const fn of cleanups) fn();
      overlayRef.dispose();
      config.onClose();
    };

    // Detect when CDK closes the overlay externally (e.g. CloseScrollStrategy calls
    // overlayRef.detach() — bypassing our close() — leaving handle/opened out of sync).
    const detachSub = overlayRef.detachments().subscribe(() => close());
    cleanups.push(() => detachSub.unsubscribe());

    const requestClose = config.onRequestClose ?? close;

    if (hasBackdrop) {
      const sub = overlayRef.backdropClick().subscribe(() => requestClose());
      cleanups.push(() => sub.unsubscribe());
    } else {
      // Defer the document listener to avoid catching the same click that opened the popup.
      const excludeElements = config.dismissExcludeElements ?? [];
      const timerId = setTimeout(() => {
        // `{ capture: true }` is load-bearing: dismissal has to see the click
        // before a handler inside the page can stop its propagation.
        // `fromEvent` forwards the options object to the very same
        // `addEventListener` call, so the phase and the registration order
        // among capture listeners on the document are unchanged.
        //
        // The subscription's lifetime is this open overlay, not the service's
        // — `MlvPopupService` is `providedIn: 'root'` — so it goes on the same
        // `cleanups` list that `close()` drains, exactly where the
        // `removeEventListener` closure used to sit.
        const subscription = fromEvent<MouseEvent>(this._document, 'click', {
          capture: true,
        }).subscribe((event) => {
          const target = event.target as Node;
          const insidePanel =
            overlayRef.hasAttached() &&
            overlayRef.overlayElement.contains(target);
          // Clicks on the trigger/anchor (outside the floating panel) are not
          // "outside" — e.g. repositioning the caret in a combobox's input
          // must not dismiss its open list.
          const insideExcluded = excludeElements.some((el) =>
            el.contains(target),
          );
          if (overlayRef.hasAttached() && !insidePanel && !insideExcluded) {
            this._ngZone.run(() => requestClose());
          }
        });
        cleanups.push(() => subscription.unsubscribe());
      }, 0);
      cleanups.push(() => clearTimeout(timerId));
    }

    const keySub = overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        requestClose();
        event.preventDefault();
      }
    });
    cleanups.push(() => keySub.unsubscribe());

    const setPositionOrigin = (
      origin: FlexibleConnectedPositionStrategyOrigin,
      positions?: ConnectedPosition[],
    ) => {
      if (disposed || fullscreen || !overlayRef.hasAttached()) return;
      const strategy = positionStrategy as FlexibleConnectedPositionStrategy;
      strategy.setOrigin(origin);
      if (positions) strategy.withPositions(positions);
      overlayRef.updatePosition();
    };

    return { overlayRef, close, setPositionOrigin };
  }

  /**
   * @private Maps a {@link MlvPopupScrollStrategy} name to a CDK scroll-strategy instance.
   */
  private _resolveScrollStrategy(
    strategy: MlvPopupScrollStrategy = 'reposition',
  ) {
    switch (strategy) {
      case 'close':
        return this._overlay.scrollStrategies.close();
      case 'block':
        return this._overlay.scrollStrategies.block();
      case 'noop':
        return this._overlay.scrollStrategies.noop();
      default:
        return this._overlay.scrollStrategies.reposition();
    }
  }
}
