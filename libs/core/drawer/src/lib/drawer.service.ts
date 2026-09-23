import type { Injector, StaticProvider, Type } from '@angular/core';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { MLV_DRAWER_I18N } from '@malva-ui/i18n';
import type {
  OverlayConfig,
  OverlayRef,
  PositionStrategy,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import type { MlvBaseOverlayConfig } from '@malva-ui/cdk/overlay';
import { MlvOverlayServiceBase } from '@malva-ui/cdk/overlay';
import { MlvDrawerRef } from './drawer-ref';
import { MlvDrawerPanel } from './drawer/drawer-panel';

export type MlvDrawerPosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * Configuration for `MlvDrawerService.open()` and
 * `mlvGenerateRoutableDrawerRoute()`. The drawer renders through the same
 * panel `<mlv-drawer>` does, so each field below means what the input of the
 * same name means there.
 */
export interface MlvDrawerConfig extends MlvBaseOverlayConfig {
  /** Edge the drawer slides from. Defaults to `'right'`. */
  position?: MlvDrawerPosition;
  /**
   * CSS width (left/right) or height (top/bottom) of the panel. Defaults to
   * `'300px'`. Ignored while `resizable` is true: a resizable drawer opens at
   * `defaultSnap`, as `<mlv-drawer>` does.
   */
  size?: string;
  /**
   * CSS max-size ceiling for the panel's sizing axis (width for `left`/`right`,
   * height for `top`/`bottom`).
   *
   * Applied whether or not the drawer is `resizable`, and always additionally
   * clamped to the viewport so a fixed `size` can never exceed the screen.
   */
  maxSize?: string;
  /**
   * Intended close-animation duration in milliseconds. Defaults to `300`.
   *
   * **Currently inert** (#277): the value is handed to `MlvDrawerRef` and
   * stored, but nothing reads it. The leave animation's length comes from the
   * CSS `--mlv-drawer-leave-duration` custom property, and disposal waits for
   * the panel's own `animationend` or `MlvDrawerRef`'s fixed 350 ms
   * `_leaveFallbackMs`, whichever comes first.
   */
  animationDuration?: number;
  /**
   * When true, renders a drag handle on the inward-facing edge and opens the
   * panel at `defaultSnap` instead of `size`. Enables drag-to-resize,
   * keyboard resizing and swipe-to-dismiss; a dismiss closes the drawer
   * through its `MlvDrawerRef`.
   */
  resizable?: boolean;
  /**
   * Sorted array of viewport-percentage snap points (0–100).
   * After drag ends, the panel animates to the nearest snap point.
   * Only effective when `resizable` is true.
   */
  snapPoints?: number[];
  /**
   * Initial snap point percentage (0–100) applied when the drawer opens.
   * Defaults to 100 (full size). Only used when `resizable` is true.
   */
  defaultSnap?: number;
}

export const DRAWER_DATA = new InjectionToken<unknown>('DRAWER_DATA');

@Injectable({ providedIn: 'root' })
export class MlvDrawerService extends MlvOverlayServiceBase<
  MlvDrawerConfig,
  MlvDrawerRef
> {
  /** @protected Panel enter-animation class for drawers. */
  protected override readonly _enterAnimationClass = 'mlv-drawer--enter';

  /** @private i18n strings — `drawer` is the panel's accessible-name fallback. */
  private readonly _i18n = inject(MLV_DRAWER_I18N);

  /** @protected Anchors the drawer to the configured viewport edge. */
  protected override _buildPositionStrategy(
    config: MlvDrawerConfig,
  ): PositionStrategy {
    const position = config.position ?? 'right';
    const positionStrategy = this._overlay.position().global();

    if (position === 'left') positionStrategy.left('0').top('0');
    else if (position === 'right') positionStrategy.right('0').top('0');
    else if (position === 'top') positionStrategy.top('0').left('0');
    else positionStrategy.bottom('0').left('0');

    return positionStrategy;
  }

  /** @protected Drawer backdrop class. */
  protected override _buildOverlayConfig(): OverlayConfig {
    return { backdropClass: 'mlv-drawer-backdrop' };
  }

  /** @protected Creates the drawer reference, forwarding position and animation duration. */
  protected override _createRef(
    overlayRef: OverlayRef,
    config: MlvDrawerConfig,
  ): MlvDrawerRef {
    const position = config.position ?? 'right';
    const animationDuration = config.animationDuration ?? 300;
    return new MlvDrawerRef(overlayRef, position, animationDuration);
  }

  /** @protected Provides `MlvDrawerRef` and `DRAWER_DATA` to the opened component. */
  protected override _createProviders(
    ref: MlvDrawerRef,
    config: MlvDrawerConfig,
  ): StaticProvider[] {
    return [
      { provide: MlvDrawerRef, useValue: ref },
      { provide: DRAWER_DATA, useValue: config.data },
    ];
  }

  /**
   * @protected Renders the drawer panel — the component `<mlv-drawer>`
   * renders — in the CDK pane, and `component` inside it.
   *
   * The panel brings what only a constructed component can: `drawer.scss`,
   * the resize handle, the viewport-clamped geometry and
   * `MlvDrawerSectionsService` for `[mlvDrawerSection]` content. Its first
   * render runs here, synchronously, so the geometry and the handle exist when
   * `open()` returns, before the opened component is created at the panel's
   * content anchor. A handle dismiss closes the drawer through `ref`, which
   * runs the same leave as `close()`.
   *
   * @returns The panel element, which the base makes the dialog surface.
   */
  protected override _attachContent<T>(
    overlayRef: OverlayRef,
    component: Type<T>,
    injector: Injector,
    ref: MlvDrawerRef,
    config: MlvDrawerConfig,
  ): HTMLElement {
    const panelRef = overlayRef.attach(
      new ComponentPortal(MlvDrawerPanel, null, injector),
    );
    panelRef.setInput('position', config.position ?? 'right');
    // Unset fields keep the panel's defaults, which are `<mlv-drawer>`'s.
    if (config.size !== undefined) panelRef.setInput('size', config.size);
    if (config.maxSize !== undefined) {
      panelRef.setInput('maxSize', config.maxSize);
    }
    if (config.resizable !== undefined) {
      panelRef.setInput('resizable', config.resizable);
    }
    if (config.snapPoints !== undefined) {
      panelRef.setInput('snapPoints', config.snapPoints);
    }
    if (config.defaultSnap !== undefined) {
      panelRef.setInput('defaultSnap', config.defaultSnap);
    }
    panelRef.changeDetectorRef.detectChanges();

    const contentRef = panelRef.instance._attachContent(component);
    this._applyContentLayout(contentRef.location.nativeElement as HTMLElement);

    // Completed with the panel, which the overlay destroys on dispose.
    panelRef.instance.dismissed.subscribe(() => ref.close());

    return panelRef.location.nativeElement as HTMLElement;
  }

  /**
   * @protected Writes the accessible-name fallback onto the drawer panel.
   *
   * The panel carries `role="dialog"` but no name. The i18n `drawer` string
   * goes on as `aria-label` so the dialog is never nameless; a rendered
   * `mlv-drawer-header` title replaces it with `aria-labelledby` through
   * `MlvDrawerRef._labelBy` and hands it back when the title withdraws.
   * Classes, geometry and the hidden transform are the panel's own bindings.
   */
  protected override _decoratePanel(panelEl: HTMLElement): void {
    panelEl.setAttribute('aria-label', this._i18n().drawer);
  }
}
