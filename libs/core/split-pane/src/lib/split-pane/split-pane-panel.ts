import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';

/**
 * Individual panel inside a `mlv-split-pane`.
 *
 * Panels are placed side-by-side (horizontal) or stacked (vertical) with a
 * draggable handle between each pair. The parent component manages all sizes
 * and inserts the handles automatically.
 *
 * @example
 * ```html
 * <mlv-split-pane>
 *   <mlv-split-pane-panel [size]="30">Sidebar</mlv-split-pane-panel>
 *   <mlv-split-pane-panel>Main content</mlv-split-pane-panel>
 * </mlv-split-pane>
 * ```
 */
@Component({
  selector: 'mlv-split-pane-panel',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-split-pane__panel',
  },
})
export class MlvSplitPanePanel {
  /** @internal Direct reference to the host element, used by the parent for DOM measurement. */
  readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * Initial size of this panel as a percentage of the container.
   * When omitted the panel shares the remaining space equally with other unsized panels.
   */
  readonly size = input<number | undefined>(undefined);

  /**
   * Minimum size of this panel as a percentage.
   * Drag and keyboard resize will not reduce this panel below this value.
   * Defaults to `5`.
   */
  readonly minSize = input(5);
}
