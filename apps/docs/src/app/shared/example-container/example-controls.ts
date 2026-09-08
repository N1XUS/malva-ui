import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import {
  LucideMonitor,
  LucideMoon,
  LucideRows2,
  LucideRows3,
  LucideRows4,
  LucideSmartphone,
  LucideSun,
  LucideTablet,
} from '@lucide/angular';
import type { MlvDensity } from '@malva-ui/cdk/density';
import type { MlvDirection } from '@malva-ui/cdk/utils';
import {
  MlvActionBar,
  MlvActionBarActions,
  MlvActionBarSpacer,
} from '@malva-ui/core/action-bar';
import type { MlvTheme } from '@malva-ui/core/layout';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvTooltip } from '@malva-ui/core/tooltip';

/** Preview widths the stage can be pinned to. `desktop` means "no cap". */
export type DocsExampleViewport = 'mobile' | 'tablet' | 'desktop';

/**
 * The bar above a docs example preview: density, direction, theme and preview
 * width, each scoped to that one example.
 *
 * Every switcher is a plain two-way model. The component deliberately injects
 * **none** of `MlvDensityService` / `MlvRtlService` / `MlvThemeService`: those
 * three own the document and belong to `docs-app-bar-preferences`. Flipping an
 * example must not flip the page around it, so the value travels up to
 * `docs-example-container` and back down as scoped DOM state through
 * `DocsExampleScopeDirective`.
 *
 * The bar itself is `mlvDensity="tight"` — it is chrome, not content — and
 * `MlvActionBar` projects that density to the switchers inside it. It is also
 * `[animated]="false"`: `doc-page` builds every example inside a `@for`, so
 * every bar on the page enters the DOM on every navigation, and a docs page
 * with 23 examples would fade and slide 23 of them at once on arrival.
 *
 * `docs-example-container` renders it inside `@defer (on viewport)`, so the
 * bars for examples further down a page cost nothing until the reader reaches
 * them. Nothing here depends on that — the component is an ordinary child that
 * happens to be created late.
 */
@Component({
  selector: 'docs-example-controls',
  imports: [
    MlvActionBar,
    MlvActionBarActions,
    MlvActionBarSpacer,
    MlvSegmented,
    MlvSegmentedItem,
    MlvTooltip,
    LucideMonitor,
    LucideMoon,
    LucideRows2,
    LucideRows3,
    LucideRows4,
    LucideSmartphone,
    LucideSun,
    LucideTablet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      mlvActionBar
      mlvDensity="tight"
      wrap
      [animated]="false"
      class="example-controls__bar"
    >
      <mlv-segmented
        data-switcher="density"
        ariaLabel="Example density"
        [value]="density()"
        (valueChange)="_onDensity($event)"
      >
        <button
          mlvSegmentedItem
          value="compact"
          aria-label="Compact density"
          mlvTooltip="Compact"
        >
          <svg lucideRows4 [size]="14" aria-hidden="true"></svg>
        </button>
        <button
          mlvSegmentedItem
          value="comfortable"
          aria-label="Comfortable density"
          mlvTooltip="Comfortable"
        >
          <svg lucideRows3 [size]="14" aria-hidden="true"></svg>
        </button>
        <button
          mlvSegmentedItem
          value="spacious"
          aria-label="Spacious density"
          mlvTooltip="Spacious"
        >
          <svg lucideRows2 [size]="14" aria-hidden="true"></svg>
        </button>
      </mlv-segmented>

      <mlv-segmented
        data-switcher="direction"
        ariaLabel="Example direction"
        [value]="direction()"
        (valueChange)="_onDirection($event)"
      >
        <button mlvSegmentedItem value="ltr" mlvTooltip="Left to right">
          LTR
        </button>
        <button mlvSegmentedItem value="rtl" mlvTooltip="Right to left">
          RTL
        </button>
      </mlv-segmented>

      <mlv-segmented
        data-switcher="theme"
        ariaLabel="Example theme"
        [value]="theme()"
        (valueChange)="_onTheme($event)"
      >
        <button
          mlvSegmentedItem
          value="light"
          aria-label="Light theme"
          mlvTooltip="Light"
        >
          <svg lucideSun [size]="14" aria-hidden="true"></svg>
        </button>
        <button
          mlvSegmentedItem
          value="dark"
          aria-label="Dark theme"
          mlvTooltip="Dark"
        >
          <svg lucideMoon [size]="14" aria-hidden="true"></svg>
        </button>
      </mlv-segmented>

      <span mlvActionBarSpacer></span>

      <!-- Pinning the stage to a phone width says nothing on a phone, so the
           control sheds itself at md and below like any other desktop-only
           action-bar content. -->
      <mlv-segmented
        mlvActionBarActions
        data-switcher="viewport"
        ariaLabel="Example width"
        [value]="viewport()"
        (valueChange)="_onViewport($event)"
      >
        <button
          mlvSegmentedItem
          value="mobile"
          aria-label="Mobile width"
          mlvTooltip="Mobile"
        >
          <svg lucideSmartphone [size]="14" aria-hidden="true"></svg>
        </button>
        <button
          mlvSegmentedItem
          value="tablet"
          aria-label="Tablet width"
          mlvTooltip="Tablet"
        >
          <svg lucideTablet [size]="14" aria-hidden="true"></svg>
        </button>
        <button
          mlvSegmentedItem
          value="desktop"
          aria-label="Full width"
          mlvTooltip="Full width"
        >
          <svg lucideMonitor [size]="14" aria-hidden="true"></svg>
        </button>
      </mlv-segmented>
    </div>
  `,
  styles: `
    .example-controls__bar {
      box-shadow: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
  `,
})
export class ExampleControlsComponent {
  /** Density applied to the example preview only. */
  readonly density = model<MlvDensity>('comfortable');

  /** Direction applied to the example preview only. */
  readonly direction = model<MlvDirection>('ltr');

  /** Theme applied to the example preview only. */
  readonly theme = model<MlvTheme>('light');

  /** Width the example stage is pinned to. */
  readonly viewport = model<DocsExampleViewport>('desktop');

  /**
   * @protected `mlv-segmented` models its value as `unknown` (it is a generic
   * radio group), so every handler narrows before writing the typed model
   * rather than casting. The three offered here match the page-level switcher;
   * `MlvDensity`'s other two steps are library-only.
   */
  protected _onDensity(value: unknown): void {
    if (
      value === 'compact' ||
      value === 'comfortable' ||
      value === 'spacious'
    ) {
      this.density.set(value);
    }
  }

  /** @protected Narrows and applies a direction pick. */
  protected _onDirection(value: unknown): void {
    if (value === 'ltr' || value === 'rtl') this.direction.set(value);
  }

  /** @protected Narrows and applies a theme pick. */
  protected _onTheme(value: unknown): void {
    if (value === 'light' || value === 'dark') this.theme.set(value);
  }

  /** @protected Narrows and applies a preview-width pick. */
  protected _onViewport(value: unknown): void {
    if (value === 'mobile' || value === 'tablet' || value === 'desktop') {
      this.viewport.set(value);
    }
  }
}
