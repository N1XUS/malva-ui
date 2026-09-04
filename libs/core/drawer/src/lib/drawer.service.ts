import type { StaticProvider } from '@angular/core';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { MLV_DRAWER_I18N } from '@malva-ui/i18n';
import type {
  OverlayConfig,
  OverlayRef,
  PositionStrategy,
} from '@angular/cdk/overlay';
import type { MlvBaseOverlayConfig } from '@malva-ui/cdk/overlay';
import { MlvOverlayServiceBase } from '@malva-ui/cdk/overlay';
import { MlvDrawerRef } from './drawer-ref';

export type MlvDrawerPosition = 'left' | 'right' | 'top' | 'bottom';

export interface MlvDrawerConfig extends MlvBaseOverlayConfig {
  /** Edge the drawer slides from. Defaults to `'right'`. */
  position?: MlvDrawerPosition;
  /** CSS width (left/right) or height (top/bottom) of the panel. */
  size?: string;
  /**
   * CSS max-size ceiling for the panel's sizing axis (width for `left`/`right`,
   * height for `top`/`bottom`).
   *
   * Applied whether or not the drawer is `resizable`, and always additionally
   * clamped to the viewport so a fixed `size` can never exceed the screen.
   */
  maxSize?: string;
  /** Animation duration in milliseconds. Defaults to `300`. */
  animationDuration?: number;
  /**
   * When true, renders a drag handle on the inward-facing edge.
   * Enables drag-to-resize and swipe-to-dismiss.
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

const HIDDEN_TRANSFORMS: Record<MlvDrawerPosition, string> = {
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
};

@Injectable({ providedIn: 'root' })
export class MlvDrawerService extends MlvOverlayServiceBase<
  MlvDrawerConfig,
  MlvDrawerRef
> {
  /** @protected Panel enter-animation class for drawers. */
  protected override readonly _enterAnimationClass = 'mlv-drawer--enter';

  /** @private i18n strings — `drawer` is the pane's accessible-name fallback. */
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
   * @protected Applies drawer shell classes, hidden-transform var, panel sizing
   * and the accessible-name fallback to the overlay pane.
   *
   * The base service sets `role="dialog"` but no name. The i18n `drawer`
   * string goes on as `aria-label` so the pane is never nameless; a rendered
   * `mlv-drawer-header` title replaces it with `aria-labelledby` through
   * `MlvDrawerRef._labelBy` and hands it back when the title withdraws.
   */
  protected override _decoratePanel(
    panelEl: HTMLElement,
    config: MlvDrawerConfig,
  ): void {
    const position = config.position ?? 'right';
    const size = config.size ?? '300px';
    const isHorizontal = position === 'left' || position === 'right';

    panelEl.classList.add('mlv-drawer', `mlv-drawer--${position}`);
    panelEl.setAttribute('aria-label', this._i18n().drawer);
    panelEl.style.setProperty(
      '--mlv-drawer-hidden-transform',
      HIDDEN_TRANSFORMS[position],
    );

    if (isHorizontal) {
      panelEl.style.width = size;
      panelEl.style.height = '100dvh';
      panelEl.style.maxWidth = this._resolveMaxSize(config.maxSize, '100dvw');
      panelEl.style.maxHeight = '100dvh';
    } else {
      panelEl.style.height = size;
      panelEl.style.width = '100dvw';
      panelEl.style.maxHeight = this._resolveMaxSize(config.maxSize, '100dvh');
      panelEl.style.maxWidth = '100dvw';
    }
  }

  /**
   * @private Combines a configured `maxSize` with the viewport ceiling for the
   * sizing axis.
   *
   * `drawer.scss` cannot help here — Angular injects a component's styles when
   * that component is first instantiated, and `MlvDrawer` is never constructed
   * on the service path — so the clamp has to be written onto the pane.
   */
  private _resolveMaxSize(
    maxSize: string | undefined,
    viewportCeiling: string,
  ): string {
    return !maxSize || maxSize === '100%'
      ? viewportCeiling
      : `min(${maxSize}, ${viewportCeiling})`;
  }
}
