import { Directive } from '@angular/core';

/**
 * Slot directive marking content for the **end** pane of a `mlv-split-pane`.
 *
 * - In `'horizontal'` orientation: the **right** pane.
 * - In `'vertical'` orientation: the **bottom** pane.
 *
 * The end pane flexibly fills the remaining space after the start pane and drag handle.
 *
 * @example
 * ```html
 * <mlv-split-pane>
 *   <div mlvSplitPaneStart>Left content</div>
 *   <div mlvSplitPaneEnd>Right content</div>
 * </mlv-split-pane>
 * ```
 */
@Directive({
  selector: '[mlvSplitPaneEnd]',
  host: {
    class: 'mlv-split-pane__end',
  },
})
export class MlvSplitPaneEnd {}
