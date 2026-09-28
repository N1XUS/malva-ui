import type { StaticProvider, Type } from '@angular/core';
import { DOCUMENT, Injector, afterNextRender, inject } from '@angular/core';
import { Location } from '@angular/common';
import type {
  OverlayConfig,
  OverlayRef,
  PositionStrategy,
} from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { take } from 'rxjs';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import type { MlvBaseOverlayConfig } from './overlay-config';
import type { MlvOverlayRef } from './overlay-ref';
import { MlvOverlayInitialFocusResolver } from './overlay-initial-focus';

/**
 * Abstract base for imperative overlay services (today: `MlvDrawerService`;
 * `MlvDialogService` runs on `@angular/cdk/dialog` instead).
 *
 * Owns the shared `open()` flow: creating the CDK overlay, building a child
 * injector that provides the ref and data tokens, attaching the content
 * through {@link _attachContent}, applying the shared `role="dialog"` /
 * `aria-modal` semantics to the surface that hook returns, trapping focus,
 * playing the enter animation, and wiring backdrop-click / Escape — and, when
 * `closeOnNavigation` asks for it, history navigation — to close.
 *
 * Subclasses implement the surface-specific hooks (position strategy, overlay
 * config, ref construction, DI providers, panel decoration, enter class), and
 * may override {@link _attachContent} to render the opened component inside a
 * surface component of their own rather than directly in the CDK pane —
 * which is how `MlvDrawerService` renders the same panel `<mlv-drawer>`
 * does.
 *
 * Not injectable directly — extend it and add `@Injectable`. `inject()` runs in
 * the subclass's injection context.
 *
 * @typeParam TConfig - The service's configuration object, extending {@link MlvBaseOverlayConfig}.
 * @typeParam TRef - The overlay reference type returned by `open()`.
 */
export abstract class MlvOverlayServiceBase<
  TConfig extends MlvBaseOverlayConfig,
  TRef extends MlvOverlayRef,
> {
  /** @protected CDK overlay service used to create the overlay. */
  protected readonly _overlay = inject(Overlay);
  /** @protected Root injector used as the parent for each overlay's child injector. */
  protected readonly _injector = inject(Injector);
  /** @protected Factory used to trap focus inside the open overlay. */
  protected readonly _focusTrapFactory = inject(ConfigurableFocusTrapFactory);
  /** @protected Shared resolver deciding which element receives focus on open. */
  protected readonly _initialFocusResolver = inject(
    MlvOverlayInitialFocusResolver,
  );
  /**
   * @protected Resolves the direction for the portaled pane. The overlay lives
   * on `<body>`, outside any `[dir]` scope its trigger sits in.
   */
  protected readonly _rtl = inject(MlvRtlService);
  /**
   * @protected The document the overlay opens in — the injected `DOCUMENT`,
   * never the ambient global: under server rendering the global is a
   * different object from the per-request document, or absent altogether.
   */
  protected readonly _document = inject(DOCUMENT);
  /**
   * @protected Delivers history navigation (Back / Forward, `hashchange`) for
   * `closeOnNavigation` — the pop events CDK's own `disposeOnNavigation`
   * listens to, through the same service, so the server platform's no-op
   * `PlatformLocation` and `provideLocationMocks()` apply unchanged.
   */
  protected readonly _location = inject(Location);

  /** @protected CSS class added to the panel to play its enter animation, then removed on `animationend`. */
  protected abstract readonly _enterAnimationClass: string;

  /** @protected Builds the CDK position strategy for the overlay. */
  protected abstract _buildPositionStrategy(config: TConfig): PositionStrategy;

  /** @protected Surface-specific overlay config (backdrop class, panel class, size, …). */
  protected abstract _buildOverlayConfig(config: TConfig): OverlayConfig;

  /** @protected Constructs the concrete overlay reference for this surface. */
  protected abstract _createRef(overlayRef: OverlayRef, config: TConfig): TRef;

  /** @protected Static providers registered in the opened component's child injector (ref + data tokens). */
  protected abstract _createProviders(
    ref: TRef,
    config: TConfig,
  ): StaticProvider[];

  /** @protected Applies surface-specific classes/styles to the overlay panel element after attach. */
  protected abstract _decoratePanel(
    panelEl: HTMLElement,
    config: TConfig,
  ): void;

  /**
   * @protected Attaches `component` to the overlay and returns the element that
   * becomes the dialog surface: the one that receives `role="dialog"`,
   * `aria-modal`, `tabindex="-1"`, {@link _decoratePanel}, the focus trap,
   * the enter class, and — through `MlvOverlayRef` — the leave class and the
   * guarded `animationend` that disposes the overlay.
   *
   * The default attaches a `ComponentPortal` straight to the CDK pane, makes
   * the component host a flex pass-through ({@link _applyContentLayout}) and
   * returns the pane. Override it to render the component inside a surface
   * component of your own; the returned element must stay inside the pane for
   * the life of the overlay. Runs synchronously inside `open()`, before any
   * of the above is applied.
   *
   * @param overlayRef - The freshly created CDK overlay.
   * @param component - The component `open()` was called with.
   * @param injector - Injector providing the ref and data tokens; parent of
   * whatever the hook creates.
   * @param _ref - The overlay reference `open()` will return.
   * @param _config - The configuration `open()` was called with.
   * @returns The dialog surface element.
   */
  protected _attachContent<T>(
    overlayRef: OverlayRef,
    component: Type<T>,
    injector: Injector,
    _ref: TRef,
    _config: TConfig,
  ): HTMLElement {
    const componentRef = overlayRef.attach(
      new ComponentPortal(component, null, injector),
    );
    this._applyContentLayout(
      componentRef.location.nativeElement as HTMLElement,
    );
    return overlayRef.overlayElement;
  }

  /**
   * @protected Makes the opened component's host a flex pass-through. The host
   * sits between the surface and the header / body / footer it renders, so
   * without this the body could neither fill nor scroll.
   *
   * @param hostEl - The opened component's host element.
   */
  protected _applyContentLayout(hostEl: HTMLElement): void {
    hostEl.style.display = 'flex';
    hostEl.style.flexDirection = 'column';
    hostEl.style.flex = '1 1 auto';
    hostEl.style.minHeight = '0';
  }

  /**
   * Opens `component` inside a CDK overlay.
   *
   * @param component - The component class to instantiate inside the overlay.
   * @param config - Surface configuration. All fields are optional.
   * @returns The overlay reference controlling the opened instance.
   */
  open<T>(component: Type<T>, config: TConfig = {} as TConfig): TRef {
    const previouslyFocusedElement = this._document
      .activeElement as HTMLElement | null;
    const overlayRef = this._overlay.create({
      positionStrategy: this._buildPositionStrategy(config),
      direction:
        config.direction ??
        this._rtl.resolveDirection(previouslyFocusedElement),
      hasBackdrop: true,
      scrollStrategy: this._overlay.scrollStrategies.block(),
      ...this._buildOverlayConfig(config),
    });

    const ref = this._createRef(overlayRef, config);

    const injector = Injector.create({
      parent: config.injector ?? this._injector,
      providers: this._createProviders(ref, config),
    });

    const panelEl = this._attachContent(
      overlayRef,
      component,
      injector,
      ref,
      config,
    );
    // The ref plays the leave on the same element the enter runs on below.
    ref._surfaceElement =
      panelEl && panelEl !== overlayRef.overlayElement ? panelEl : null;

    /**
     * Releases the focus trap and returns focus to the element focused at
     * open — once, whichever asks first: `afterClosed()`, or a history
     * navigation closing the overlay (below), which hands focus back at the
     * pop event instead of at the end of the leave. A no-op without a
     * surface, which traps nothing.
     */
    let releaseFocus = (): void => undefined;

    if (panelEl) {
      panelEl.setAttribute('role', 'dialog');
      panelEl.setAttribute('aria-modal', 'true');
      panelEl.setAttribute('tabindex', '-1');

      this._decoratePanel(panelEl, config);

      // Trap focus inside the overlay.
      const focusTrap = this._focusTrapFactory.create(panelEl);
      let focusReleased = false;
      releaseFocus = () => {
        if (focusReleased) {
          return;
        }
        focusReleased = true;
        focusTrap.destroy();
        if (previouslyFocusedElement?.isConnected) {
          previouslyFocusedElement.focus();
        }
      };
      // Deferred to `afterNextRender`: `attach()` only creates the component,
      // so nothing focusable exists in the DOM until change detection has run.
      // The trap's own auto-capture is deliberately not used — it takes the
      // first tabbable node, which on this path is the body's scroll viewport.
      // Skipped once focus has been handed back: a history navigation closing
      // the overlay before its first render has already returned it.
      afterNextRender(
        () => {
          if (!overlayRef.hasAttached() || focusReleased) {
            return;
          }
          this._initialFocusResolver.focus(panelEl, config.initialFocus);
        },
        { injector: this._injector },
      );
      ref.afterClosed().subscribe(() => releaseFocus());

      // Trigger enter animation.
      panelEl.classList.add(this._enterAnimationClass);
      // Target-guarded: `animationend` bubbles, so consumer content finishing
      // its own finite animation during the enter would otherwise strip the
      // class and cut the panel's enter short. Only the panel's own keyframes
      // may clear it. (With a surface of its own, the pane is an ancestor and
      // its events never reach this listener at all.)
      const onEnterAnimationEnd = (event: Event) => {
        if (event.target !== panelEl) {
          return;
        }
        panelEl.classList.remove(this._enterAnimationClass);
        panelEl.removeEventListener('animationend', onEnterAnimationEnd);
      };
      // Kept raw (issue #76 triage): the listener's lifetime is the enter
      // animation's, not the service's — this service is `providedIn: 'root'`,
      // so `takeUntilDestroyed` here would bind every overlay ever opened to
      // the application's lifetime instead — and `panelEl` is disposed with the
      // overlay either way. Not `once: true`: an ignored descendant event would
      // spend it and latch the enter class for the life of the panel. The
      // handler removes itself on the panel's own event instead.
      panelEl.addEventListener('animationend', onEnterAnimationEnd);
    }

    if (config.closeOnBackdrop !== false) {
      overlayRef.backdropClick().subscribe(() => ref.close());
    }

    if (config.closeOnEscape !== false) {
      overlayRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          ref.close();
        }
      });
    }

    if (config.closeOnNavigation) {
      // Not CDK's `disposeOnNavigation`: that disposes the pane on the spot,
      // which this ref never hears of — no leave, no `afterClosed()`, so the
      // focus trap is never released and focus never returns. Closing through
      // the ref, as backdrop and Escape do, runs the whole close: the leave,
      // one `afterClosed()`, the teardown above.
      //
      // But the page is handed back at the pop event, not when the leave
      // ends: the router navigates on a timer after this event, and its
      // scroll restoration and any arrival focus (`[mlvAutofocus]`, a route
      // focus handler) land inside the leave. So first — as the dialog's
      // synchronous dispose does — the scroll strategy is swapped out: the
      // block strategy's `disable()` restores the offset while the page being
      // left is still current, so the router stores that offset for it, not
      // the blocked 0. Focus goes back to the opener and the trap goes, so
      // arrival focus is neither bounced into the panel nor overwritten when
      // the leave ends. The leaving overlay, backdrop included, goes `inert`:
      // out of the tab order and of hit-testing. (Escape is still delivered
      // until dispose: pre-existing, tracked in #450.)
      //
      // Every step is idempotent: a hash change pops twice (popstate, then
      // hashchange), and Back may be pressed again during the leave. It also
      // runs when another close is already under way, whose trap would
      // otherwise outlive the navigation the same way.
      const navigation = this._location.subscribe(() => {
        overlayRef.updateScrollStrategy(this._overlay.scrollStrategies.noop());
        releaseFocus();
        overlayRef.hostElement.setAttribute('inert', '');
        overlayRef.backdropElement?.setAttribute('inert', '');
        ref.close();
      });
      // Released with this overlay, not with the service: a subclass is
      // typically root-provided, so `takeUntilDestroyed` would keep every
      // overlay it ever opened subscribed. Every close ends in `dispose()`,
      // which completes `detachments()`; content torn down under an open
      // overlay (the application destroyed) makes CDK detach, which emits on
      // it first. Either ends `take(1)`.
      overlayRef
        .detachments()
        .pipe(take(1))
        .subscribe({ complete: () => navigation.unsubscribe() });
    }

    return ref;
  }
}
