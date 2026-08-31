import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { AccordionGroup } from '@angular/aria/accordion';

/**
 * Vertical accordion container built on the `@angular/aria` `AccordionGroup`
 * headless pattern. Projects one or more `mlv-accordion-item` children and
 * coordinates their expand/collapse behaviour, single- vs multi-expand mode,
 * and roving keyboard navigation (Arrow Up/Down, Home, End) across the item
 * headers.
 *
 * The `@angular/aria` `AccordionGroup` is applied as a host directive so the
 * `ACCORDION_GROUP` DI token it provides is visible to the triggers rendered
 * inside each projected `mlv-accordion-item`. Its inputs are re-exposed
 * verbatim on `<mlv-accordion>` — the aria directive owns the roles, keyboard
 * event listeners, roving tabindex, and `aria-*` wiring.
 *
 * @example Single-expand (default aria behaviour is multi-expand)
 * ```html
 * <mlv-accordion [multiExpandable]="false">
 *   <mlv-accordion-item header="Shipping">…</mlv-accordion-item>
 *   <mlv-accordion-item header="Returns">…</mlv-accordion-item>
 * </mlv-accordion>
 * ```
 *
 * @example Programmatic expand/collapse all
 * ```html
 * <mlv-accordion #acc [multiExpandable]="true">…</mlv-accordion>
 * <button (click)="acc.expandAll()">Expand all</button>
 * <button (click)="acc.collapseAll()">Collapse all</button>
 * ```
 */
@Component({
  selector: 'mlv-accordion',
  template: '<ng-content />',
  styleUrl: './accordion.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: AccordionGroup,
      inputs: ['multiExpandable', 'disabled', 'softDisabled', 'wrap'],
    },
  ],
  host: {
    class: 'mlv-accordion',
  },
})
export class MlvAccordion {
  /**
   * @private The host `@angular/aria` `AccordionGroup` directive instance,
   * used to delegate the imperative `expandAll()` / `collapseAll()` calls.
   */
  private readonly _group = inject(AccordionGroup);

  /**
   * Expands every accordion item. Only has an effect when `multiExpandable`
   * is `true`; in single-expand mode the aria pattern keeps at most one panel
   * open.
   */
  expandAll(): void {
    this._group.expandAll();
  }

  /** Collapses every accordion item. */
  collapseAll(): void {
    this._group.collapseAll();
  }
}
