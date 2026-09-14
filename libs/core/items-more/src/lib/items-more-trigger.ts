import { Directive, ElementRef, computed, inject, input } from '@angular/core';
import type { MlvItemsMoreAccessor } from './items-more-token';
import { MLV_ITEMS_MORE } from './items-more-token';

/**
 * Makes its host the control that opens an `mlv-items-more` panel.
 *
 * Put it on a `<button>`. It contributes the click, `aria-expanded` and
 * `aria-controls`, and nothing else — no chrome, no label, no layout —
 * because the two places it is used both already own those: inside
 * `mlvItemsMoreTriggerDef`, where the consumer wrote the button; and out in
 * the consumer's own layout, where the button is theirs entirely.
 *
 * There is deliberately no `aria-haspopup`. Every value of it promises a
 * specific popup role — `true` means `menu` — with the keyboard model that
 * role implies, and the panel is neither: it is a disclosure of the very
 * controls the row withheld, with their own roles and their own keyboard
 * behaviour. `aria-expanded` is the whole of what is true about it.
 *
 * ```html
 * <!-- the row's own trigger -->
 * <ng-template mlvItemsMoreTriggerDef let-count>
 *   <button mlvButton shape="square" mlvItemsMoreTrigger aria-label="More actions">
 *     <svg lucideEllipsis [size]="16" />
 *   </button>
 * </ng-template>
 *
 * <!-- or one the consumer places themselves -->
 * <mlv-items-more #actions>…</mlv-items-more>
 * @if (actions.hiddenCount(); as count) {
 *   <button mlvButton [mlvItemsMoreTrigger]="actions">More ({{ count }})</button>
 * }
 * ```
 *
 * Keyboard activation is the host's. On a `<button>` Enter and Space come
 * free; on anything else they do not, and the directive deliberately does not
 * synthesise them — an element that needs synthesised activation needs
 * `[mlvClick]`'s full contract (`role`, `tabindex`), not half of it from here.
 */
@Directive({
  selector: '[mlvItemsMoreTrigger]',
  exportAs: 'mlvItemsMoreTrigger',
  host: {
    class: 'mlv-items-more-trigger',
    '[attr.aria-expanded]': '_owner()?.panelOpened() ?? null',
    '[attr.aria-controls]': '_ariaControls()',
    '(click)': '_toggle()',
  },
})
export class MlvItemsMoreTrigger {
  /**
   * The row this trigger drives.
   *
   * Optional, and only needed for a trigger placed **outside**
   * `<mlv-items-more>` — DI reaches the row for a trigger inside it,
   * including one inside the `mlvItemsMoreTriggerDef` template, and that is
   * the common case. Written bare (`<button mlvItemsMoreTrigger>`) the input
   * receives the empty string, which is not a row and falls through to DI.
   */
  readonly mlvItemsMoreTrigger = input<MlvItemsMoreAccessor | '' | undefined>(
    undefined,
  );

  /** @private The host, which is also the overlay's anchor. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private The enclosing row, when there is one. */
  private readonly _injected = inject(MLV_ITEMS_MORE, { optional: true });

  /**
   * @protected The row this trigger actually drives: the bound one if a row
   * was bound, otherwise the enclosing one. `null` when neither exists, and
   * then the host carries no ARIA state at all rather than a false one.
   */
  protected readonly _owner = computed<MlvItemsMoreAccessor | null>(() => {
    const bound = this.mlvItemsMoreTrigger();
    return bound ? bound : this._injected;
  });

  /**
   * @protected `aria-controls` while the panel is open, absent otherwise.
   *
   * The panel is a CDK overlay and does not exist in the document until it
   * opens, and a reference to an id that resolves to nothing is worse than no
   * reference — it tells a screen reader there is a controlled element and
   * then gives it nothing to move to.
   */
  protected readonly _ariaControls = computed(() => {
    const owner = this._owner();
    return owner?.panelOpened() ? owner.panelId : null;
  });

  /** @protected Opens or closes the panel, anchored on this element. */
  protected _toggle(): void {
    this._owner()?.togglePanel(this._elementRef);
  }
}
