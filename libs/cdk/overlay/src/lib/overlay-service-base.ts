import type { StaticProvider, Type } from '@angular/core';
import { Injector, afterNextRender, inject } from '@angular/core';
import type {
  OverlayConfig,
  OverlayRef,
  PositionStrategy,
} from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import type { MlvBaseOverlayConfig } from './overlay-config';
import type { MlvOverlayRef } from './overlay-ref';
import { MlvOverlayInitialFocusResolver } from './overlay-initial-focus';

/**
 * Abstract base for imperative overlay services (today: `MlvDrawerService`;
 * `MlvDialogService` runs on `@angular/cdk/dialog` instead).
 *
 * Owns the shared `open()` flow: creating the CDK overlay, building a child
 * injector that provides the ref and data tokens, attaching the component
 * portal, making the component host a flex pass-through, applying the shared
 * `role="dialog"`/`aria-modal` semantics, trapping focus, playing the enter
 * animation, and wiring backdrop-click / Escape to close.
 *
 * Subclasses implement the surface-specific hooks (position strategy, overlay
 * config, ref construction, DI providers, panel decoration, enter class).
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
   * Opens `component` inside a CDK overlay.
   *
   * @param component - The component class to instantiate inside the overlay.
   * @param config - Surface configuration. All fields are optional.
   * @returns The overlay reference controlling the opened instance.
   */
  open<T>(component: Type<T>, config: TConfig = {} as TConfig): TRef {
    const previouslyFocusedElement =
      typeof document === 'undefined'
        ? null
        : (document.activeElement as HTMLElement | null);
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

    const portal = new ComponentPortal(component, null, injector);
    const componentRef = overlayRef.attach(portal);

    // The component host element sits between the overlay pane and the
    // header/body/footer children — make it a flex pass-through.
    const hostEl = componentRef.location.nativeElement as HTMLElement;
    hostEl.style.display = 'flex';
    hostEl.style.flexDirection = 'column';
    hostEl.style.flex = '1 1 auto';
    hostEl.style.minHeight = '0';

    const panelEl = overlayRef.overlayElement;
    if (panelEl) {
      panelEl.setAttribute('role', 'dialog');
      panelEl.setAttribute('aria-modal', 'true');
      panelEl.setAttribute('tabindex', '-1');

      this._decoratePanel(panelEl, config);

      // Trap focus inside the overlay.
      const focusTrap = this._focusTrapFactory.create(panelEl);
      // Deferred to `afterNextRender`: `attach()` only creates the component,
      // so nothing focusable exists in the DOM until change detection has run.
      // The trap's own auto-capture is deliberately not used — it takes the
      // first tabbable node, which on this path is the body's scroll viewport.
      afterNextRender(
        () => {
          if (!overlayRef.hasAttached()) {
            return;
          }
          this._initialFocusResolver.focus(panelEl, config.initialFocus);
        },
        { injector: this._injector },
      );
      ref.afterClosed().subscribe(() => {
        focusTrap.destroy();
        if (previouslyFocusedElement?.isConnected) {
          previouslyFocusedElement.focus();
        }
      });

      // Trigger enter animation.
      panelEl.classList.add(this._enterAnimationClass);
      panelEl.addEventListener(
        'animationend',
        () => panelEl.classList.remove(this._enterAnimationClass),
        { once: true },
      );
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

    return ref;
  }
}
