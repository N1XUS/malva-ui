import { computed, Directive, input } from '@angular/core';
import type { MlvTabGroup } from '../tabs/tabs';

/**
 * Marks an element elsewhere in the document as the panel of a
 * `mlv-tab-group panels="external"`.
 *
 * ```html
 * <mlv-page-header>
 *   <div mlvPageTabs>
 *     <mlv-tab-group #tabs panels="external" [(activeTab)]="section">…</mlv-tab-group>
 *   </div>
 * </mlv-page-header>
 *
 * <mlv-page-content>
 *   <section [mlvTabPanel]="tabs">…the active section…</section>
 * </mlv-page-content>
 * ```
 *
 * **What it does and does not claim.** It gives the element `role="tabpanel"`,
 * a tab stop, and an `aria-labelledby` naming the tab currently selected, so a
 * reader arriving in the panel is told which tab it belongs to and can Tab
 * into it from the strip. It does **not** make the tabs point back at it:
 * `aria-controls` is set by `@angular/aria` from a panel inside the group's own
 * DI scope, and an element in a different part of the layout is not that. The
 * APG lists `aria-controls` on a tab as recommended rather than required, and
 * one honest half of the relationship beats two halves where the second
 * resolves to an empty stub.
 *
 * The consumer swaps the panel's content on the group's `activeTab` — the
 * element is one panel that changes, not one panel per tab, which is what
 * makes the arrangement expressible at all.
 */
@Directive({
  selector: '[mlvTabPanel]',
  exportAs: 'mlvTabPanel',
  host: {
    class: 'mlv-tab-panel',
    role: 'tabpanel',
    // A tabpanel with no focusable content is unreachable by keyboard without
    // this; with focusable content it is a harmless extra stop that lands the
    // reader at the top of the panel rather than at its first control.
    tabindex: '0',
    '[attr.aria-labelledby]': '_labelledBy()',
  },
})
export class MlvTabPanel {
  /**
   * The tab group this element is the panel of.
   *
   * Optional rather than required because the group is routinely reached with
   * a `viewChild()` — a template reference variable declared inside an `@if`
   * is not visible outside it, and a strip in a page header usually is inside
   * one. That query is `undefined` for the first render, and a panel with no
   * name yet is still a panel; a required input would make the common wiring
   * throw on the first pass instead.
   */
  readonly group = input<MlvTabGroup | null | undefined>(undefined, {
    alias: 'mlvTabPanel',
  });

  /**
   * @private Id of the selected tab element. Absent while the selected tab is
   * in the overflow menu — the panel is still correct, it just has no visible
   * tab to be named after, and an `aria-labelledby` pointing at a tab that is
   * not rendered would name it after nothing.
   */
  protected readonly _labelledBy = computed(
    () => this.group()?.activeTabId() ?? null,
  );
}
