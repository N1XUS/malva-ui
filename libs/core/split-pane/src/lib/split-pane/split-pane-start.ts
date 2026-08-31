import { Directive } from '@angular/core';

/**
 * Slot directive marking content for the **start** pane of a `mlv-split-pane`.
 *
 * - In `'horizontal'` orientation: the **left** pane.
 * - In `'vertical'` orientation: the **top** pane.
 *
 * The start pane size is controlled by the `--mlv-sp-size` CSS custom property,
 * which is updated dynamically by the split pane component during drag or keyboard resize.
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
  selector: '[mlvSplitPaneStart]',
  host: {
    class: 'mlv-split-pane__start',
  },
})
export class MlvSplitPaneStart {}
