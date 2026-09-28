import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { OnInit } from '@angular/core';

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
export class MlvSplitPanePanel implements OnInit {
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
   *
   * Read on every resize, so a change applies from the next drag or key
   * press; raising it does not grow a panel that is already below the new
   * value. A panel added at runtime takes its size from the panels beside it
   * without taking any of them below their own `minSize`, so when they are
   * all at theirs it can start below its own — at `0` when none can give.
   */
  readonly minSize = input(5);

  /** @private Writable source of {@link _bound}; only `ngOnInit` sets it. */
  private readonly _boundSource = signal(false);

  /**
   * @internal Whether the panel's inputs have been bound for the first time.
   * The parent's structure effect waits for it before laying out a panel it
   * has not laid out yet: a panel stamped by `@for` / `@if` is queried before
   * its embedded view binds `[size]`, so `size()` still reads the default
   * there, and `undefined` is also a valid bound value — nothing else can
   * tell the two apart. Read-only: only the panel's own `ngOnInit` sets it.
   */
  readonly _bound = this._boundSource.asReadonly();

  /** @internal Marks the inputs as bound; see {@link _bound}. */
  ngOnInit(): void {
    this._boundSource.set(true);
  }
}
