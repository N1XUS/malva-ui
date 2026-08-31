import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Structural directive used to provide a custom template for the separator
 * rendered between `mlv-pin-input` cells. When no instance is projected, the
 * component falls back to a default Lucide dot icon.
 *
 * @example
 * ```html
 * <mlv-pin-input [length]="6" separator="each">
 *   <ng-template mlvPinInputSeparator>
 *     <span class="dash">—</span>
 *   </ng-template>
 * </mlv-pin-input>
 * ```
 */
@Directive({
  selector: '[mlvPinInputSeparator]',
})
export class MlvPinInputSeparator {
  /**
   * The template reference for the projected separator content.
   */
  readonly templateRef = inject(TemplateRef<unknown>);
}
