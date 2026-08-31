import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { PositionStrategy } from '@angular/cdk/overlay';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvOverlayHostBase } from '@malva-ui/cdk/overlay';
import { MLV_DRAWER_I18N } from '@malva-ui/i18n';
import { MlvDrawerSectionsService } from '../drawer-sections.service';
import { MlvDrawerContent } from '../drawer-content';
import { MlvDrawerResize } from '../drawer-resize';
import type { MlvDrawerPosition } from '../drawer.service';

const HIDDEN_TRANSFORMS: Record<MlvDrawerPosition, string> = {
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
};

@Component({
  selector: 'mlv-drawer',
  imports: [OverlayModule, A11yModule, NgTemplateOutlet, MlvDrawerResize],
  templateUrl: './drawer.html',
  styleUrl: './drawer.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MlvDrawerSectionsService],
})
export class MlvDrawer extends MlvOverlayHostBase {
  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_DRAWER_I18N);

  /** @protected Base CSS class of the drawer backdrop. */
  protected override readonly _backdropClass = 'mlv-drawer-backdrop';

  /** Which edge of the viewport the drawer slides from. */
  readonly position = input<MlvDrawerPosition>('right');

  /**
   * Accessible name for the drawer dialog surface. Used as the `aria-label`
   * when no `ariaLabelledBy` is provided. When both are omitted, the drawer
   * falls back to the localized default ("Drawer") so the `role="dialog"`
   * is never left without an accessible name.
   */
  readonly ariaLabel = input<string>();

  /**
   * Id of a visible element (typically a projected `[mlvDrawerHeader]`) that
   * labels the drawer. When set, it takes precedence over `ariaLabel` and the
   * i18n fallback via `aria-labelledby` — mirroring how `mlv-dialog` labels
   * itself by its projected header.
   */
  readonly ariaLabelledBy = input<string>();

  /**
   * @protected Resolved `aria-label` for the dialog surface: the explicit
   * `ariaLabel` input, or the localized fallback. Suppressed (null) when
   * `ariaLabelledBy` is set so the two naming methods never conflict.
   */
  protected readonly _resolvedAriaLabel = computed(() =>
    this.ariaLabelledBy() ? null : (this.ariaLabel() ?? this._i18n().drawer),
  );

  /**
   * CSS width (left/right drawers) or height (top/bottom drawers) of the panel.
   * Used as the initial size when `resizable` is false or no `defaultSnap` is set.
   */
  readonly size = input('300px');

  /**
   * When true, renders a drag handle on the inward-facing edge.
   * Enables drag-to-resize and swipe-to-dismiss.
   */
  readonly resizable = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Sorted array of viewport-percentage snap points (0–100).
   * After drag ends, the panel animates to the nearest snap point.
   * If empty, the panel stays at its released position.
   * Only effective when `resizable` is true.
   */
  readonly snapPoints = input<number[]>([]);

  /**
   * Initial snap point percentage (0–100) applied when the drawer opens.
   * Defaults to 100 (full size). Only used when `resizable` is true.
   */
  readonly defaultSnap = input<number>(100);

  /**
   * CSS min-size floor applied during drag resize.
   * Only used when `resizable` is true.
   */
  readonly minSize = input('0px');

  /**
   * CSS max-size ceiling for the panel's sizing axis (width for `left`/`right`,
   * height for `top`/`bottom`).
   *
   * Honoured whether or not the drawer is `resizable` — a fixed `size` is
   * clamped by it too. The resolved ceiling is always additionally clamped to
   * the viewport (`100dvw`/`100dvh`), so a `size="36rem"` drawer can never be
   * wider than a 375 px phone.
   */
  readonly maxSize = input('100%');

  readonly hiddenTransform = computed(() => HIDDEN_TRANSFORMS[this.position()]);

  /** @protected Projected drawer content directive, rendered into the overlay panel. */
  protected readonly contentRef = contentChild(MlvDrawerContent);

  /** @protected The `#drawerTemplate` view template attached to the CDK overlay portal. */
  protected readonly drawerTemplate =
    viewChild<TemplateRef<unknown>>('drawerTemplate');

  /**
   * @protected Computes the initial panel size string.
   * When resizable, uses `defaultSnap` as a dvh/dvw percentage;
   * otherwise falls back to the `size` input.
   */
  protected readonly _initialPanelSize = computed(() => {
    if (!this.resizable()) return this.size();
    const snap = this.defaultSnap();
    const pos = this.position();
    const isVertical = pos === 'bottom' || pos === 'top';
    return isVertical ? `${snap}dvh` : `${snap}dvw`;
  });

  /**
   * @private Combines the configured `maxSize` with the viewport ceiling for
   * the sizing axis.
   *
   * The viewport ceiling is unconditional: without it a fixed `size` larger
   * than the screen (`size="36rem"` on a 375 px phone) renders a panel that
   * hangs off the edge. `maxSize` is folded in through CSS `min()` so it is
   * honoured on the non-resizable path too. The `'100%'` default is dropped
   * rather than nested — it resolves against the overlay pane, which is itself
   * sized by this panel, so it would add nothing but an indirection.
   */
  private _resolveMaxSize(viewportCeiling: string): string {
    const maxSize = this.maxSize();
    return !maxSize || maxSize === '100%'
      ? viewportCeiling
      : `min(${maxSize}, ${viewportCeiling})`;
  }

  /**
   * Resolved inline geometry for the panel element: the sizing-axis `size`, the
   * cross-axis viewport fill, and the max ceilings on both axes.
   */
  get drawerDimensions(): Record<string, string> {
    const pos = this.position();
    const size = this.resizable()
      ? `var(--mlv-drawer-current-size, ${this._initialPanelSize()})`
      : this._initialPanelSize();

    if (pos === 'left' || pos === 'right') {
      return {
        width: size,
        height: '100dvh',
        maxWidth: this._resolveMaxSize('100dvw'),
        maxHeight: '100dvh',
      };
    }
    return {
      height: size,
      width: '100dvw',
      maxHeight: this._resolveMaxSize('100dvh'),
      maxWidth: '100dvw',
    };
  }

  /** @protected Returns the drawer surface template to attach to the overlay. */
  protected override _getOverlayTemplate(): TemplateRef<unknown> | undefined {
    return this.drawerTemplate();
  }

  /** @protected Anchors the drawer to the configured viewport edge. */
  protected override _buildPositionStrategy(): PositionStrategy {
    const positionStrategy = this._overlay.position().global();
    const pos = this.position();

    if (pos === 'left') positionStrategy.left('0').top('0');
    else if (pos === 'right') positionStrategy.right('0').top('0');
    else if (pos === 'top') positionStrategy.top('0').left('0');
    else positionStrategy.bottom('0').left('0');

    return positionStrategy;
  }
}
