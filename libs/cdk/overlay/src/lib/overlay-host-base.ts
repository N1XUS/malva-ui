import type { OnDestroy, TemplateRef } from '@angular/core';
import {
  Directive,
  Injector,
  ViewContainerRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import type {
  OverlayConfig,
  OverlayRef,
  PositionStrategy,
} from '@angular/cdk/overlay';
import { Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import type { MlvOverlayInitialFocus } from './overlay-initial-focus';
import { MlvOverlayInitialFocusResolver } from './overlay-initial-focus';

/** Enter/leave/idle animation phase driving a template-based overlay's CSS classes. */
export type MlvOverlayAnimationState = 'enter' | 'leave' | 'idle';

/**
 * Abstract base for template-based overlay host components (today: `MlvDrawer`;
 * the dialog runs on `@angular/cdk/dialog` and has no declarative host).
 *
 * Owns the shared open/close lifecycle: a reactive `effect()` that creates the CDK
 * overlay when `opened()` becomes `true` and starts the leave animation when it
 * becomes `false`, focus-restore to the pre-open trigger element, backdrop-click
 * and Escape-to-close wiring, and overlay disposal once the leave animation ends.
 *
 * Subclasses provide the surface-specific bits — the backdrop class, the template
 * to attach, and the position strategy — and may add extra overlay config.
 *
 * Decorated with `@Directive()` (selectorless abstract directive) so Angular
 * collects the inherited signal inputs/model/outputs for the concrete component.
 * Subclasses add the `@Component` decorator.
 */
@Directive()
export abstract class MlvOverlayHostBase implements OnDestroy {
  /** @protected CDK overlay service used to create the overlay. */
  protected readonly _overlay = inject(Overlay);
  /**
   * @protected Resolves the direction scoped to this host element so the
   * portaled pane mirrors with the component, not with the document.
   */
  protected readonly _rtl = inject(MlvRtlService);
  /** @protected ViewContainerRef used to instantiate the overlay template portal. */
  protected readonly _vcr = inject(ViewContainerRef);
  /** @protected Injector used to schedule the post-attach initial-focus pass. */
  protected readonly _injector = inject(Injector);
  /** @protected Shared resolver deciding which element receives focus on open. */
  protected readonly _initialFocusResolver = inject(
    MlvOverlayInitialFocusResolver,
  );
  /** @protected Active CDK overlay reference, or `null` when closed. */
  protected _overlayRef: OverlayRef | null = null;
  /** @protected The element that had focus before the overlay opened. */
  protected _triggerElement: HTMLElement | null = null;

  /** Two-way bindable open state; `true` opens the overlay, `false` closes it. */
  readonly opened = model(false);
  /** Whether a backdrop is rendered behind the overlay. */
  readonly hasBackdrop = input(true);
  /** Whether clicking the backdrop closes the overlay. */
  readonly closeOnBackdropClick = input(true);
  /** Whether pressing Escape closes the overlay. */
  readonly closeOnEscape = input(true);

  /**
   * Whether disposal restores focus to the element active before the overlay
   * opened. Disable this when a composed parent owns the logical focus
   * lifecycle across multiple renderers.
   */
  readonly restoreFocus = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Where focus lands once the overlay is open.
   *
   * Defaults to `'auto'`: a projected `[mlvAutofocus]` element wins, otherwise
   * the first tabbable control that is not chrome (the close button and the
   * body's scroll viewport are skipped), otherwise the modal surface itself.
   *
   * @see MlvOverlayInitialFocus
   */
  readonly initialFocus = input<MlvOverlayInitialFocus>('auto');

  /** Emitted after the overlay is created and the template is attached. */
  readonly afterOpened = output<void>();
  /** Emitted after the leave animation completes and the overlay is disposed. */
  readonly afterClosed = output<void>();

  /** Drives the enter/leave CSS animation modifier classes on the overlay panel. */
  readonly animationState = signal<MlvOverlayAnimationState>('idle');

  /** @protected Base CSS class of the backdrop; `{class}--leaving` is added to play its leave animation. */
  protected abstract readonly _backdropClass: string;

  /**
   * @protected Fallback delay (ms) after which a pending leave is force-completed
   * when the panel's `animationend` never fires — `prefers-reduced-motion` strips
   * the leave animation entirely, and hidden/background tabs throttle CSS
   * animations. Mirrors `MlvOverlayRef._leaveFallbackMs` on the imperative path.
   * Subclasses may override to match their animation duration.
   */
  protected readonly _leaveFallbackMs: number = 350;

  /**
   * @private Active leave-fallback timer, or `null` when no leave is pending.
   * Armed by `_startLeaveAnimation()`, cleared on disposal.
   */
  private _leaveFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  /** @protected Returns the view template to attach to the overlay portal. */
  protected abstract _getOverlayTemplate(): TemplateRef<unknown> | undefined;

  /** @protected Builds the CDK position strategy for this overlay surface. */
  protected abstract _buildPositionStrategy(): PositionStrategy;

  /**
   * @protected Extra CDK overlay config merged into the base config (size, panel
   * class, …). Defaults to an empty object.
   */
  protected _buildExtraOverlayConfig(): OverlayConfig {
    return {};
  }

  constructor() {
    effect(() => {
      if (this.opened()) {
        this._createOverlay();
      } else {
        this._startLeaveAnimation();
      }
    });
  }

  /** Opens the overlay by setting `opened` to `true`. */
  open(): void {
    this.opened.set(true);
  }

  /** Closes the overlay by setting `opened` to `false`, triggering the leave animation. */
  close(): void {
    this.opened.set(false);
  }

  /** Disposes the overlay once the leave animation completes. Bound to the panel's `(animationend)`. */
  onAnimationEnd(): void {
    if (this.animationState() === 'leave' && this._overlayRef) {
      this._destroyOverlay();
    }
  }

  ngOnDestroy(): void {
    this._destroyOverlay();
  }

  /** @protected Captures focus, creates and attaches the overlay, then plays the enter animation. */
  protected _createOverlay(): void {
    if (this._overlayRef) {
      if (this.animationState() === 'leave') {
        if (this._leaveFallbackTimer !== null) {
          clearTimeout(this._leaveFallbackTimer);
          this._leaveFallbackTimer = null;
        }
        this._overlayRef.backdropElement?.classList.remove(
          `${this._backdropClass}--leaving`,
        );
        this.animationState.set('enter');
      }
      return;
    }

    const template = this._getOverlayTemplate();
    if (!template) return;

    this._triggerElement = document.activeElement as HTMLElement | null;

    this._overlayRef = this._overlay.create({
      positionStrategy: this._buildPositionStrategy(),
      direction: this._rtl.resolveDirection(this._vcr.element),
      hasBackdrop: this.hasBackdrop(),
      backdropClass: this._backdropClass,
      scrollStrategy: this._overlay.scrollStrategies.block(),
      ...this._buildExtraOverlayConfig(),
    });

    const portal = new TemplatePortal(template, this._vcr);
    this._overlayRef.attach(portal);

    this.animationState.set('enter');

    if (this.closeOnBackdropClick()) {
      this._overlayRef.backdropClick().subscribe(() => this.close());
    }

    if (this.closeOnEscape()) {
      this._overlayRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') {
          this.close();
          event.preventDefault();
        }
      });
    }

    this._applyInitialFocus();

    this.afterOpened.emit();
  }

  /**
   * @protected The modal surface focus is resolved against.
   *
   * The overlay pane is a bare CDK wrapper; the element carrying
   * `role="dialog"` is the surface a screen reader announces, so it is
   * preferred when the subclass's template renders one.
   */
  protected _getFocusContainer(): HTMLElement | null {
    const paneEl = this._overlayRef?.overlayElement ?? null;
    return paneEl?.querySelector<HTMLElement>('[role="dialog"]') ?? paneEl;
  }

  /**
   * @private Moves focus into the overlay once its content has actually
   * rendered.
   *
   * Deferred to `afterNextRender` because `attach()` only creates the embedded
   * view — the `@if`-guarded header/body/footer do not exist in the DOM until
   * change detection has run, so resolving a focus target synchronously would
   * always find an empty panel.
   */
  private _applyInitialFocus(): void {
    afterNextRender(
      () => {
        const container = this._getFocusContainer();
        if (!container || !this._overlayRef?.hasAttached()) {
          return;
        }
        this._initialFocusResolver.focus(container, this.initialFocus());
      },
      { injector: this._injector },
    );
  }

  /** @protected Starts the leave animation on the backdrop before the overlay is destroyed. */
  protected _startLeaveAnimation(): void {
    if (!this._overlayRef) return;

    const backdropEl = this._overlayRef.backdropElement;
    if (backdropEl) {
      backdropEl.classList.add(`${this._backdropClass}--leaving`);
    }

    this.animationState.set('leave');

    // Guarantee disposal even if `animationend` never arrives (reduced motion,
    // throttled background tab). `onAnimationEnd()` re-checks the state and the
    // overlay ref, so a late timer after a real animationend is a no-op.
    if (this._leaveFallbackTimer !== null) {
      clearTimeout(this._leaveFallbackTimer);
    }
    this._leaveFallbackTimer = setTimeout(() => {
      this._leaveFallbackTimer = null;
      this.onAnimationEnd();
    }, this._leaveFallbackMs);
  }

  /** @protected Disposes the overlay, restores focus to the trigger, and emits `afterClosed`. */
  protected _destroyOverlay(): void {
    if (this._leaveFallbackTimer !== null) {
      clearTimeout(this._leaveFallbackTimer);
      this._leaveFallbackTimer = null;
    }
    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
      this.animationState.set('idle');
      const trigger = this._triggerElement;
      this._triggerElement = null;
      if (this.restoreFocus() && trigger?.isConnected) {
        trigger.focus();
      }
      this.afterClosed.emit();
    }
  }
}
