import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
  signal,
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
import type { MlvDrawerPosition } from '../drawer.service';
import {
  DRAWER_HIDDEN_TRANSFORMS,
  resolveDrawerPanelDimensions,
} from './drawer-geometry';
import { MlvDrawerPanel } from './drawer-panel';

// No `styleUrl`: `drawer.scss` belongs to `MlvDrawerPanel`, the panel every
// open path renders, so the rules arrive with an open drawer whichever way it
// was opened rather than with this host.
@Component({
  selector: 'mlv-drawer',
  imports: [OverlayModule, A11yModule, NgTemplateOutlet, MlvDrawerPanel],
  templateUrl: './drawer.html',
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
   * Id of a visible element that labels the drawer. When set, it takes
   * precedence over the projected `mlv-drawer-header` title, `ariaLabel` and
   * the i18n fallback via `aria-labelledby` — mirroring how `mlv-dialog`
   * labels itself by its projected header.
   */
  readonly ariaLabelledBy = input<string>();

  /**
   * @private Ids of the `mlv-drawer-header` titles currently registered as
   * the drawer's label, in registration order. A header registers its title
   * while it has text and withdraws it when it loses it.
   */
  private readonly _headerLabelIds = signal<readonly string[]>([]);

  /**
   * @protected Resolved `aria-labelledby` for the dialog surface: the explicit
   * `ariaLabelledBy` input, else the registered header titles. An explicit
   * `ariaLabel` suppresses the header titles — a consumer naming the drawer
   * by hand wins over the automatic label, as it does for `mlv-dialog`.
   */
  protected readonly _resolvedAriaLabelledBy = computed(() => {
    const explicit = this.ariaLabelledBy();
    if (explicit) {
      return explicit;
    }
    if (this.ariaLabel()) {
      return null;
    }
    return this._headerLabelIds().join(' ') || null;
  });

  /**
   * @protected Resolved `aria-label` for the dialog surface: the explicit
   * `ariaLabel` input, or the localized fallback. Suppressed (null) whenever
   * `aria-labelledby` resolves so the two naming methods never conflict.
   */
  protected readonly _resolvedAriaLabel = computed(() =>
    this._resolvedAriaLabelledBy()
      ? null
      : (this.ariaLabel() ?? this._i18n().drawer),
  );

  /**
   * @internal Registers a header title `id` as a label of the drawer. Used by
   * `mlv-drawer-header`; the `ariaLabelledBy` / `ariaLabel` inputs still win.
   */
  _labelBy(id: string): void {
    this._headerLabelIds.update((ids) =>
      ids.includes(id) ? ids : [...ids, id],
    );
  }

  /** @internal Reverses {@link _labelBy} when the header title empties or is destroyed. */
  _unlabelBy(id: string): void {
    this._headerLabelIds.update((ids) =>
      ids.includes(id) ? ids.filter((candidate) => candidate !== id) : ids,
    );
  }

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
   * CSS min-size floor for the panel's sizing axis (width for `left`/`right`,
   * height for `top`/`bottom`).
   *
   * Bound as `min-width` / `min-height` on the panel, so a drag resize (which
   * writes the axis size through `--mlv-drawer-current-size`) can never
   * shrink the panel below it. Honoured on the fixed-`size` path as well; the
   * `'0px'` default is a no-op there. Clamped to the viewport like `maxSize`:
   * `min-*` beats `max-*` in CSS, so an unclamped `40rem` floor would push the
   * panel off a 375px screen.
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

  /**
   * Transform that parks the panel beyond its edge, which the shared
   * `drawer-enter` / `drawer-leave` keyframes read through
   * `--mlv-drawer-hidden-transform`. The panel binds its own copy; this one is
   * kept for callers that read it.
   */
  readonly hiddenTransform = computed(
    () => DRAWER_HIDDEN_TRANSFORMS[this.position()],
  );

  /** @protected Projected drawer content directive, rendered into the overlay panel. */
  protected readonly contentRef = contentChild(MlvDrawerContent);

  /** @protected The `#drawerTemplate` view template attached to the CDK overlay portal. */
  protected readonly drawerTemplate =
    viewChild<TemplateRef<unknown>>('drawerTemplate');

  /**
   * Resolved inline geometry of the panel: the sizing-axis `size` (or the
   * `defaultSnap` size of a `resizable` drawer), the cross-axis viewport fill,
   * the `minSize` floor on the sizing axis, and the max ceilings on both axes,
   * each clamped to the viewport. The panel binds the same geometry from the
   * same inputs; this getter is kept for callers that read it.
   */
  get drawerDimensions(): Record<string, string> {
    return resolveDrawerPanelDimensions({
      position: this.position(),
      size: this.size(),
      resizable: this.resizable(),
      defaultSnap: this.defaultSnap(),
      minSize: this.minSize(),
      maxSize: this.maxSize(),
    });
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
